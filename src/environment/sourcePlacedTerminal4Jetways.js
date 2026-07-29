import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";

export const SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE = Object.freeze({
  sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip",
  placementSource: "scenery/world/scenery/kphx-airport.bgl",
  terminal4JetwayCount: 58,
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
  sceneOffset: Object.freeze([0, 0, 6.2]),
  highDetailRadiusMeters: 180,
  detailLevel: "source-placed-proportioned-terminal4-jetways-v2",
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function addInstances(THREE, group, geometry, material, transforms, name, castShadow = false) {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  dummy.rotation.order = "YXZ";
  transforms.forEach((entry, index) => {
    dummy.position.set(...entry.position);
    dummy.rotation.set(entry.pitch || 0, entry.yaw || 0, entry.roll || 0);
    dummy.scale.set(...entry.scale);
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

function sourceTexture(textures, ...references) {
  for (const reference of references) {
    const texture = textures.get(reference.toUpperCase());
    if (texture) return texture;
  }
  return null;
}

function createMaterials(THREE, textures) {
  const shellMap = sourceTexture(textures, "T4_WALK.BMP", "SUPPORTS.BMP", "BGATE1.BMP");
  const cabinMap = sourceTexture(textures, "BGATE1.BMP", "BGATE3.BMP", "DGATE1.BMP");
  const rotundaMap = sourceTexture(textures, "BGATE3.BMP", "T4_WALK2.BMP", "SUPPORTS.BMP");
  const supportMap = sourceTexture(textures, "SUPPORTS.BMP", "PHXRAMPLIGHT.BMP");
  const make = (name, map, roughness, metalness, color = 0xffffff) => new THREE.MeshStandardMaterial({
    name,
    map,
    color,
    roughness,
    metalness,
    side: THREE.DoubleSide,
  });
  return {
    outer: make("PHX source jetway outer shell", shellMap, 0.63, 0.12, 0xe3dfd6),
    inner: make("PHX source jetway inner shell", cabinMap, 0.66, 0.1, 0xddd9d0),
    cabin: make("PHX source jetway cabin", cabinMap, 0.61, 0.14, 0xd9d5cd),
    rotunda: make("PHX source jetway rotunda", rotundaMap, 0.66, 0.11, 0xd8d4ca),
    frame: make("PHX source jetway frame", supportMap, 0.48, 0.46, 0x72777a),
    metal: make("PHX source jetway supports", supportMap, 0.44, 0.54, 0x858b8d),
    bellows: new THREE.MeshStandardMaterial({
      name: "PHX jetway aircraft bellows",
      color: 0x252a2e,
      roughness: 0.94,
      metalness: 0.01,
      side: THREE.DoubleSide,
    }),
    tire: new THREE.MeshStandardMaterial({
      name: "PHX jetway bogie tires",
      color: 0x151719,
      roughness: 0.98,
      metalness: 0,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      name: "PHX jetway glazing",
      color: 0x54798d,
      roughness: 0.16,
      metalness: 0.04,
      transparent: true,
      opacity: 0.42,
      transmission: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    light: new THREE.MeshStandardMaterial({
      name: "PHX jetway work lights",
      color: 0xfff1c9,
      emissive: 0xffd27a,
      emissiveIntensity: 1.15,
      roughness: 0.36,
      metalness: 0.06,
    }),
    stair: make("PHX jetway service stairs", supportMap, 0.55, 0.34, 0x8b9092),
  };
}

function addFrame(transforms, center, yaw, pitch, perpendicular, width, height, depth) {
  const [cx, cy, cz] = center;
  const [px, pz] = perpendicular;
  const sideInset = width / 2;
  transforms.frameHorizontal.push({ position: [cx, cy + height / 2, cz], yaw, pitch, scale: [width, 0.055, depth] });
  transforms.frameHorizontal.push({ position: [cx, cy - height / 2, cz], yaw, pitch, scale: [width, 0.055, depth] });
  transforms.frameVertical.push({ position: [cx + px * sideInset, cy, cz + pz * sideInset], yaw, pitch, scale: [0.055, height, depth] });
  transforms.frameVertical.push({ position: [cx - px * sideInset, cy, cz - pz * sideInset], yaw, pitch, scale: [0.055, height, depth] });
}

function addServiceStairs(transforms, origin, yaw, perpendicular) {
  const [ox, oz] = origin;
  const [px, pz] = perpendicular;
  for (let index = 0; index < 6; index += 1) {
    const height = 0.18 + index * 0.18;
    transforms.steps.push({
      position: [ox + px * 0.76 + Math.sin(yaw) * index * 0.29, height / 2, oz + pz * 0.76 + Math.cos(yaw) * index * 0.29],
      yaw,
      scale: [1.05, height, 0.29],
    });
  }
  for (const railSide of [-1, 1]) {
    transforms.rails.push({
      position: [ox + px * (0.76 + railSide * 0.57) + Math.sin(yaw) * 0.78, 0.68, oz + pz * (0.76 + railSide * 0.57) + Math.cos(yaw) * 0.78],
      yaw,
      pitch: -0.48,
      scale: [0.04, 0.04, 1.95],
    });
  }
}

export function buildSourcePlacedTerminal4Jetways(THREE, textures) {
  const jetways = [...concourseA.jetways, ...concourseB.jetways];
  if (jetways.length !== SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.terminal4JetwayCount) {
    throw new Error(`Expected 58 Terminal 4 jetways, received ${jetways.length}`);
  }

  const group = new THREE.Group();
  group.name = "PHX_Terminal4_SourcePlacedDetailedJetways";
  group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset);
  const materials = createMaterials(THREE, textures);
  const transforms = {
    rotunda: [], rotundaRoof: [], outer: [], inner: [], cabin: [], cabinRoof: [], glass: [],
    frameHorizontal: [], frameVertical: [], bellowsHorizontal: [], bellowsVertical: [],
    supportColumns: [], supportFeet: [], bogies: [], wheels: [], lights: [], steps: [], rails: [],
  };
  let highDetailCount = 0;

  for (const jetway of jetways) {
    let dx = jetway.px - jetway.x;
    let dz = jetway.pz - jetway.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 2) {
      const heading = THREE.MathUtils.degToRad(jetway.h);
      dx = Math.sin(heading);
      dz = Math.cos(heading);
      distance = 22;
    }
    const ux = dx / distance;
    const uz = dz / distance;
    const px = -uz;
    const pz = ux;
    const yaw = Math.atan2(ux, uz);
    const bridgeStart = 2.05;
    const bridgeEnd = clamp(distance - 3.55, 11.8, 22.8);
    const bridgeLength = bridgeEnd - bridgeStart;
    const rotundaY = 4.38;
    const cabinY = jetway.g === "A1" ? 2.82 : 3.03;
    const drop = rotundaY - cabinY;
    const pitch = Math.atan2(drop, bridgeLength);
    const highDetail = Math.hypot(jetway.x, jetway.z) <= SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.highDetailRadiusMeters;
    if (highDetail) highDetailCount += 1;

    transforms.rotunda.push({ position: [jetway.x, rotundaY, jetway.z], yaw, scale: [1.92, 2.25, 1.92] });
    transforms.rotundaRoof.push({ position: [jetway.x, rotundaY + 1.24, jetway.z], yaw, scale: [2.14, 0.13, 2.14] });
    transforms.supportColumns.push({ position: [jetway.x, 1.88, jetway.z], scale: [0.27, 3.76, 0.27] });
    transforms.supportFeet.push({ position: [jetway.x, 0.14, jetway.z], yaw, scale: [1.35, 0.22, 1.35] });

    const outerLength = bridgeLength * 0.62;
    const innerStart = bridgeStart + outerLength - 0.72;
    const innerLength = Math.max(3.8, bridgeEnd - innerStart);
    const outerCenter = bridgeStart + outerLength / 2;
    const innerCenter = innerStart + innerLength / 2;
    const bridgeY = (along) => rotundaY - drop * (along / bridgeLength);

    transforms.outer.push({
      position: [jetway.x + ux * outerCenter, bridgeY(outerCenter), jetway.z + uz * outerCenter],
      yaw, pitch, scale: [2.34, 2.16, outerLength],
    });
    transforms.inner.push({
      position: [jetway.x + ux * innerCenter, bridgeY(innerCenter), jetway.z + uz * innerCenter],
      yaw, pitch, scale: [2.08, 1.96, innerLength],
    });

    if (highDetail) {
      for (const section of [
        { start: bridgeStart + 0.42, length: Math.max(2, outerLength - 0.84), width: 2.43, height: 2.24 },
        { start: innerStart + 0.2, length: Math.max(2, innerLength - 0.45), width: 2.17, height: 2.04 },
      ]) {
        const ribCount = clamp(Math.round(section.length / 2.5), 4, 7);
        for (let rib = 0; rib <= ribCount; rib += 1) {
          const along = section.start + section.length * (rib / ribCount);
          addFrame(
            transforms,
            [jetway.x + ux * along, bridgeY(along), jetway.z + uz * along],
            yaw,
            pitch,
            [px, pz],
            section.width,
            section.height,
            0.06,
          );
        }
      }
      const glassCenter = bridgeStart + bridgeLength * 0.48;
      for (const side of [-1, 1]) {
        transforms.glass.push({
          position: [
            jetway.x + ux * glassCenter + px * side * 1.135,
            bridgeY(glassCenter) + 0.04,
            jetway.z + uz * glassCenter + pz * side * 1.135,
          ],
          yaw, pitch, scale: [0.035, 0.72, bridgeLength * 0.72],
        });
      }
    }

    const endX = jetway.x + ux * bridgeEnd;
    const endZ = jetway.z + uz * bridgeEnd;
    transforms.cabin.push({ position: [endX, cabinY, endZ], yaw, scale: [2.46, 2.18, 1.94] });
    transforms.cabinRoof.push({ position: [endX, cabinY + 1.16, endZ], yaw, scale: [2.64, 0.12, 2.12] });

    if (highDetail) {
      for (let fold = 0; fold < 6; fold += 1) {
        const along = bridgeEnd + 1.03 + fold * 0.13;
        const center = [jetway.x + ux * along, cabinY - 0.02, jetway.z + uz * along];
        const width = 2.13 - fold * 0.045;
        const height = 1.86 - fold * 0.025;
        const sideInset = width / 2;
        transforms.bellowsHorizontal.push({ position: [center[0], center[1] + height / 2, center[2]], yaw, scale: [width, 0.075, 0.09] });
        transforms.bellowsHorizontal.push({ position: [center[0], center[1] - height / 2, center[2]], yaw, scale: [width, 0.075, 0.09] });
        transforms.bellowsVertical.push({ position: [center[0] + px * sideInset, center[1], center[2] + pz * sideInset], yaw, scale: [0.075, height, 0.09] });
        transforms.bellowsVertical.push({ position: [center[0] - px * sideInset, center[1], center[2] - pz * sideInset], yaw, scale: [0.075, height, 0.09] });
      }
    }

    const bogieAlong = bridgeEnd - 0.88;
    const bogieX = jetway.x + ux * bogieAlong;
    const bogieZ = jetway.z + uz * bogieAlong;
    transforms.supportColumns.push({ position: [bogieX + px * 0.58, cabinY / 2, bogieZ + pz * 0.58], scale: [0.14, cabinY - 0.38, 0.14] });
    transforms.supportColumns.push({ position: [bogieX - px * 0.58, cabinY / 2, bogieZ - pz * 0.58], scale: [0.14, cabinY - 0.38, 0.14] });
    transforms.bogies.push({ position: [bogieX, 0.48, bogieZ], yaw, scale: [2.15, 0.34, 0.91] });
    for (const side of [-1, 1]) {
      for (const fore of [-0.31, 0.31]) {
        transforms.wheels.push({
          position: [bogieX + px * side * 0.93 + ux * fore, 0.36, bogieZ + pz * side * 0.93 + uz * fore],
          yaw,
          scale: [0.34, 0.22, 0.34],
        });
      }
    }

    if (highDetail) {
      for (const side of [-1, 1]) {
        transforms.lights.push({
          position: [endX + px * side * 0.92 + ux * 0.88, cabinY + 0.61, endZ + pz * side * 0.92 + uz * 0.88],
          yaw,
          scale: [0.12, 0.09, 0.06],
        });
      }
      addServiceStairs(transforms, [jetway.x - ux * 1.8 - px * 2.55, jetway.z - uz * 1.8 - pz * 2.55], yaw, [px, pz]);
    }
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const rotunda = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false);
  const column = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false);
  const wheel = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false);
  wheel.rotateZ(Math.PI / 2);

  addInstances(THREE, group, rotunda, materials.rotunda, transforms.rotunda, "KPHX_SourcePlaced_JetwayRotundas", true);
  addInstances(THREE, group, box, materials.frame, transforms.rotundaRoof, "KPHX_SourcePlaced_JetwayRotundaRoofs", true);
  addInstances(THREE, group, box, materials.outer, transforms.outer, "KPHX_SourcePlaced_JetwayOuterTunnels", true);
  addInstances(THREE, group, box, materials.inner, transforms.inner, "KPHX_SourcePlaced_JetwayInnerTunnels", true);
  addInstances(THREE, group, box, materials.cabin, transforms.cabin, "KPHX_SourcePlaced_JetwayCabins", true);
  addInstances(THREE, group, box, materials.frame, transforms.cabinRoof, "KPHX_SourcePlaced_JetwayCabinRoofs", true);
  addInstances(THREE, group, box, materials.glass, transforms.glass, "KPHX_SourcePlaced_JetwaySideGlass");
  addInstances(THREE, group, box, materials.frame, transforms.frameHorizontal, "KPHX_SourcePlaced_JetwayHorizontalRibs", true);
  addInstances(THREE, group, box, materials.frame, transforms.frameVertical, "KPHX_SourcePlaced_JetwayVerticalRibs", true);
  addInstances(THREE, group, box, materials.bellows, transforms.bellowsHorizontal, "KPHX_SourcePlaced_JetwayBellowsHorizontal", true);
  addInstances(THREE, group, box, materials.bellows, transforms.bellowsVertical, "KPHX_SourcePlaced_JetwayBellowsVertical", true);
  addInstances(THREE, group, column, materials.metal, transforms.supportColumns, "KPHX_SourcePlaced_JetwaySupportColumns", true);
  addInstances(THREE, group, box, materials.metal, transforms.supportFeet, "KPHX_SourcePlaced_JetwaySupportFeet", true);
  addInstances(THREE, group, box, materials.metal, transforms.bogies, "KPHX_SourcePlaced_JetwayBogies", true);
  addInstances(THREE, group, wheel, materials.tire, transforms.wheels, "KPHX_SourcePlaced_JetwayWheels", true);
  addInstances(THREE, group, box, materials.light, transforms.lights, "KPHX_SourcePlaced_JetwayWorkLights");
  addInstances(THREE, group, box, materials.stair, transforms.steps, "KPHX_SourcePlaced_JetwayServiceSteps", true);
  addInstances(THREE, group, box, materials.metal, transforms.rails, "KPHX_SourcePlaced_JetwayServiceRails", true);

  group.userData.sourceArchive = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceArchive;
  group.userData.placementSource = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.placementSource;
  group.userData.jetwayCount = jetways.length;
  group.userData.highDetailJetwayCount = highDetailCount;
  group.userData.detailLevel = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.detailLevel;
  group.userData.coordinateFrame = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.coordinateFrame;
  return group;
}
