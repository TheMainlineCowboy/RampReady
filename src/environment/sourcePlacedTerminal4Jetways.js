import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";

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
  detailLevel: "fsx-air-jetway01-faithful-articulated-v2",
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function findTerminalWallDistance(THREE, terminal, originX, originZ, towardX, towardZ, height) {
  if (!terminal?.isObject3D) return null;
  terminal.updateMatrixWorld(true);
  const direction = new THREE.Vector3(towardX, 0, towardZ).normalize();
  const origin = new THREE.Vector3(originX, height, originZ);
  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 24);
  const hit = raycaster.intersectObject(terminal, true).find((entry) => entry.object?.visible !== false);
  if (hit?.distance > 0.05) return hit.distance;

  // Some legacy terminal pieces are single-sided or contain no ray-facing triangle.
  // Fall back to the nearest source vertex inside a narrow rearward corridor.
  let nearest = Number.POSITIVE_INFINITY;
  const vertex = new THREE.Vector3();
  terminal.traverse((node) => {
    if (!node.isMesh || node.visible === false) return;
    const position = node.geometry?.getAttribute?.("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      node.localToWorld(vertex);
      if (Math.abs(vertex.y - height) > 4.8) continue;
      const dx = vertex.x - originX;
      const dz = vertex.z - originZ;
      const longitudinal = dx * towardX + dz * towardZ;
      if (!(longitudinal > 0.05 && longitudinal <= 24)) continue;
      const lateral = Math.abs(dx * -towardZ + dz * towardX);
      if (lateral <= 4.5) nearest = Math.min(nearest, longitudinal);
    }
  });
  return Number.isFinite(nearest) ? nearest : null;
}

const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1;
const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55;
// The cabin and seven bellows folds extend 2.61 meters beyond bridgeEnd.
// Keep that assembly just outside the aircraft skin instead of driving it
// through the cockpit/fuselage centerline.
const AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.78;

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
  return geometry;
}

function createMaterials(THREE) {
  const standard = (name, color, roughness, metalness) => new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
    side: THREE.DoubleSide,
  });
  return {
    shell: standard("AIR_Jetway01 warm-gray outer shell", 0xb6b8b8, 0.66, 0.16),
    innerShell: standard("AIR_Jetway01 telescoping inner shell", 0xa4a8aa, 0.62, 0.2),
    cabin: standard("AIR_Jetway01 aircraft cabin", 0xc0c1bf, 0.64, 0.15),
    trim: standard("AIR_Jetway01 structural trim", 0x454b50, 0.52, 0.5),
    metal: standard("AIR_Jetway01 galvanized structure", 0x72787b, 0.48, 0.58),
    stair: standard("AIR_Jetway01 service stair", 0x8d9293, 0.58, 0.42),
    warning: standard("AIR_Jetway01 safety yellow", 0xd7a820, 0.62, 0.12),
    tire: standard("AIR_Jetway01 bogie tire", 0x151719, 0.96, 0.01),
    bellows: standard("AIR_Jetway01 aircraft bellows", 0x1b1e21, 0.92, 0.02),
    glass: new THREE.MeshStandardMaterial({
      name: "AIR_Jetway01 smoked glazing",
      color: 0x25343d,
      roughness: 0.22,
      metalness: 0.1,
      transparent: true,
      opacity: 0.78,
      depthWrite: true,
      side: THREE.DoubleSide,
    }),
    light: new THREE.MeshStandardMaterial({
      name: "AIR_Jetway01 work light",
      color: 0xffe9b0,
      emissive: 0xffcf72,
      emissiveIntensity: 1.6,
      roughness: 0.32,
      metalness: 0.1,
    }),
    marker: new THREE.MeshStandardMaterial({
      name: "AIR_Jetway01 red safety marker",
      color: 0x9c2723,
      roughness: 0.68,
      metalness: 0.08,
    }),
  };
}

