import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SOURCE_KPHX_A1_ORIGIN } from "./sourceKphxTerminal4.js";

const EARTH_RADIUS_METERS = 6378137;

export const SOURCE_KPHX_LANDMARK_OBJECTS = Object.freeze([
  Object.freeze({
    name: "KPHX_SkyTrain_Exact",
    resource: "SkyTrain/SkyTrain.obj",
    runtime: "SkyTrain.exact.glb",
    wedObjectId: 5041,
    latitude: 33.434833307,
    longitude: -111.992280616,
    headingDegrees: 359.50,
    vertices: 11227,
    indices: 19386,
    sourceSha256: "6f31980bc9b838ea2da26ee24e737e47604d8706068786b443adca3957b0dab3",
    runtimeBytes: 8066472,
    runtimeSha256: "539b6b8f380005b5299113546254a465a5b4a6ff76600350631169cd55bc3d5c",
  }),
  Object.freeze({
    name: "KPHX_ControlTower_Exact",
    resource: "Misc/Tower.obj",
    runtime: "Tower.exact.glb",
    wedObjectId: 9301,
    latitude: 33.435392866,
    longitude: -112.005560624,
    headingDegrees: 0,
    vertices: 5004,
    indices: 14682,
    sourceSha256: "673da0b0bcdcc55b86bde4765fad0ec7378225b2e4c276099bb8c7acedb6b091",
    runtimeBytes: 19981364,
    runtimeSha256: "c3c7ef387880e813bbff9312991c3143344c1e896044ffa512851bc1eb7e3b5b",
  }),
  Object.freeze({
    name: "KPHX_FireStation_Exact",
    resource: "Misc/FireStation.obj",
    runtime: "FireStation.exact.glb",
    wedObjectId: 13095,
    latitude: 33.434226509,
    longitude: -112.005739888,
    headingDegrees: 0,
    vertices: 1048,
    indices: 2034,
    sourceSha256: "3ce531322e40e83da763eabe84aef4d4a41529f4acb312c52e9a92e90b90670c",
    runtimeBytes: 3743904,
    runtimeSha256: "77f319d345c5ac31daaab8582e82460bcf108f3714aa4120ff4689dfe46cb62d",
  }),
  Object.freeze({
    name: "KPHX_FireStation2_Exact",
    resource: "Misc/FireStation2.obj",
    runtime: "FireStation2.exact.glb",
    wedObjectId: 27771,
    latitude: 33.442843134,
    longitude: -111.996848049,
    headingDegrees: 90,
    vertices: 867,
    indices: 1728,
    sourceSha256: "35c54df2d136a625393438437b02274450101c67696db82f8461447f73dbbb23",
    runtimeBytes: 3737504,
    runtimeSha256: "4a9b485276c132771f2545d0954d9c81f8d148762c57653d7ef449d45e1d5055",
  }),
  Object.freeze({
    name: "KPHX_BaggageStand_Exact",
    resource: "Misc/BaggageStand.obj",
    runtime: "BaggageStand.exact.glb",
    wedObjectId: 13329,
    latitude: 33.437139028,
    longitude: -112.005937732,
    headingDegrees: 0,
    vertices: 236,
    indices: 360,
    sourceSha256: "1747d895d7156dd952adf375a6756ba923bd579532ae7abc9965c971354d110d",
    runtimeBytes: 3966348,
    runtimeSha256: "f3a2567b3f2b0b67d19925fa3a5013f3b08c800955232426250c397e08efec0b",
  }),
  Object.freeze({
    name: "KPHX_SkyTrainDepot_Exact",
    resource: "Misc/SkyTrainDepot.obj",
    runtime: "SkyTrainDepot.exact.glb",
    wedObjectId: 25741,
    latitude: 33.437999972,
    longitude: -111.983098207,
    headingDegrees: 54.95,
    vertices: 237,
    indices: 432,
    sourceSha256: "da86fa04ec5411d3d6c750b3048d96627e507fa026c5780031d07d362777ea1f",
    runtimeBytes: 3064488,
    runtimeSha256: "a81f8c474742aa29e1bc08dd2145154cc74aa09137a46ccc1b63be05d491ef11",
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

function configureExactLandmark(THREE, scene, object) {
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
    runtimeBytes: object.runtimeBytes,
    wedObjectId: object.wedObjectId,
    wedLatitude: object.latitude,
    wedLongitude: object.longitude,
    wedHeadingDegrees: object.headingDegrees,
    sourceVertexCount: object.vertices,
    sourceIndexCount: object.indices,
  };
  return scene;
}

export async function installSourceKphxLandmarks(THREE, environment, sourceAirportFrame) {
  if (!environment?.isGroup || !sourceAirportFrame?.isGroup) throw new Error("Exact KPHX landmark ingest requires the WED source airport frame");
  const loader = new GLTFLoader();
  const baseUrl = `${import.meta.env.BASE_URL}models/kphx/`;
  const loaded = await Promise.all(SOURCE_KPHX_LANDMARK_OBJECTS.map(async (object) => {
    const { scene } = await loader.loadAsync(`${baseUrl}${object.runtime}`);
    return configureExactLandmark(THREE, scene, object);
  }));
  const group = new THREE.Group();
  group.name = "KPHX_Landmark_Source_Objects";
  group.add(...loaded);
  group.userData.sourceAuthority = "exact-user-drive-kphx-1.75.1";
  group.userData.sourceObjectCount = loaded.length;
  sourceAirportFrame.add(group);
  sourceAirportFrame.updateMatrixWorld(true);
  environment.userData.sourceKphxLandmarks = group;
  environment.userData.sourceKphxLandmarkObjectCount = loaded.length;
  environment.userData.sourceKphxAuthoredBuildingCount = Number(environment.userData.sourceKphxAuthoredBuildingCount || 0) + loaded.length;
  environment.userData.environmentSource = "exact-user-drive-kphx-1.75.1-authored-airport-objects";
  return group;
}
