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

export const SOURCE_KPHX_TERMINAL3_OBJECTS = Object.freeze([
  Object.freeze({
    name: "KPHX_Terminal3_Exact",
    resource: "Terminals/Terminal3a.obj",
    runtime: "Terminal3a.exact.glb",
    wedObjectId: 7424,
    latitude: 33.436168819,
    longitude: -112.008763064,
    headingDegrees: 0,
    vertices: 6922,
    indices: 12138,
    sourceSha256: "4283b54b22abf73eef75259f22318153705efc8372a667fd3de89fbe8db70ea3",
    runtimeBytes: 18527808,
    runtimeSha256: "0297c2435a9f17a7aaf564c6f0198b6533637b527f2d0628bc918c383d894aa7",
  }),
  Object.freeze({
    name: "KPHX_Terminal3_Garage_Exact",
    resource: "Terminals/Terminal3Garage.obj",
    runtime: "Terminal3Garage.exact.glb",
    wedObjectId: 11792,
    latitude: 33.435447284,
    longitude: -112.008758475,
    headingDegrees: 0,
    vertices: 3457,
    indices: 6882,
    sourceSha256: "2767c7903df08c24fe1b1e23ab12c22574f51dea64cba0cdd6fce41372a7cc18",
    runtimeBytes: 2462736,
    runtimeSha256: "1c5f2d0ffd7b9b0103cc0b5f16606377f52ff6bf43e6da98d1561158ad564d1d",
  }),
]);

export const SOURCE_KPHX_PARKING_GARAGE_OBJECTS = Object.freeze([
  Object.freeze({
    name: "KPHX_ParkingGarage1_Exact",
    resource: "ParkingGarages/Garage1.obj",
    runtime: "Garage1.exact.glb",
    wedObjectId: 5549,
    latitude: 33.435534438,
    longitude: -111.998067084,
    headingDegrees: 0,
    vertices: 17899,
    indices: 35376,
    sourceSha256: "4220eefd706451a0edd1db0c5987baf5c69a8a95b56bd63a3ff53eed85e74891",
    runtimeBytes: 5214792,
    runtimeSha256: "82de257843b0433caa8a7253b2899ce25b96d0409aafb9ad0f77e41068be83bc",
  }),
  Object.freeze({
    name: "KPHX_ParkingGarage2_Exact",
    resource: "ParkingGarages/Garage2.obj",
    runtime: "Garage2.exact.glb",
    wedObjectId: 5551,
    latitude: 33.435535306,
    longitude: -112.001276178,
    headingDegrees: 0,
    vertices: 3018,
    indices: 6636,
    sourceSha256: "8dc2c4fc99f2c0b2518f66ec047cb6c55cac5e58827900a9745171cbfecc698d",
    runtimeBytes: 4678624,
    runtimeSha256: "1d81dbfa7e4286fffa2d5535f393e128117686abd0faef6d8c13bcf9f65cd5f1",
  }),
  Object.freeze({
    name: "KPHX_ParkingGarage3_Exact",
    resource: "ParkingGarages/Garage3.obj",
    runtime: "Garage3.exact.glb",
    wedObjectId: 7570,
    latitude: 33.435462794,
    longitude: -112.007022083,
    headingDegrees: 0,
    vertices: 5153,
    indices: 11886,
    sourceSha256: "d84e436d214bc1edf57f77f789299abe9c5e10a65e92e3b22f47749d0d4dd32a",
    runtimeBytes: 4757512,
    runtimeSha256: "7f22fe3e463f146cd3cb08edbb85ef4b2714ccc89e3ccacda1869f79f593bfbd",
  }),
  Object.freeze({
    name: "KPHX_ParkingGarage4_Exact",
    resource: "ParkingGarages/Garage4.obj",
    runtime: "Garage4.exact.glb",
    wedObjectId: 15855,
    latitude: 33.437094222,
    longitude: -112.013497290,
    headingDegrees: 0,
    vertices: 7735,
    indices: 13644,
    sourceSha256: "f75ddf1ffb8443c7dc0ba0fcebf068a3c81d59df0e046bc9f5e0e03b24fc37f6",
    runtimeBytes: 4773192,
    runtimeSha256: "d49a3f16caddaf4a92660c6972e5f930463d03c7bf2780605e713e91f84f44d9",
  }),
  Object.freeze({
    name: "KPHX_ParkingGarage5_Exact",
    resource: "ParkingGarages/Garage5.obj",
    runtime: "Garage5.exact.glb",
    wedObjectId: 19037,
    latitude: 33.434463430,
    longitude: -111.983220071,
    headingDegrees: -20.05,
    vertices: 3767,
    indices: 7884,
    sourceSha256: "26a2757ebea9dcc094cd54c6058b5108593e68b7bbf0929ae55dd79bc28705f7",
    runtimeBytes: 4704812,
    runtimeSha256: "18aaaf22ee4c6c1a92fd6b28a6a34f896933338547ad8dd6e0a61739dd376e0d",
  }),
  Object.freeze({
    name: "KPHX_ParkingGarage6_Exact",
    resource: "ParkingGarages/Garage6.obj",
    runtime: "Garage6.exact.glb",
    wedObjectId: 19038,
    latitude: 33.435431610,
    longitude: -111.983952911,
    headingDegrees: -19.24,
    vertices: 2949,
    indices: 6396,
    sourceSha256: "0817390b57200a170beccc9c3907938399461c61a0a41c174811b5d6209e40db",
    runtimeBytes: 4675624,
    runtimeSha256: "7cef68a716bfbc967c9a5e7ecec9680a7ddcefad4b73da6d125577a60bff785d",
  }),
]);