function addTunnelFrame(transforms, center, yaw, pitch, perpendicular, width, height, roofRise, depth = 0.065) {
  const [cx, cy, cz] = center;
  const [px, pz] = perpendicular;
  const halfWidth = width / 2;
  const shoulderY = height / 2 - roofRise * 0.48;
  for (const side of [-1, 1]) {
    transforms.frameVertical.push({
      position: [cx + px * side * halfWidth, cy - roofRise * 0.18, cz + pz * side * halfWidth],
      yaw,
      pitch,
      scale: [depth, height - roofRise * 0.35, depth],
    });
  }
  transforms.frameHorizontal.push({ position: [cx, cy - height / 2, cz], yaw, pitch, scale: [width, depth, depth] });
  transforms.frameHorizontal.push({ position: [cx, cy + shoulderY, cz], yaw, pitch, scale: [width * 0.82, depth, depth] });
  transforms.frameHorizontal.push({ position: [cx, cy + height / 2, cz], yaw, pitch, scale: [width * 0.38, depth, depth] });
}

function addServiceStairs(transforms, origin, yaw, direction, perpendicular) {
  const [ox, oz] = origin;
  const [ux, uz] = direction;
  const [px, pz] = perpendicular;
  for (let index = 0; index < 8; index += 1) {
    const height = 0.16 + index * 0.21;
    const along = index * 0.32;
    transforms.steps.push({
      position: [ox + ux * along, height / 2, oz + uz * along],
      yaw,
      scale: [1.28, height, 0.34],
    });
  }
  for (const side of [-1, 1]) {
    transforms.rails.push({
      position: [ox + ux * 1.1 + px * side * 0.68, 0.92, oz + uz * 1.1 + pz * side * 0.68],
      yaw,
      pitch: -0.48,
      scale: [0.045, 0.045, 2.8],
    });
    transforms.rails.push({
      position: [ox + ux * 2.1 + px * side * 0.68, 1.55, oz + uz * 2.1 + pz * side * 0.68],
      yaw,
      scale: [0.045, 0.045, 1.45],
    });
  }
}

