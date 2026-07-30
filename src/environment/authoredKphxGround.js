import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { installKphxRunwayVisuals } from "./kphxRunwayVisuals.js";
import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";

const TERMINAL4_PARKINGS = Object.freeze([...concourseA.parkings, ...concourseB.parkings]);
const TERMINAL4_JETWAYS = Object.freeze([...concourseA.jetways, ...concourseB.jetways]);
const B15_GATE_NAMES = new Set(["B15L", "B15M"]);
const MARKING_MATERIALS = new Set(["yellow-marking", "white-marking"]);

export const AUTHORED_KPHX_GROUND_PROFILE = Object.freeze({
  source: "TheMainlineCowboy/SkyHarborPhx@7ee8f9b4712f842706f00aa5a307e8861b601620/scenery/KPHX_ADEX.BGL",
  updatedSource: "unmlobo-kphx 1.8.1 / scenery/world/scenery/kphx-airport.bgl",
  surfaceTextures: Object.freeze({
    concrete: "models/phx-terminal4/textures/PARKRAMPS.png",
    serviceRoad: "models/phx-terminal4/textures/PARKRAMP1.png",
    asphalt: "models/phx-terminal4/textures/RW.png",
  }),
  anchorGate: "A1",
  anchorParkingIndex: 32,
  anchorHeadingDegrees: 269.975341796875,
  coordinateFrame: "A1-local; X=north, Y=up, Z=east; authored A1 heading faces scene -Z",
  sceneOffset: Object.freeze([0, 0, 6.2]),
  packageVersion: "1.8.1",
  detailLevel: "terminal4-authored-pavement-v5-source-ramp-stand-markings",
  surfaceMaterialMode: "authored-pavement-nearfield-over-source-aerial-background",
  sourceJetwayCount: 112,
  terminal4JetwayCount: TERMINAL4_JETWAYS.length,
  terminal4ParkingCount: TERMINAL4_PARKINGS.length,
  taxiwayPoints: 870,
  taxiwayPaths: 1302,
  parkingStands: 240,
  apronTriangles: 1860,
  pathSurfaces: 958,
  markingSegments: 1208,
});

const CALIBRATION_NAMES = new Set([
  "Terminal4RampSurface", "RampExpansionJointX", "RampExpansionJointZ",
  "CalibrationCenterline", "TrainingStopBar", "ServiceRoadSurface",
  "ServiceRoadDash", "UnassignedGateLeadIn", "RampLightPole", "RampLight",
]);

function hideCalibrationGround(environment) {
  environment.traverse((node) => {
    if (CALIBRATION_NAMES.has(node.name)) node.visible = false;
  });
}