export const SOURCE_KPHX_AUTHORED_BUILDING_OBJECTS = Object.freeze([
  ...SOURCE_KPHX_TERMINAL4_OBJECTS,
  ...SOURCE_KPHX_TERMINAL3_OBJECTS,
  ...SOURCE_KPHX_PARKING_GARAGE_OBJECTS,
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

async function loadExactObjectGroup(loader, THREE, baseUrl, name, objects) {
  const group = new THREE.Group();
  group.name = name;
  const loaded = await Promise.all(objects.map(async (object) => {
    const { scene } = await loader.loadAsync(`${baseUrl}${object.runtime}`);
    return configureExactModel(THREE, scene, object);
  }));
  group.add(...loaded);
  group.userData.sourceAuthority = "exact-user-drive-kphx-1.75.1";
  group.userData.sourceObjectCount = loaded.length;
  return { group, loaded };
}

export async function installSourceKphxTerminal4Visual(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  hideLegacyCalibrationTerminal(environment);

  const loader = new GLTFLoader();
  const baseUrl = `${import.meta.env.BASE_URL}models/kphx/`;
  const [terminal4Result, terminal3Result, garageResult] = await Promise.all([
    loadExactObjectGroup(loader, THREE, baseUrl, "KPHX_Terminal4_Source_Objects", SOURCE_KPHX_TERMINAL4_OBJECTS),
    loadExactObjectGroup(loader, THREE, baseUrl, "KPHX_Terminal3_Source_Objects", SOURCE_KPHX_TERMINAL3_OBJECTS),
    loadExactObjectGroup(loader, THREE, baseUrl, "KPHX_ParkingGarage_Source_Objects", SOURCE_KPHX_PARKING_GARAGE_OBJECTS),
  ]);

  const sourceAirportFrame = new THREE.Group();
  sourceAirportFrame.name = "KPHX_1_75_1_WED_Source_Frame";
  sourceAirportFrame.position.fromArray(SOURCE_KPHX_A1_ORIGIN.browserPosition);
  // All authored airport objects share one geospatial transform. WED A1 points
  // west; rotate the complete source airport once so that source gate heading
  // matches RampReady's existing aircraft-forward +Z axis.
  sourceAirportFrame.rotation.y = THREE.MathUtils.degToRad(90);
  sourceAirportFrame.add(terminal4Result.group, terminal3Result.group, garageResult.group);
  environment.add(sourceAirportFrame);
  sourceAirportFrame.updateMatrixWorld(true);

  const a1Point = new THREE.Vector3(...SOURCE_KPHX_A1_ORIGIN.browserPosition);
  const nearest = nearestHorizontalVertexDistance(THREE, terminal4Result.group, a1Point);

  environment.userData.environmentSource = "exact-user-drive-kphx-1.75.1-authored-buildings";
  environment.userData.sourceKphxAirportFrame = sourceAirportFrame;
  environment.userData.sourceKphxAuthoredBuildingCount = SOURCE_KPHX_AUTHORED_BUILDING_OBJECTS.length;
  environment.userData.sourceKphxTerminal4ObjectCount = terminal4Result.loaded.length;
  environment.userData.sourceKphxTerminal3ObjectCount = terminal3Result.loaded.length;
  environment.userData.sourceKphxParkingGarageObjectCount = garageResult.loaded.length;
  environment.userData.sourceKphxAuthority = "user-drive-kphx-1.75.1";
  environment.userData.sourceKphxA1Origin = SOURCE_KPHX_A1_ORIGIN;
  environment.userData.sourceKphxTerminal4Objects = SOURCE_KPHX_TERMINAL4_OBJECTS;
  environment.userData.sourceKphxTerminal3Objects = SOURCE_KPHX_TERMINAL3_OBJECTS;
  environment.userData.sourceKphxParkingGarageObjects = SOURCE_KPHX_PARKING_GARAGE_OBJECTS;

  // Preserve Terminal 4 compatibility metadata while the trainer's old data-
  // attribute surface is migrated. The authority object is the T4 subgroup,
  // not the entire airport, so A1 wall/jetway measurements cannot accidentally
  // select a remote Terminal 3 or parking-garage mesh.
  environment.userData.authoredTerminal4 = terminal4Result.group;
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
  environment.userData.authoredTerminal4JetwayDetailLevel = "exact-WED-jetway-placement-authority";
  environment.userData.authoredTerminal4JetwayTextureAuthority = "exact-uploaded-airport-jetway-visible-model-plus-WED-placement";
  environment.userData.authoredTerminal4ExactJetwayTextureActive = true;

  return sourceAirportFrame;
}
