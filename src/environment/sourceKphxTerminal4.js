import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const EARTH_RADIUS_METERS = 6378137;

export const SOURCE_KPHX_A1_ORIGIN = Object.freeze({
  authority: "KPHX 1.75.1 earth.wed.xml WED_RampPosition 27855",
  name: "T4 Gate A1",
  latitude: 33.436530675,
  longitude: -111.998921221,
  headingDegrees: -90.08,
  browserPosition: Object.freeze([0, 0, 6.2]),
});

export const SOURCE_KPHX_TERMINAL4_OBJECTS = Object.freeze([
  Object.freeze({
    name: "KPHX_Terminal4_North_Exact",
    resource: "Terminals/Terminal4b.obj",
    runtime: "Terminal4b.exact.glb",
    wedObjectId: 5301,
    latitude: 33.436209533,
    longitude: -111.996664410,
    headingDegrees: 0,
    vertices: 40773,
    indices: 70725,
    sourceSha256: "acbefef71c59942eb8e336996b9f2b9c8e8a87c6ec5cc64046292e5332ce48bc",
    runtimeBytes: 19728400,
    runtimeSha256: "1380cb6b1f33a3beca14a44ca4f17ef765bcf718c099769d6a723f0dbc10ab43",
  }),
  Object.freeze({
    name: "KPHX_Terminal4_South_Exact",
    resource: "Terminals/Terminal4.obj",
    runtime: "Terminal4.exact.glb",
    wedObjectId: 2327,
    latitude: 33.434761986,
    longitude: -111.996702473,
    headingDegrees: 0,
    vertices: 21720,
    indices: 42501,
    sourceSha256: "e93807a1239377e1223eb325c2b7048e6c84f968d9c790fd0cd6cc5da050cd80",
    runtimeBytes: 19786104,
    runtimeSha256: "1899c3d3258922868f835b62dbd1b85713871017d52d34167d80c136f8b6d8b2",
  }),
]);

function sourceLocalFromWED(latitude, longitude) {
  const latitude0 = SOURCE_KPHX_A1_ORIGIN.latitude * Math.PI / 180;
  const east = (longitude - SOURCE_KPHX_A1_ORIGIN.longitude) * Math.PI / 180
    * EARTH_RADIUS_METERS * Math.cos(latitude0);
  const north = (latitude - SOURCE_KPHX_A1_ORIGIN.latitude) * Math.PI / 180
    * EARTH_RADIUS_METERS;
  return { x: east, z: -north };
}

function hideLegacyCalibrationTerminal(environment) {
  environment.traverse((node) => {
    if (
      node.name === "TerminalFacadeModule"
      || node.name === "TerminalFacadeGlass"
      || node.name === "PHX_Terminal4_AuthoredTexturedVisual"
      || node.name === "PHX_Terminal4_SourceJetways"
    ) node.visible = false;
  });
}

function configureExactModel(THREE, scene, object) {
  const placement = sourceLocalFromWED(object.latitude, object.longitude);
  scene.name = object.name;
  scene.position.set(placement.x, 0, placement.z);
  scene.rotation.y = THREE.MathUtils.degToRad(-object.headingDegrees);
  scene.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material?.map) material.map.colorSpace = THREE.SRGBColorSpace;
      if (material) material.needsUpdate = true;
    }
  });
  scene.userData = {
    ...(scene.userData || {}),
    sourceAuthority: "exact-user-drive-kphx-1.75.1",
    sourceResource: object.resource,
    sourceSha256: object.sourceSha256,
    runtimeSha256: object.runtimeSha256,
    wedObjectId: object.wedObjectId,
    wedLatitude: object.latitude,
    wedLongitude: object.longitude,
    wedHeadingDegrees: object.headingDegrees,
    sourceVertexCount: object.vertices,
    sourceIndexCount: object.indices,
  };
  return scene;
}

function nearestHorizontalVertexDistance(THREE, root, point) {
  let nearest = Number.POSITIVE_INFINITY;
  const vertex = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!node.isMesh) return;
    const position = node.geometry?.getAttribute?.("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      node.localToWorld(vertex);
      nearest = Math.min(nearest, Math.hypot(vertex.x - point.x, vertex.z - point.z));
    }
  });
  return nearest;
}

export async function installSourceKphxTerminal4Visual(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  hideLegacyCalibrationTerminal(environment);

  const loader = new GLTFLoader();
  const baseUrl = `${import.meta.env.BASE_URL}models/kphx/`;
  const loaded = await Promise.all(SOURCE_KPHX_TERMINAL4_OBJECTS.map(async (object) => {
    const { scene } = await loader.loadAsync(`${baseUrl}${object.runtime}`);
    return configureExactModel(THREE, scene, object);
  }));

  const sourceAirportFrame = new THREE.Group();
  sourceAirportFrame.name = "KPHX_1_75_1_WED_Source_Frame";
  sourceAirportFrame.position.fromArray(SOURCE_KPHX_A1_ORIGIN.browserPosition);
  // WED A1 points west. Rotate the complete airport once so that this source
  // gate heading matches RampReady's existing aircraft-forward +Z axis.
  sourceAirportFrame.rotation.y = THREE.MathUtils.degToRad(90);
  sourceAirportFrame.add(...loaded);
  environment.add(sourceAirportFrame);
  sourceAirportFrame.updateMatrixWorld(true);

  const a1Point = new THREE.Vector3(...SOURCE_KPHX_A1_ORIGIN.browserPosition);
  const nearest = nearestHorizontalVertexDistance(THREE, sourceAirportFrame, a1Point);

  environment.userData.environmentSource = "exact-user-drive-kphx-1.75.1-terminal4";
  environment.userData.authoredTerminal4 = sourceAirportFrame;
  environment.userData.authoredTerminal4Position = [...SOURCE_KPHX_A1_ORIGIN.browserPosition];
  environment.userData.authoredTerminal4Placement = "exact KPHX 1.75.1 WED object placements from Gate A1 source origin";
  environment.userData.authoredTerminal4A1NearestGeometryDistance = nearest;
  environment.userData.authoredTerminal4TextureCount = 4;
  environment.userData.authoredTerminal4ExactTextureCount = 4;
  environment.userData.authoredTerminal4FallbackTextureCount = 0;
  environment.userData.authoredTerminal4TexturedMaterialCount = 2;
  environment.userData.authoredTerminal4SourceCutoutMaterialCount = 0;
  environment.userData.authoredTerminal4FacadeInfillCount = 0;
  environment.userData.authoredTerminal4OpenServiceBayCount = 0;
  environment.userData.authoredTerminal4LowerFacadeFitCount = 0;
  environment.userData.authoredTerminal4TerminalConnectedJetwayCount = 0;
  environment.userData.authoredTerminal4A1JetwayWallDistance = Number.NaN;
  environment.userData.authoredTerminal4JetwayDetailLevel = "pending-exact-WED-jetway-ingest";
  environment.userData.authoredTerminal4JetwayTextureAuthority = "pending-exact-WED-jetway-ingest";
  environment.userData.authoredTerminal4ExactJetwayTextureActive = false;
  environment.userData.sourceKphxTerminal4ObjectCount = loaded.length;
  environment.userData.sourceKphxAuthority = "user-drive-kphx-1.75.1";
  environment.userData.sourceKphxA1Origin = SOURCE_KPHX_A1_ORIGIN;
  environment.userData.sourceKphxTerminal4Objects = SOURCE_KPHX_TERMINAL4_OBJECTS;

  return sourceAirportFrame;
}
