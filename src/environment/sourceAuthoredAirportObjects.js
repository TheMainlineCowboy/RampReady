import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const SOURCE_AUTHORED_AIRPORT_OBJECT_PROFILE = Object.freeze({
  sourceRepository: "TheMainlineCowboy/SkyHarborPhx@58115954e8d8294448e6e06d1be24d81a8e22764",
  placementSource: "scenery/PHX_Scenery.BGL",
  placementCount: 19,
  modelCount: 5,
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
  detailLevel: "source-authored-airport-object-population-v1",
});

const A1 = Object.freeze({ latitude: 33.43653056770563, longitude: -111.99864059686661 });
const EARTH_RADIUS_METERS = 6378137;
const ORIGIN_LATITUDE_RADIANS = A1.latitude * Math.PI / 180;

function toScene(longitude, latitude) {
  const east = (longitude - A1.longitude) * Math.PI / 180 * EARTH_RADIUS_METERS * Math.cos(ORIGIN_LATITUDE_RADIANS);
  const north = (latitude - A1.latitude) * Math.PI / 180 * EARTH_RADIUS_METERS;
  return [north, east + 6.2];
}

function modelColor(modelId) {
  if (modelId === "backhoe") return 0xd0a126;
  if (modelId === "constrailer") return 0xd8d5ca;
  if (modelId === "wncater") return 0xf1eee7;
  if (modelId === "phxtermlink") return 0x777d83;
  return 0x898d91;
}

function configureModel(THREE, modelId, root) {
  const color = modelColor(modelId);
  root.traverse((node) => {
    if (!node.isMesh) return;
    const originals = Array.isArray(node.material) ? node.material : [node.material];
    const configured = originals.map((original) => {
      const material = original?.clone?.() ?? new THREE.MeshStandardMaterial();
      material.color?.setHex(color);
      material.roughness = modelId === "phxtermlink" ? 0.72 : 0.86;
      material.metalness = modelId === "backhoe" ? 0.16 : 0.04;
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
      return material;
    });
    node.material = Array.isArray(node.material) ? configured : configured[0];
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    node.userData.sourceAuthoredAirportObject = modelId;
  });
}

async function fetchManifest(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`KPHX source object manifest returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.schemaVersion !== 1
    || manifest.sourceCommit !== "58115954e8d8294448e6e06d1be24d81a8e22764"
    || manifest.placementCount !== SOURCE_AUTHORED_AIRPORT_OBJECT_PROFILE.placementCount
    || manifest.modelCount !== SOURCE_AUTHORED_AIRPORT_OBJECT_PROFILE.modelCount) {
    throw new Error("KPHX source object manifest does not match the pinned simulator population");
  }
  return manifest;
}

export async function installSourceAuthoredAirportObjects(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required for source objects");
  const baseUrl = `${import.meta.env.BASE_URL}models/kphx-source-objects/`;
  const manifest = await fetchManifest(`${baseUrl}source-object-manifest.json`);
  const loader = new GLTFLoader();
  const templates = new Map();
  await Promise.all(Object.entries(manifest.models).map(async ([modelId, entry]) => {
    const gltf = await loader.loadAsync(`${baseUrl}${entry.gltf}`);
    configureModel(THREE, modelId, gltf.scene);
    templates.set(modelId, gltf.scene);
  }));

  const group = new THREE.Group();
  group.name = "PHX_SourceAuthoredAirportObjectPopulation";
  const counts = {};
  for (const placement of manifest.placements) {
    const template = templates.get(placement.model);
    if (!template) throw new Error(`KPHX source object template ${placement.model} is missing`);
    const instance = template.clone(true);
    const [x, z] = toScene(placement.longitude, placement.latitude);
    instance.position.set(x, Math.max(0.02, Number(placement.altitudeMeters) || 0), z);
    instance.rotation.y = THREE.MathUtils.degToRad(90 - placement.headingDegrees);
    instance.scale.set(-placement.scale, placement.scale, placement.scale);
    instance.name = `PHX_SourcePlaced_${placement.model}`;
    instance.userData.sourcePlacement = { ...placement, x, z };
    group.add(instance);
    counts[placement.model] = (counts[placement.model] || 0) + 1;
  }

  group.userData.sourceRepository = SOURCE_AUTHORED_AIRPORT_OBJECT_PROFILE.sourceRepository;
  group.userData.placementCount = group.children.length;
  group.userData.modelCount = templates.size;
  group.userData.counts = counts;
  group.userData.detailLevel = SOURCE_AUTHORED_AIRPORT_OBJECT_PROFILE.detailLevel;
  environment.add(group);
  environment.userData.sourceAuthoredAirportObjects = group;
  environment.userData.sourceAuthoredAirportObjectPlacementCount = group.children.length;
  environment.userData.sourceAuthoredAirportObjectModelCount = templates.size;
  environment.userData.sourceAuthoredAirportObjectDetailLevel = group.userData.detailLevel;
  return group;
}