export function buildSourcePlacedTerminal4Jetways(THREE, terminal) {
  const jetways = [...concourseA.jetways, ...concourseB.jetways];
  if (jetways.length !== SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.terminal4JetwayCount) {
    throw new Error(`Expected 58 Terminal 4 jetways, received ${jetways.length}`);
  }

  const group = new THREE.Group();
  group.name = "PHX_Terminal4_AIR_Jetway01_SourcePlaced";
  group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset);

  const materials = createMaterials(THREE);
  const transforms = {
    wallCollar: [], rotundaBody: [], rotundaWindow: [], rotundaRoof: [], pivotCap: [],
    outer: [], inner: [], cabin: [], cabinFrontWindow: [], cabinSideWindow: [],
    frameHorizontal: [], frameVertical: [], overlapBand: [], panelSeam: [],
    bellowsHorizontal: [], bellowsVertical: [], bumper: [],
    supportColumns: [], liftSleeves: [], supportFeet: [], bogies: [], axles: [], wheels: [],
    lights: [], markers: [], steps: [], rails: [], cableSegments: [],
  };
  const parkingByGate = new Map(
    [...concourseA.parkings, ...concourseB.parkings].map((parking) => [parking.g, parking]),
  );
  let highDetailCount = 0;
  let terminalConnectedCount = 0;
  let a1TerminalWallDistance = null;

  for (const jetway of jetways) {
    const parking = parkingByGate.get(jetway.g);
    const parkingHeading = THREE.MathUtils.degToRad(parking?.h ?? 0);
    const forwardX = Math.cos(parkingHeading);
    const forwardZ = Math.sin(parkingHeading);
    const leftX = forwardZ;
    const leftZ = -forwardX;
    // Source parking coordinates describe the nose-gear stop point. A passenger
    // boarding bridge terminates at the CRJ forward-left cabin door.
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
    const bridgeStart = 2.35;
    const bridgeEnd = clamp(distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 13.5, 30.5);
    const bridgeLength = bridgeEnd - bridgeStart;
    const rotundaY = 4.62;
    const cabinY = jetway.g === "A1" ? 3.05 : 3.2;
    const drop = rotundaY - cabinY;
    const pitch = Math.atan2(drop, bridgeLength);
    const highDetail = Math.hypot(jetway.x, jetway.z) <= SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.highDetailRadiusMeters;
    if (highDetail) highDetailCount += 1;

    const sourceOffsetZ = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2];
    const terminalWallDistance = findTerminalWallDistance(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );
    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);
    if (terminalWallDistance != null) terminalConnectedCount += 1;
    if (jetway.g === "A1") a1TerminalWallDistance = terminalWallDistance;
    transforms.wallCollar.push({
      position: [
        jetway.x - ux * wallConnectorLength / 2,
        rotundaY,
        jetway.z - uz * wallConnectorLength / 2,
      ],
      yaw,
      scale: [3.6, 3.1, wallConnectorLength],
    });
    transforms.rotundaBody.push({ position: [jetway.x, rotundaY - 0.05, jetway.z], yaw, scale: [2.1, 2.75, 2.1] });
    transforms.rotundaWindow.push({ position: [jetway.x, rotundaY + 0.25, jetway.z], yaw, scale: [2.13, 0.78, 2.13] });
    transforms.rotundaRoof.push({ position: [jetway.x, rotundaY + 1.48, jetway.z], yaw, scale: [2.28, 0.18, 2.28] });
    transforms.pivotCap.push({ position: [jetway.x, rotundaY + 1.67, jetway.z], yaw, scale: [0.62, 0.18, 0.62] });
    transforms.supportColumns.push({ position: [jetway.x, 2.0, jetway.z], scale: [0.34, 4.0, 0.34] });
    transforms.liftSleeves.push({ position: [jetway.x, 1.45, jetway.z], scale: [0.54, 2.4, 0.54] });
    transforms.supportFeet.push({ position: [jetway.x, 0.16, jetway.z], yaw, scale: [1.8, 0.26, 1.8] });

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
    transforms.overlapBand.push({
      position: [jetway.x + ux * (innerStart + 0.16), bridgeY(innerStart + 0.16), jetway.z + uz * (innerStart + 0.16)],
      yaw,
      pitch,
      scale: [3.12, 2.52, 0.22],
    });

    if (highDetail) {
      const ribSpacing = 1.35;
      for (let along = bridgeStart + 0.65; along < bridgeStart + outerLength - 0.35; along += ribSpacing) {
        addTunnelFrame(
          transforms,
          [jetway.x + ux * along, bridgeY(along), jetway.z + uz * along],
          yaw,
          pitch,
          [px, pz],
          3.25,
          2.62,
          0.36,
        );
      }
      for (let along = innerStart + 0.55; along < bridgeEnd - 0.7; along += ribSpacing) {
        addTunnelFrame(
          transforms,
          [jetway.x + ux * along, bridgeY(along), jetway.z + uz * along],
          yaw,
          pitch,
          [px, pz],
          2.94,
          2.42,
          0.32,
        );
      }
      for (const side of [-1, 1]) {
        const sideOffset = side * 1.55;
        for (let along = bridgeStart + 1.15; along < bridgeEnd - 1.1; along += 2.7) {
          transforms.panelSeam.push({
            position: [jetway.x + ux * along + px * sideOffset, bridgeY(along), jetway.z + uz * along + pz * sideOffset],
            yaw,
            pitch,
            scale: [0.035, 2.15, 0.055],
          });
        }
      }
    }

    const endX = jetway.x + ux * bridgeEnd;
    const endZ = jetway.z + uz * bridgeEnd;
    transforms.cabin.push({ position: [endX, cabinY, endZ], yaw, scale: [1, 1, 3.15] });
    transforms.cabinFrontWindow.push({
      position: [endX + ux * 1.61, cabinY + 0.34, endZ + uz * 1.61],
      yaw,
      scale: [2.48, 0.82, 0.055],
    });
    for (const side of [-1, 1]) {
      transforms.cabinSideWindow.push({
        position: [endX + px * side * 1.49, cabinY + 0.25, endZ + pz * side * 1.49],
        yaw,
        scale: [0.055, 0.72, 1.75],
      });
      transforms.lights.push({
        position: [endX + ux * 1.72 + px * side * 1.12, cabinY + 0.88, endZ + uz * 1.72 + pz * side * 1.12],
        yaw,
        scale: [0.17, 0.12, 0.08],
      });
    }

    const bellowsStart = bridgeEnd + 1.48;
    for (let fold = 0; fold < 7; fold += 1) {
      const along = bellowsStart + fold * 0.15;
      const center = [jetway.x + ux * along, cabinY, jetway.z + uz * along];
      const width = 2.62 - fold * 0.045;
      const height = 2.15 - fold * 0.035;
      const halfWidth = width / 2;
      transforms.bellowsHorizontal.push({ position: [center[0], center[1] + height / 2, center[2]], yaw, scale: [width, 0.085, 0.105] });
      transforms.bellowsHorizontal.push({ position: [center[0], center[1] - height / 2, center[2]], yaw, scale: [width, 0.085, 0.105] });
      transforms.bellowsVertical.push({ position: [center[0] + px * halfWidth, center[1], center[2] + pz * halfWidth], yaw, scale: [0.085, height, 0.105] });
      transforms.bellowsVertical.push({ position: [center[0] - px * halfWidth, center[1], center[2] - pz * halfWidth], yaw, scale: [0.085, height, 0.105] });
    }
    transforms.bumper.push({
      position: [jetway.x + ux * (bellowsStart + 1.04), cabinY - 0.83, jetway.z + uz * (bellowsStart + 1.04)],
      yaw,
      scale: [2.15, 0.18, 0.18],
    });

    const bogieAlong = bridgeEnd - 3.15;
    const bogieX = jetway.x + ux * bogieAlong;
    const bogieZ = jetway.z + uz * bogieAlong;
    for (const side of [-1, 1]) {
      transforms.supportColumns.push({
        position: [bogieX + px * side * 0.68, cabinY / 2, bogieZ + pz * side * 0.68],
        scale: [0.2, cabinY - 0.48, 0.2],
      });
      transforms.liftSleeves.push({
        position: [bogieX + px * side * 0.68, 1.25, bogieZ + pz * side * 0.68],
        scale: [0.32, 1.7, 0.32],
      });
    }
    transforms.bogies.push({ position: [bogieX, 0.55, bogieZ], yaw, scale: [2.75, 0.4, 1.18] });
    transforms.axles.push({ position: [bogieX, 0.42, bogieZ], yaw, scale: [2.95, 0.15, 0.15] });
    for (const side of [-1, 1]) {
      for (const fore of [-0.38, 0.38]) {
        transforms.wheels.push({
          position: [bogieX + px * side * 1.2 + ux * fore, 0.42, bogieZ + pz * side * 1.2 + uz * fore],
          yaw,
          scale: [0.43, 0.27, 0.43],
        });
      }
    }

    if (highDetail) {
      const stairOrigin = [endX - ux * 1.8 - px * 3.1, endZ - uz * 1.8 - pz * 3.1];
      addServiceStairs(transforms, stairOrigin, yaw, [ux, uz], [px, pz]);
      for (let segment = 0; segment < 8; segment += 1) {
        const along = bridgeStart + 1.5 + segment * (Math.max(4, bridgeLength - 4) / 7);
        transforms.cableSegments.push({
          position: [jetway.x + ux * along - px * 1.34, bridgeY(along) - 1.22, jetway.z + uz * along - pz * 1.34],
          yaw,
          pitch,
          scale: [0.055, 0.055, Math.max(0.8, bridgeLength / 8)],
        });
      }
      transforms.markers.push({ position: [bogieX + px * 1.38, 0.88, bogieZ + pz * 1.38], yaw, scale: [0.22, 0.22, 0.22] });
      transforms.markers.push({ position: [bogieX - px * 1.38, 0.88, bogieZ - pz * 1.38], yaw, scale: [0.22, 0.22, 0.22] });
    }
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const outerTunnel = createArchedTunnelGeometry(THREE, 3.2, 2.56, 0.36);
  const innerTunnel = createArchedTunnelGeometry(THREE, 2.9, 2.36, 0.32);
  const cabin = createArchedTunnelGeometry(THREE, 3.05, 2.72, 0.28);
  const rotunda = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false);
  const rotundaBand = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
  const column = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false);
  const wheel = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false);
  wheel.rotateZ(Math.PI / 2);
  const axle = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);
  axle.rotateZ(Math.PI / 2);
  const cable = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  cable.rotateX(Math.PI / 2);
  const marker = new THREE.SphereGeometry(1, 10, 7);

  addInstances(THREE, group, box, materials.shell, transforms.wallCollar, "AIR_Jetway01_WallCollars");
  addInstances(THREE, group, rotunda, materials.shell, transforms.rotundaBody, "AIR_Jetway01_Rotundas");
  addInstances(THREE, group, rotundaBand, materials.glass, transforms.rotundaWindow, "AIR_Jetway01_RotundaWindowBands");
  addInstances(THREE, group, column, materials.trim, transforms.rotundaRoof, "AIR_Jetway01_RotundaRoofs");
  addInstances(THREE, group, column, materials.metal, transforms.pivotCap, "AIR_Jetway01_PivotCaps");
  addInstances(THREE, group, outerTunnel, materials.shell, transforms.outer, "AIR_Jetway01_OuterTelescopingTunnels");
  addInstances(THREE, group, innerTunnel, materials.innerShell, transforms.inner, "AIR_Jetway01_InnerTelescopingTunnels");
  addInstances(THREE, group, cabin, materials.cabin, transforms.cabin, "AIR_Jetway01_AircraftCabins");
  addInstances(THREE, group, box, materials.glass, transforms.cabinFrontWindow, "AIR_Jetway01_CabinFrontWindows");
  addInstances(THREE, group, box, materials.glass, transforms.cabinSideWindow, "AIR_Jetway01_CabinSideWindows");
  addInstances(THREE, group, box, materials.trim, transforms.frameHorizontal, "AIR_Jetway01_HorizontalRibs");
  addInstances(THREE, group, box, materials.trim, transforms.frameVertical, "AIR_Jetway01_VerticalRibs");
  addInstances(THREE, group, box, materials.trim, transforms.overlapBand, "AIR_Jetway01_TelescopingOverlapBands");
  addInstances(THREE, group, box, materials.trim, transforms.panelSeam, "AIR_Jetway01_PanelSeams");
  addInstances(THREE, group, box, materials.bellows, transforms.bellowsHorizontal, "AIR_Jetway01_BellowsHorizontal");
  addInstances(THREE, group, box, materials.bellows, transforms.bellowsVertical, "AIR_Jetway01_BellowsVertical");
  addInstances(THREE, group, box, materials.warning, transforms.bumper, "AIR_Jetway01_AircraftBumpers");
  addInstances(THREE, group, column, materials.metal, transforms.supportColumns, "AIR_Jetway01_LiftColumns");
  addInstances(THREE, group, column, materials.innerShell, transforms.liftSleeves, "AIR_Jetway01_LiftSleeves");
  addInstances(THREE, group, box, materials.metal, transforms.supportFeet, "AIR_Jetway01_SupportFeet");
  addInstances(THREE, group, box, materials.metal, transforms.bogies, "AIR_Jetway01_WheelBogies");
  addInstances(THREE, group, axle, materials.metal, transforms.axles, "AIR_Jetway01_Axles");
  addInstances(THREE, group, wheel, materials.tire, transforms.wheels, "AIR_Jetway01_Wheels");
  addInstances(THREE, group, box, materials.light, transforms.lights, "AIR_Jetway01_WorkLights");
  addInstances(THREE, group, marker, materials.marker, transforms.markers, "AIR_Jetway01_SafetyMarkers");
  addInstances(THREE, group, box, materials.stair, transforms.steps, "AIR_Jetway01_ServiceSteps");
  addInstances(THREE, group, box, materials.metal, transforms.rails, "AIR_Jetway01_ServiceRails");
  addInstances(THREE, group, cable, materials.warning, transforms.cableSegments, "AIR_Jetway01_UnderbridgeServiceCable");

  group.userData.sourceArchive = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceArchive;
  group.userData.placementSource = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.placementSource;
  group.userData.sourceLibraryModel = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceLibraryModel;
  group.userData.sourceLibraryGuid = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceLibraryGuid;
  group.userData.sourceAirportJetwayRecordCount = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceAirportJetwayRecordCount;
  group.userData.sourceDimensionsMeters = [...SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceDimensionsMeters];
  group.userData.jetwayCount = jetways.length;
  group.userData.highDetailJetwayCount = highDetailCount;
  group.userData.terminalConnectedJetwayCount = terminalConnectedCount;
  group.userData.a1TerminalWallDistance = a1TerminalWallDistance;
  group.userData.terminalConnectionAuthority = "raycast-and-source-vertex-fit-to-authored-terminal-mesh";
  group.userData.detailLevel = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.detailLevel;
  group.userData.coordinateFrame = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.coordinateFrame;
  group.userData.visualAuthority = "faithful-reconstruction-of-referenced-fsx-air-jetway01-library-object";
  group.userData.usesTerminalBuildingTextures = false;
  group.userData.proceduralBuildingBoxReuse = false;
  return group;
}