function configureSourceTexture(THREE, texture, name) {
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function configureNearfieldTexture(THREE, texture, name, colorSpace) {
  texture.name = name;
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  // The ADEX glTF uses one UV repeat per 64 meters. Two repeats makes this
  // source strip a 32-meter tile: roughly 4-meter rows and 5-meter slab bays,
  // matching apron concrete instead of the sidewalk-scale first pass.
  texture.repeat.set(2, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function buildSourceConcreteNearfieldTextures(THREE, sourceTexture) {
  const image = sourceTexture.image;
  if (!image?.width || !image?.height) throw new Error("PHX supplied concrete source texture did not decode");

  const sourceWidth = Math.min(192, image.width);
  const sourceHeight = Math.min(34, image.height);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = 256;
  sourceCanvas.height = 256;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("PHX source-detail canvas is unavailable");
  sourceContext.imageSmoothingEnabled = true;

  // PARKRAMPS is an atlas. Its upper-left strip is the package's clean authored
  // concrete: real slab edges and fine variation, without the jetway rotundas or
  // black atlas separators. Repeat only that exact strip across the detail tile.
  const rowHeight = 32;
  for (let y = 0; y < sourceCanvas.height; y += rowHeight) {
    sourceContext.drawImage(image, 0, 1, sourceWidth, sourceHeight, 0, y, sourceCanvas.width, rowHeight);
  }

  const sourcePixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  let luminanceTotal = 0;
  const pixelCount = sourcePixels.data.length / 4;
  for (let index = 0; index < sourcePixels.data.length; index += 4) {
    luminanceTotal += sourcePixels.data[index] * 0.2126 + sourcePixels.data[index + 1] * 0.7152 + sourcePixels.data[index + 2] * 0.0722;
  }
  const meanLuminance = luminanceTotal / pixelCount;

  const detailCanvas = document.createElement("canvas");
  detailCanvas.width = sourceCanvas.width;
  detailCanvas.height = sourceCanvas.height;
  const detailContext = detailCanvas.getContext("2d", { willReadFrequently: true });
  if (!detailContext) throw new Error("PHX source-detail decal canvas is unavailable");
  const detailPixels = detailContext.createImageData(detailCanvas.width, detailCanvas.height);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = sourceCanvas.width;
  bumpCanvas.height = sourceCanvas.height;
  const bumpContext = bumpCanvas.getContext("2d", { willReadFrequently: true });
  if (!bumpContext) throw new Error("PHX source-bump canvas is unavailable");
  const bumpPixels = bumpContext.createImageData(bumpCanvas.width, bumpCanvas.height);

  for (let index = 0; index < sourcePixels.data.length; index += 4) {
    const red = sourcePixels.data[index];
    const green = sourcePixels.data[index + 1];
    const blue = sourcePixels.data[index + 2];
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const darkness = Math.max(0, meanLuminance - luminance);

    // Tug-height pavement must not depend on the airport-wide aerial, which is
    // only about one source pixel per 1.2-1.3 meters. Convert the supplied clean
    // concrete strip into an opaque apron tile, then add deterministic broad wear
    // and fine grain so the same slab atlas does not read as a repeated grid.
    const pixel = index / 4;
    const pixelX = pixel % sourceCanvas.width;
    const pixelY = Math.floor(pixel / sourceCanvas.width);
    const broadWear = Math.sin(pixelX * 0.041) * 7.5
      + Math.cos(pixelY * 0.033) * 6
      + Math.sin((pixelX + pixelY) * 0.017) * 4;
    const hash = ((pixelX * 374761393 + pixelY * 668265263) ^ ((pixelX + pixelY) * 1274126177)) >>> 0;
    const grain = (hash % 19) - 9;
    const detail = Math.max(104, Math.min(202,
      156 + (luminance - meanLuminance) * 0.68 - darkness * 0.10 + broadWear + grain * 0.38,
    ));
    detailPixels.data[index] = Math.min(255, detail + 5);
    detailPixels.data[index + 1] = Math.min(255, detail + 4);
    detailPixels.data[index + 2] = Math.min(255, detail + 1);
    detailPixels.data[index + 3] = 255;

    const bump = Math.max(0, Math.min(255, 128 + (luminance - meanLuminance) * 2.4));
    bumpPixels.data[index] = bump;
    bumpPixels.data[index + 1] = bump;
    bumpPixels.data[index + 2] = bump;
    bumpPixels.data[index + 3] = 255;
  }
  detailContext.putImageData(detailPixels, 0, 0);
  bumpContext.putImageData(bumpPixels, 0, 0);

  return {
    albedo: configureNearfieldTexture(
      THREE,
      new THREE.CanvasTexture(detailCanvas),
      "PHX supplied PARKRAMPS opaque near-field concrete",
      THREE.SRGBColorSpace,
    ),
    bump: configureNearfieldTexture(
      THREE,
      new THREE.CanvasTexture(bumpCanvas),
      "PHX supplied PARKRAMPS near-field concrete bump",
      THREE.NoColorSpace,
    ),
  };
}

async function loadAuthoredSurfaceTextures(THREE) {
  const baseUrl = import.meta.env.BASE_URL;
  const loader = new THREE.TextureLoader();
  const [concrete, serviceRoad, asphalt] = await Promise.all([
    loader.loadAsync(`${baseUrl}${AUTHORED_KPHX_GROUND_PROFILE.surfaceTextures.concrete}`),
    loader.loadAsync(`${baseUrl}${AUTHORED_KPHX_GROUND_PROFILE.surfaceTextures.serviceRoad}`),
    loader.loadAsync(`${baseUrl}${AUTHORED_KPHX_GROUND_PROFILE.surfaceTextures.asphalt}`),
  ]);
  const concreteSource = configureSourceTexture(THREE, concrete, "PHX supplied PARKRAMPS atlas source");
  return {
    concreteSource,
    serviceRoadSource: configureSourceTexture(THREE, serviceRoad, "PHX supplied PARKRAMP1 atlas source"),
    asphaltSource: configureSourceTexture(THREE, asphalt, "PHX supplied RW atlas source"),
    concrete: buildSourceConcreteNearfieldTextures(THREE, concreteSource),
  };
}

function configureAuthoredMarkingMaterial(material, node) {
  const yellow = material.name === "yellow-marking";
  material.visible = true;
  material.map = null;
  material.bumpMap = null;
  material.color.setHex(yellow ? 0xffcf00 : 0xf8f6ed);
  material.transparent = true;
  material.opacity = 1;
  material.depthWrite = false;
  material.depthTest = true;
  material.roughness = 0.72;
  material.metalness = 0;
  material.toneMapped = false;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -0.25;
  material.polygonOffsetUnits = -0.5;
  if (material.emissive?.setHex) {
    material.emissive.setHex(yellow ? 0x392d00 : 0x252522);
    material.emissiveIntensity = 0.22;
  }
  node.renderOrder = Math.max(node.renderOrder || 0, 24);
  material.userData = {
    ...(material.userData || {}),
    markingAuthority: "source-authored-kphx-adex",
    visibilityMode: "high-contrast-nearfield",
    contactMode: "pavement-coincident-decals",
  };
}

function applyAuthoredSurfaceMaterials(THREE, authored, textures) {
  let sourceDetailedSurfaceMaterialCount = 0;
  let enhancedMarkingMaterialCount = 0;
  authored.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.side = THREE.DoubleSide;
      material.map = null;
      material.bumpMap = null;
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.userData = {
        ...(material.userData || {}),
        diffuseAuthority: "authored-kphx-pavement-nearfield",
        sourceAtlasPolicy: "crop-clean-source-concrete-strip-never-repeat-entire-atlas",
      };

      if (material.name === "airport-base") {
        material.visible = false;
      } else if (material.name === "concrete") {
        material.visible = true;
        material.color.setHex(0xffffff);
        material.transparent = false;
        material.opacity = 1;
        material.alphaTest = 0;
        material.depthWrite = true;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.028;
        material.roughness = 0.96;
        material.metalness = 0;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -0.25;
        material.polygonOffsetUnits = -0.5;
        material.userData.nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 30);
        sourceDetailedSurfaceMaterialCount += 1;
      } else if (material.name === "asphalt") {
        material.visible = true;
        material.color.setHex(0x4f5456);
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.roughness = 0.98;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "opaque-authored-asphalt-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 20);
        sourceDetailedSurfaceMaterialCount += 1;
      } else if (material.name === "service-road") {
        material.visible = true;
        material.color.setHex(0x777976);
        material.transparent = false;
        material.opacity = 1;
        material.alphaTest = 0;
        material.depthWrite = true;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.014;
        material.roughness = 0.97;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "opaque-authored-service-road-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 35);
        sourceDetailedSurfaceMaterialCount += 1;
      } else if (MARKING_MATERIALS.has(material.name)) {
        configureAuthoredMarkingMaterial(material, node);
        enhancedMarkingMaterialCount += 1;
      }
      material.needsUpdate = true;
    }
  });
  return { sourceDetailedSurfaceMaterialCount, enhancedMarkingMaterialCount };
}

