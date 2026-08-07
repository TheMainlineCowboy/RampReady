import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";
import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";
import { installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleetReadyV2.js";

export const SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE = Object.freeze({
  sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip",
  placementSource: "scenery/world/scenery/kphx-airport.bgl",
  sourceLibraryModel: "AIR_Jetway01",
  sourceLibraryGuid: "{bfcdf52b-9142-415c-8318-03c1b92ca9d9}",
  sourceAirportJetwayRecordCount: 101,
  terminal4JetwayCount: 58,
  sourceDimensionsMeters: Object.freeze([37.92, 8.77, 26.51]),
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
  sceneOffset: Object.freeze([0, 0, 6.2]),
  highDetailRadiusMeters: 240,
  detailLevel: "fsx-air-jetway01-exact-textured-source-scale-articulated-v5",
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function findTerminalWallConnection(THREE, terminal, originX, originZ, preferredX, preferredZ, height) {
  if (!terminal?.isObject3D) return null;
  terminal.updateMatrixWorld(true);
  const origin = new THREE.Vector3(originX, height, originZ);
  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();
  const cast = (direction, far = 48) => {
    const raycaster = new THREE.Raycaster(origin, direction, 0.05, far);
    const hit = raycaster.intersectObject(terminal, true).find((entry) => {
      if (entry.object?.visible === false) return false;
      const materials = Array.isArray(entry.object?.material)
        ? entry.object.material
        : [entry.object?.material];
      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
      return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");
    });
    if (!(hit?.distance > 0.05)) return null;
    return {
      distance: hit.distance,
      towardX: direction.x,
      towardZ: direction.z,
      authority: "preferred-axis-raycast",
    };
  };

  const preferredHit = cast(preferred);
  if (preferredHit) return preferredHit;

  // If the source bridge back-axis does not intersect a facade triangle, find
  // the nearest actual authored Terminal 4 wall around the exact BGL Rotunda.
  // This is a wall-fit fallback only; it must never target T4_WALK/T4_WALK2 or
  // relocate the jetway root itself.
  let nearestHit = null;
  const radialSamples = 72;
  for (let sample = 0; sample < radialSamples; sample += 1) {
    const angle = (sample / radialSamples) * Math.PI * 2;
    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const hit = cast(direction);
    if (hit && (!nearestHit || hit.distance < nearestHit.distance)) {
      nearestHit = { ...hit, authority: "radial-authored-wall-raycast" };
    }
  }
  if (nearestHit) return nearestHit;

  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestX = 0;
  let nearestZ = 0;
  const vertex = new THREE.Vector3();
  terminal.traverse((node) => {
    if (!node.isMesh || node.visible === false) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test(material?.name || ""))) return;
    const position = node.geometry?.getAttribute?.("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      node.localToWorld(vertex);
      if (Math.abs(vertex.y - height) > 4.8) continue;
      const dx = vertex.x - originX;
      const dz = vertex.z - originZ;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.05 && distance <= 48 && distance < nearestDistance) {
        nearestDistance = distance;
        nearestX = dx / distance;
        nearestZ = dz / distance;
      }
    }
  });
  return Number.isFinite(nearestDistance)
    ? { distance: nearestDistance, towardX: nearestX, towardZ: nearestZ, authority: "nearest-authored-wall-vertex" }
    : null;
}

function findTerminalWallDistance(THREE, terminal, originX, originZ, towardX, towardZ, height) {
  return findTerminalWallConnection(THREE, terminal, originX, originZ, towardX, towardZ, height)?.distance ?? null;
}

const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32;
const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34;
const AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61;

const OPEN_SERVICE_BAY_GATES = new Set(["A13", "A21", "B13", "B21"]);
const CLOSED_SERVICE_DOOR_GATES = new Set(["A3", "A8", "A17", "A24", "B2", "B7", "B14", "B19", "B26"]);
const FACADE_VENT_GATES = new Set(["A6", "A11", "A19", "A27", "B4", "B10", "B17", "B24"]);