function appendGroundStrip(positions, indices, a, b, width, y = 0.0022) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return;
  const nx = -dz / length * width / 2;
  const nz = dx / length * width / 2;
  const base = positions.length / 3;
  positions.push(
    a[0] + nx, y, a[1] + nz,
    b[0] + nx, y, b[1] + nz,
    b[0] - nx, y, b[1] - nz,
    a[0] - nx, y, a[1] - nz,
  );
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function buildGateLabel(THREE, gate, x, z, heading) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PHX gate-label canvas is unavailable");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(20, 22, 20, 0.88)";
  context.fillRect(4, 4, 248, 120);
  context.strokeStyle = "#f4c500";
  context.lineWidth = 12;
  context.strokeRect(8, 8, 240, 112);
  context.fillStyle = "#f4c500";
  context.font = "bold 72px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(gate, 128, 67);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  const geometry = new THREE.PlaneGeometry(4.6, 2.3);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -0.25,
    polygonOffsetUnits: -0.5,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `PHX_T4_GateLabel_${gate}`;
  mesh.position.set(x, 0.0028, z);
  mesh.rotation.y = Math.PI / 2 - heading;
  mesh.renderOrder = 28;
  return mesh;
}

function buildTerminal4StandMarkings(THREE) {
  const group = new THREE.Group();
  group.name = "PHX_T4_SourcePositionedStandMarkings";
  const positions = [];
  const indices = [];
  for (const parking of TERMINAL4_PARKINGS) {
    const heading = THREE.MathUtils.degToRad(parking.h);
    const hx = Math.cos(heading);
    const hz = Math.sin(heading);
    const px = parking.x;
    const pz = parking.z;
    const approach = [px + hx * 24, pz + hz * 24];
    const gateEnd = [px - hx * 14, pz - hz * 14];
    appendGroundStrip(positions, indices, approach, gateEnd, 0.20);
    const stopCenter = [px, pz];
    const sx = -hz * 3.2;
    const sz = hx * 3.2;
    appendGroundStrip(
      positions,
      indices,
      [stopCenter[0] - sx, stopCenter[1] - sz],
      [stopCenter[0] + sx, stopCenter[1] + sz],
      0.24,
      0.0024,
    );
    const labelX = px + hx * 18;
    const labelZ = pz + hz * 18;
    group.add(buildGateLabel(THREE, parking.g, labelX, labelZ, heading));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    color: 0xf4c500,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -0.25,
    polygonOffsetUnits: -0.5,
  });
  const lines = new THREE.Mesh(geometry, material);
  lines.name = "PHX_T4_StandCenterlinesAndStopBars";
  lines.renderOrder = 26;
  group.add(lines);
  group.userData.gateMarkingCount = TERMINAL4_PARKINGS.length;
  group.userData.detailLevel = "source-positioned-terminal4-stand-centerlines-labels-v2-door-aligned";
  return group;
}