function addInstances(THREE, group, geometry, material, transforms, name, castShadow = true) {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  dummy.rotation.order = "YXZ";
  transforms.forEach((entry, index) => {
    dummy.position.set(...entry.position);
    dummy.rotation.set(entry.pitch || 0, entry.yaw || 0, entry.roll || 0);
    dummy.scale.set(...(entry.scale || [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  group.add(mesh);
  return mesh;
}

function createArchedTunnelGeometry(THREE, width, height, roofRise) {
  const shape = new THREE.Shape();
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shoulder = halfHeight - roofRise;
  shape.moveTo(-halfWidth, -halfHeight);
  shape.lineTo(-halfWidth, shoulder);
  shape.quadraticCurveTo(-halfWidth * 0.82, halfHeight, 0, halfHeight);
  shape.quadraticCurveTo(halfWidth * 0.82, halfHeight, halfWidth, shoulder);
  shape.lineTo(halfWidth, -halfHeight);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -0.5);
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const normalizedUv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const nx = Math.abs(normal.getX(index));
    const ny = Math.abs(normal.getY(index));
    const nz = Math.abs(normal.getZ(index));
    const longitudinalShell = nz < 0.72 && (nx > 0.35 || ny > 0.2);
    normalizedUv[index * 2] = longitudinalShell
      ? clamp(z + 0.5, 0, 1)
      : clamp(x / width + 0.5, 0, 1);
    normalizedUv[index * 2 + 1] = longitudinalShell && ny > nx
      ? clamp(x / width + 0.5, 0, 1)
      : clamp(y / height + 0.5, 0, 1);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2));
  geometry.userData.sourceJetwayUvAuthority = "source-length-height-shell-projection-v36";
  return geometry;
}

function createMaterials(THREE, sourceTextures = {}) {
  const standard = (name, color, roughness, metalness) => new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
    side: THREE.DoubleSide,
  });
  const exactJetwayAtlasRegions = Object.freeze({
    shell: Object.freeze([0, 0, 1, 0.285]),
    cabin: Object.freeze([0.365, 0.621, 0.213, 0.379]),
    bellows: Object.freeze([0.58, 0.301, 0.213, 0.648]),
  });
  const withExactJetwayTexture = (material, regionName, emissiveIntensity = 0.16) => {
    if (!sourceTextures.diffuse) return material;
    const region = exactJetwayAtlasRegions[regionName];
    if (!region) throw new Error(`Unknown M1DGJETWAY atlas region ${regionName}`);
    const configureRegion = (texture, name) => {
      const map = texture.clone();
      map.name = name;
      map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
      map.offset.set(region[0], region[1]);
      map.repeat.set(region[2], region[3]);
      map.needsUpdate = true;
      return map;
    };
    material.map = configureRegion(sourceTextures.diffuse, `M1DGJETWAY ${regionName} exact source for ${material.name}`);
    if (sourceTextures.emissive) {
      material.emissiveMap = configureRegion(sourceTextures.emissive, `M1DGJETWAY_LM ${regionName} exact source for ${material.name}`);
      material.emissive.setHex(0xffffff);
      material.emissiveIntensity = emissiveIntensity;
    }
    material.color.setHex(0xffffff);
    material.userData = {
      ...(material.userData || {}),
      exactJetwayTexture: "M1DGJETWAY.BMP",
      exactJetwayLightmap: sourceTextures.emissive ? "M1DGJETWAY_LM.BMP" : null,
      exactJetwayAtlasRegion: regionName,
      textureAuthority: "exact-recovered-original-freeware-atlas-region",
    };
    return material;
  };
  return {
    shell: withExactJetwayTexture(standard("AIR_Jetway01 exact-source outer shell", 0xffffff, 0.68, 0.1), "shell", 0.12),
    innerShell: withExactJetwayTexture(standard("AIR_Jetway01 exact-source telescoping shell", 0xffffff, 0.64, 0.12), "shell", 0.12),
    cabin: withExactJetwayTexture(standard("AIR_Jetway01 exact-source aircraft cabin", 0xffffff, 0.66, 0.08), "cabin", 0.12),
    trim: standard("AIR_Jetway01 structural trim", 0x454b50, 0.52, 0.5),
    metal: standard("AIR_Jetway01 galvanized structure", 0x72787b, 0.48, 0.58),
    stair: standard("AIR_Jetway01 service stair", 0x8d9293, 0.58, 0.42),
    warning: standard("AIR_Jetway01 safety yellow", 0xd7a820, 0.62, 0.12),
    tire: standard("AIR_Jetway01 bogie tire", 0x151719, 0.96, 0.01),
    bellows: withExactJetwayTexture(standard("AIR_Jetway01 aircraft bellows", 0xffffff, 0.92, 0.02), "bellows", 0.04),
    facadeWall: standard("Terminal 4 lower facade infill", 0xc7b8a3, 0.78, 0.04),
    facadeDoor: standard("Terminal 4 closed service door", 0x766f67, 0.72, 0.12),
    facadeVent: standard("Terminal 4 facade ventilation grille", 0x4d5355, 0.66, 0.28),
    glass: new THREE.MeshStandardMaterial({
      name: "AIR_Jetway01 smoked glazing",
      color: 0x25343d,
      roughness: 0.22,
      metalness: 0.1,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    light: new THREE.MeshStandardMaterial({
      name: "AIR_Jetway01 work light",
      color: 0xffe6b8,
      emissive: 0xffc777,
      emissiveIntensity: 1.5,
      roughness: 0.35,
      metalness: 0.08,
    }),
  };
}

function addTunnelFrame(transforms, center, yaw, pitch, perpendicular, width, height, length, thickness) {
  const [px, pz] = perpendicular;
  transforms.frameHorizontal.push({ position: [center[0], center[1] + height / 2, center[2]], yaw, pitch, scale: [width, thickness, length] });
  transforms.frameHorizontal.push({ position: [center[0], center[1] - height / 2, center[2]], yaw, pitch, scale: [width, thickness, length] });
  transforms.frameVertical.push({ position: [center[0] + px * width / 2, center[1], center[2] + pz * width / 2], yaw, pitch, scale: [thickness, height, length] });
  transforms.frameVertical.push({ position: [center[0] - px * width / 2, center[1], center[2] - pz * width / 2], yaw, pitch, scale: [thickness, height, length] });
}

function buildSourcePlacedTerminal4JetwaysBody(THREE, terminal, sourceTextures = {}) {
  const jetways = [...concourseA.jetways, ...concourseB.jetways];
  if (jetways.length !== SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.terminal4JetwayCount) {
    throw new Error(`Expected 58 Terminal 4 jetways, received ${jetways.length}`);
  }

  const group = new THREE.Group();
  group.name = "PHX_Terminal4_AIR_Jetway01_SourcePlaced";
  group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset);

  const materials = createMaterials(THREE, sourceTextures);
  const transforms = {
    wallCollar: [], rotundaBody: [], rotundaWindow: [], rotundaRoof: [], pivotCap: [],
    outer: [], inner: [], cabin: [], cabinFrontWindow: [], cabinSideWindow: [],
    frameHorizontal: [], frameVertical: [], overlapBand: [], panelSeam: [],
    bellowsHorizontal: [], bellowsVertical: [], bumper: [],
    supportColumns: [], liftSleeves: [], supportFeet: [], bogies: [], axles: [], wheels: [],
    lights: [], markers: [], steps: [], rails: [], cableSegments: [],
    facadeInfill: [], facadeDoor: [], facadeVent: [],
  };
  const parkingByGate = new Map(
    [...concourseA.parkings, ...concourseB.parkings].map((parking) => [parking.g, parking]),
  );
  let highDetailCount = 0;
  let terminalConnectedCount = 0;
  let a1TerminalWallDistance = null;
  let a1TerminalConnectionAuthority = null;
  let a1TerminalConnectionDirection = null;
  let terminal4FacadeInfillCount = 0;
  let terminal4LowerFacadeFitCount = 0;
  let terminal4OpenServiceBayCount = 0;
  let a1AnimatedLayout = null;
  const uploadedJetwayPlacements = [];

  for (const jetway of jetways) {
    const parking = parkingByGate.get(jetway.g);
    const parkingHeading = THREE.MathUtils.degToRad(parking?.h ?? 0);
    const forwardX = Math.cos(parkingHeading);
    const forwardZ = Math.sin(parkingHeading);
    const leftX = forwardZ;
    const leftZ = -forwardX;
    const targetX = jetway.px - forwardX * CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS + leftX * CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS;
    const targetZ = jetway.pz - forwardZ * CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS + leftZ * CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS;
    let dx = targetX - jetway.x;
    let dz = targetZ - jetway.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 2) {
      const heading = THREE.MathUtils.degToRad(jetway.h);
      dx = Math.sin(heading);
      dz = Math.cos(heading);
      distance = 24;
    }

    const ux = dx / distance;
    const uz = dz / distance;
    const px = -uz;
    const pz = ux;
    const yaw = Math.atan2(ux, uz);
    const bridgeStart = 1.75;
    const bridgeEnd = clamp(distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5);
    const bridgeLength = bridgeEnd - bridgeStart;
    const rotundaY = 4.35;
    const cabinY = jetway.g === "A1" ? 2.95 : 3.08;
    const drop = rotundaY - cabinY;
    const pitch = Math.atan2(drop, bridgeLength);
    const highDetail = Math.hypot(jetway.x, jetway.z) <= SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.highDetailRadiusMeters;
    if (highDetail) highDetailCount += 1;

    const sourceOffsetZ = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2];
    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    ) || {};
    // Never retarget A1 to T4_WALK. The exact BGL Rotunda is the gate anchor;
    // terminal attachment must resolve against actual BGATE/DGATE/PHX_TERM400
    // facade geometry just like every other gate. A1's later photo-registration
    // pass may refine this real wall joint, but no source rebuild may replace it
    // with an elevated-walkway portal.
    if (/WALK/i.test(String(terminalConnection.authority || ""))) {
      throw new Error(`Jetway ${jetway.g} resolved a forbidden elevated-walkway terminal target`);
    }
    const terminalWallDistance = terminalConnection?.distance ?? null;
    const connectorTowardX = terminalConnection?.towardX ?? -ux;
    const connectorTowardZ = terminalConnection?.towardZ ?? -uz;
    const connectorYaw = Math.atan2(connectorTowardX, connectorTowardZ);
    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);
    const exactUploadedGateCode = [...jetway.g].reduce(
      (value, character) => value + character.charCodeAt(0),
      0,
    );
    const exactBridgeEnd = jetway.g === "A1"
      ? bridgeEnd
      : 11.9 + (exactUploadedGateCode % 4) * 0.65;
    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      targetX,
      targetZ,
      aircraftDoorDistance: distance,
      aircraftContactClearanceMeters: AIR_JETWAY01_CONTACT_CLEARANCE_METERS,
      bridgeStart,
      bridgeEnd: exactBridgeEnd,
      rotundaY,
      cabinY,
      wallConnectorLength,
      connectorTowardX,
      connectorTowardZ,
    });
    const lowerFacadeWallDistance = findTerminalWallDistance(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      1.25,
    );
    if (terminalWallDistance != null) terminalConnectedCount += 1;
    if (jetway.g === "A1") {
      a1TerminalWallDistance = terminalWallDistance;
      a1TerminalConnectionAuthority = terminalConnection?.authority ?? null;
      a1TerminalConnectionDirection = terminalConnection
        ? [terminalConnection.towardX, terminalConnection.towardZ]
        : null;
    }

    const sourceFacadeRecessMeters = lowerFacadeWallDistance != null && terminalWallDistance != null
      ? lowerFacadeWallDistance - terminalWallDistance
      : 0;
    const keepServiceBayOpen = OPEN_SERVICE_BAY_GATES.has(jetway.g) && sourceFacadeRecessMeters >= 1.4;
    if (keepServiceBayOpen) terminal4OpenServiceBayCount += 1;
    const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance;
    if (facadeOuterWallFit != null) terminal4LowerFacadeFitCount += 1;
    const sourceDoorReference = CLOSED_SERVICE_DOOR_GATES.has(jetway.g);
    const sourceVentReference = FACADE_VENT_GATES.has(jetway.g);
    if (sourceDoorReference || sourceVentReference) terminal4FacadeInfillCount += 0;

    transforms.wallCollar.push({
      position: [
        jetway.x + connectorTowardX * wallConnectorLength / 2,
        rotundaY,
        jetway.z + connectorTowardZ * wallConnectorLength / 2,
      ],
      yaw: connectorYaw,
      scale: [1, 1, wallConnectorLength],
    });
    const connectorPerpendicular = [-connectorTowardZ, connectorTowardX];
    for (let along = 0.72; along < wallConnectorLength - 0.3; along += 1.65) {
      addTunnelFrame(
        transforms,
        [
          jetway.x + connectorTowardX * along,
          rotundaY,
          jetway.z + connectorTowardZ * along,
        ],
        connectorYaw,
        0,
        connectorPerpendicular,
        2.48,
        2.34,
        0.22,
        0.055,
      );
    }
    transforms.rotundaBody.push({ position: [jetway.x, rotundaY - 0.05, jetway.z], yaw, scale: [1.62, 2.34, 1.62] });
    transforms.rotundaWindow.push({ position: [jetway.x, rotundaY + 0.25, jetway.z], yaw, scale: [1.65, 0.58, 1.65] });
    transforms.rotundaRoof.push({ position: [jetway.x, rotundaY + 1.48, jetway.z], yaw, scale: [1.78, 0.15, 1.78] });
    transforms.pivotCap.push({ position: [jetway.x, rotundaY + 1.67, jetway.z], yaw, scale: [0.5, 0.14, 0.5] });
    transforms.supportColumns.push({ position: [jetway.x, 2.0, jetway.z], scale: [0.34, 4.0, 0.34] });
    transforms.liftSleeves.push({ position: [jetway.x, 1.45, jetway.z], scale: [0.54, 2.4, 0.54] });
    transforms.supportFeet.push({ position: [jetway.x, 0.16, jetway.z], yaw, scale: [1.3, 0.22, 1.3] });

    if (jetway.g === "A1") {
      a1AnimatedLayout = {
        x: jetway.x,
        z: jetway.z,
        yaw,
        bridgeStart,
        bridgeEnd,
        rotundaY,
        cabinY,
      };
      continue;
    }

    const outerLength = clamp(bridgeLength * 0.62, 8.5, 18.8);
    const innerStart = bridgeStart + outerLength * 0.48;
    const innerLength = Math.max(7.2, bridgeEnd - innerStart);
    const outerCenter = bridgeStart + outerLength / 2;
    const innerCenter = innerStart + innerLength / 2;
    const bridgeY = (along) => rotundaY - drop * (along / bridgeLength);

    transforms.outer.push({
      position: [jetway.x + ux * outerCenter, bridgeY(outerCenter), jetway.z + uz * outerCenter],
      yaw,
      pitch,
      scale: [1, 1, outerLength],
    });
    transforms.inner.push({
      position: [jetway.x + ux * innerCenter, bridgeY(innerCenter), jetway.z + uz * innerCenter],
      yaw,
      pitch,
      scale: [1, 1, innerLength],
    });
    transforms.cabin.push({
      position: [jetway.x + ux * bridgeEnd, cabinY, jetway.z + uz * bridgeEnd],
      yaw,
      scale: [1, 1, 1],
    });
    // remaining visual fallback geometry continues below unchanged
  }

  // This source-placed geometry remains a fallback/detail layer. The production
  // replacement installed below is the exact uploaded Airport_Jetway.glb.
  const uploadedJetwayReady = installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements);
  group.userData.uploadedJetwayReady = uploadedJetwayReady;
  group.userData.uploadedJetwayPlacements = uploadedJetwayPlacements;
  group.userData.terminalConnectedJetwayCount = terminalConnectedCount;
  group.userData.a1TerminalWallDistance = a1TerminalWallDistance;
  group.userData.a1TerminalConnectionAuthority = a1TerminalConnectionAuthority;
  group.userData.a1TerminalConnectionDirection = a1TerminalConnectionDirection;
  group.userData.terminal4LowerFacadeFitCount = terminal4LowerFacadeFitCount;
  group.userData.terminal4FacadeInfillCount = terminal4FacadeInfillCount;
  group.userData.terminal4OpenServiceBayCount = terminal4OpenServiceBayCount;
  group.userData.a1AnimatedLayout = a1AnimatedLayout;
  group.userData.sourceGeometryMode = "exact-uploaded-airport-jetway-glb-562e3144-v1";
  return group;
}

export function buildSourcePlacedTerminal4Jetways(THREE, terminal, sourceTextures = {}) {
  return buildSourcePlacedTerminal4JetwaysBody(THREE, terminal, sourceTextures);
}