function buildGateMetadata() {
  const offsetZ = AUTHORED_KPHX_GROUND_PROFILE.sceneOffset[2];
  const b15Anchors = TERMINAL4_PARKINGS
    .filter((parking) => B15_GATE_NAMES.has(parking.g))
    .map((parking) => ({
      gate: parking.g,
      x: parking.x,
      z: parking.z + offsetZ,
      headingDegrees: parking.h,
      distanceMeters: Math.hypot(parking.x, parking.z),
    }));
  return {
    b15Anchors,
    trainingCorridor: {
      startGate: "A1",
      endGates: b15Anchors.map((anchor) => anchor.gate),
      distanceMeters: b15Anchors.map((anchor) => anchor.distanceMeters),
      coordinateFrame: AUTHORED_KPHX_GROUND_PROFILE.coordinateFrame,
    },
  };
}

export async function installAuthoredKphxGround(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  environment.userData.groundSource = "loading-authored-kphx-v181";
  environment.userData.groundCoordinateFrame = AUTHORED_KPHX_GROUND_PROFILE.coordinateFrame;

  const url = `${import.meta.env.BASE_URL}models/kphx-ground/kphx-ground.gltf`;
  const [gltf, surfaceTextures] = await Promise.all([
    new GLTFLoader().loadAsync(url),
    loadAuthoredSurfaceTextures(THREE),
  ]);
  const authored = gltf.scene;
  authored.name = "PHX_KPHX_AuthoredAirportWideGround";
  authored.position.fromArray(AUTHORED_KPHX_GROUND_PROFILE.sceneOffset);
  // The ADEX extractor already emits A1-local X=north/Z=east coordinates and
  // explicitly registers the authored A1 heading to scene -Z. Rotating it a
  // second time was the cause of the wrong gate and wrong aircraft orientation.
  authored.rotation.y = 0;
  const materialState = applyAuthoredSurfaceMaterials(THREE, authored, surfaceTextures);
  const runwayVisuals = await installKphxRunwayVisuals(THREE, authored);
  const standMarkings = buildTerminal4StandMarkings(THREE);
  authored.add(standMarkings);

  environment.add(authored);
  hideCalibrationGround(environment);
  const metadata = buildGateMetadata();

  environment.userData.groundSource = "authored-kphx-v181-source-textured-nearfield";
  environment.userData.authoredGroundUrl = url;
  environment.userData.authoredGround = authored;
  environment.userData.authoredGroundSurfaceTextures = surfaceTextures;
  environment.userData.authoredGroundTexturedSurfaceMaterialCount = materialState.sourceDetailedSurfaceMaterialCount;
  environment.userData.authoredGroundEnhancedMarkingMaterialCount = materialState.enhancedMarkingMaterialCount;
  environment.userData.authoredGroundMarkingContactMode = "pavement-relative-millimeter-offset";
  environment.userData.kphxRunwayCount = runwayVisuals.userData.runwayCount;
  environment.userData.kphxRunwayIdentifierCount = runwayVisuals.userData.identifierCount;
  environment.userData.kphxRunwayLightCount = runwayVisuals.userData.lightCount;
  environment.userData.kphxRunwayVisualDetailLevel = runwayVisuals.userData.detailLevel;
  environment.userData.authoredGroundGateMarkingCount = standMarkings.userData.gateMarkingCount;
  environment.userData.authoredGroundStandMarkingDetailLevel = standMarkings.userData.detailLevel;
  environment.userData.authoredGroundSurfaceMaterialMode = AUTHORED_KPHX_GROUND_PROFILE.surfaceMaterialMode;
  environment.userData.kphxVersion = AUTHORED_KPHX_GROUND_PROFILE.packageVersion;
  environment.userData.kphxDetailLevel = AUTHORED_KPHX_GROUND_PROFILE.detailLevel;
  environment.userData.sourceJetwayCount = AUTHORED_KPHX_GROUND_PROFILE.sourceJetwayCount;
  environment.userData.terminal4JetwayCount = AUTHORED_KPHX_GROUND_PROFILE.terminal4JetwayCount;
  environment.userData.terminal4ParkingCount = AUTHORED_KPHX_GROUND_PROFILE.terminal4ParkingCount;
  environment.userData.b15Anchors = metadata.b15Anchors;
  environment.userData.trainingCorridor = metadata.trainingCorridor;
  environment.userData.authoredGroundCounts = {
    taxiwayPoints: AUTHORED_KPHX_GROUND_PROFILE.taxiwayPoints,
    taxiwayPaths: AUTHORED_KPHX_GROUND_PROFILE.taxiwayPaths,
    parkingStands: AUTHORED_KPHX_GROUND_PROFILE.parkingStands,
    apronTriangles: AUTHORED_KPHX_GROUND_PROFILE.apronTriangles,
    pathSurfaces: AUTHORED_KPHX_GROUND_PROFILE.pathSurfaces,
    markingSegments: AUTHORED_KPHX_GROUND_PROFILE.markingSegments,
  };
  return authored;
}
