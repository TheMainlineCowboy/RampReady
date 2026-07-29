import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";

export const SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE = Object.freeze({
  sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip",
  placementSource: "scenery/world/scenery/kphx-airport.bgl",
  terminal4JetwayCount: 58,
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
  sceneOffset: Object.freeze([0, 0, 6.2]),
  detailLevel: "source-placed-detailed-terminal4-jetways-v1",
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function addInstances(THREE, group, geometry, material, transforms, name, shadows = true) {
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
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
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
  const supportMap = sourceTexture(textures, "SUPPORTS.BMP", "SUPPORTS2.BMP", "PHXRAMPLIGHT.BMP");

  const make = (name, map, options = {}) => new THREE.MeshStandardMaterial({
    name,
    map,
    color: 0xffffff,
    roughness: options.roughness ?? 0.62,
    metalness: options.metalness ?? 0.16,
    side: THREE.DoubleSide,
  });

  return {
    outer: make("PHX source jetway outer shell", shellMap, { roughness: 0.58, metalness: 0.18 }),
    inner: make("PHX source jetway inner shell", cabinMap, { roughness: 0.62, metalness: 0.15 }),
    cabin: make("PHX source jetway cabin", cabinMap, { roughness: 0.57, metalness: 0.19 }),
    rotunda: make("PHX source jetway rotunda", rotundaMap, { roughness: 0.61, metalness: 0.16 }),
    frame: make("PHX source jetway frame", supportMap, { roughness: 0.48, metalness: 0.45 }),
    metal: make("PHX source jetway supports", supportMap, { roughness: 0.44, metalness: 0.52 }),
    bellows: new THREE.MeshStandardMaterial({
      name: "PHX jetway aircraft bellows",
      color: 0x252a2e,
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    tire: new THREE.MeshStandardMaterial({
      name: "PHX jetway bogie tires",
      color: 0x17191b,
      roughness: 0.96,
      metalness: 0.01,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      name: "PHX jetway glazing",
      color: 0x698b9c,
      roughness: 0.16,
      metalness: 0.05,
      transmission: 0.18,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    light: new THREE.MeshStandardMaterial({
      name: "PHX jetway work lights",
      color: 0xfff0bf,
      emissive: 0xffd27a,
      emissiveIntensity: 1.8,
      roughness: 0.38,
      metalness: 0.08,
    }),
    stair: make("PHX jetway service stairs", supportMap, { roughness: 0.54, metalness: 0.36 }),
  };
}

function addFrame(transforms, center, yaw, pitch, perpendicular, width, height, depth) {
  const [cx, cy, cz] = center;
  const [px, pz] = perpendicular;
  const sideInset = width / 2;
  transforms.frameHorizontal.push({
    position: [cx, cy + height / 2, cz], yaw, pitch, scale: [width, 0.075, depth],
  });
  transforms.frameHorizontal.push({
    position: [cx, cy - height / 2, cz], yaw, pitch, scale: [width, 0.075, depth],
  });
  transforms.frameVertical.push({
    position: [cx + px * sideInset, cy, cz + pz * sideInset], yaw, pitch, scale: [0.075, height, depth],
  });
  transforms.frameVertical.push({
    position: [cx - px * sideInset, cy, cz - pz * sideInset], yaw, pitch, scale: [0.075, height, depth],
  });
}

function addServiceStairs(transforms, origin, yaw, perpendicular) {
  const [ox, oy, oz] = origin;
  const [px, pz] = perpendicular;
  const side = 1;
  for (let index = 0; index < 7; index += 1) {
    const height = 0.18 + index * 0.22;
    transforms.steps.push({
      position: [ox + px * side + Math.sin(yaw) * index * 0.34, height / 2, oz + pz * side + Math.cos(yaw) * index * 0.34],
      yaw,
      scale: [1.4, height, 0.34],
    });
  }
  for (const railSide of [-1, 1]) {
    transforms.rails.push({
      position: [ox + px * (side + railSide * 0.72) + Math.sin(yaw) * 1.05, oy + 0.78, oz + pz * (side + railSide * 0.72) + Math.cos(yaw) * 1.05],
      yaw,
      pitch: -0.47,
      scale: [0.05, 0.05, 2.7],
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

  for (const jetway of jetways) {
    let dx = jetway.px - jetway.x;
    let dz = jetway.pz - jetway.z;
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
    const bridgeStart = 2.4;
    const bridgeEnd = clamp(distance - 3.1, 14, 24.5);
    const bridgeLength = bridgeEnd - bridgeStart;
    const rotundaY = 4.72;
    const cabinY = jetway.g === "A1" ? 3.02 : 3.24;
    const drop = rotundaY - cabinY;
    const pitch = Math.atan2(drop, bridgeLength);

    transforms.rotunda.push({ position: [jetway.x, rotundaY, jetway.z], yaw, scale: [2.4, 2.75, 2.4] });
    transforms.rotundaRoof.push({ position: [jetway.x, rotundaY + 1.55, jetway.z], yaw, scale: [2.7, 0.18, 2.7] });
    transforms.supportColumns.push({ position: [jetway.x, 2.0, jetway.z], scale: [0.34, 4.0, 0.34] });
    transforms.supportFeet.push({ position: [jetway.x, 0.18, jetway.z], yaw, scale: [1.75, 0.28, 1.75] });

    const outerLength = bridgeLength * 0.60;
    const innerLength = bridgeLength * 0.53;
    const outerCenter = bridgeStart + outerLength / 2;
    const innerCenter = bridgeStart + outerLength + innerLength / 2 - 0.95;
    const bridgeY = (along) => rotundaY - drop * (along / bridgeLength);

    transforms.outer.push({
      position: [jetway.x + ux * outerCenter, bridgeY(outerCenter), jetway.z + uz * outerCenter],
      yaw, pitch, scale: [2.82, 2.52, outerLength],
    });
    transforms.inner.push({
      position: [jetway.x + ux * innerCenter, bridgeY(innerCenter), jetway.z + uz * innerCenter],
      yaw, pitch, scale: [2.52, 2.28, innerLength],
    });

    for (const section of [
      { start: bridgeStart + 0.45, length: outerLength - 0.9, width: 2.94, height: 2.63 },
      { start: bridgeStart + outerLength - 0.25, length: innerLength - 0.65, width: 2.63, height: 2.38 },
    ]) {
      const ribCount = Math.max(5, Math.round(section.length / 1.35));
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
          0.075,
        );
      }
    }

    const glassCenter = bridgeStart + bridgeLength * 0.49;
    for (const side of [-1, 1]) {
      transforms.glass.push({
        position: [
          jetway.x + ux * glassCenter + px * side * 1.38,
          bridgeY(glassCenter) + 0.08,
          jetway.z + uz * glassCenter + pz * side * 1.38,
        ],
        yaw, pitch, scale: [0.055, 0.82, bridgeLength * 0.78],
      });
    }

    const endX = jetway.x + ux * bridgeEnd;
    const endZ = jetway.z + uz * bridgeEnd;
    transforms.cabin.push({ position: [endX, cabinY, endZ], yaw, scale: [3.25, 2.72, 3.05] });
    transforms.cabinRoof.push({ position: [endX, cabinY + 1.49, endZ], yaw, scale: [3.52, 0.16, 3.32] });

    for (let fold = 0; fold < 6; fold += 1) {
      const along = bridgeEnd + 1.55 + fold * 0.16;
      const center = [jetway.x + ux * along, cabinY, jetway.z + uz * along];
      const width = 2.55 - fold * 0.055;
      const height = 2.12 - fold * 0.035;
      const sideInset = width / 2;
      transforms.bellowsHorizontal.push({ position: [center[0], center[1] + height / 2, center[2]], yaw, scale: [width, 0.09, 0.12] });
      transforms.bellowsHorizontal.push({ position: [center[0], center[1] - height / 2, center[2]], yaw, scale: [width, 0.09, 0.12] });
      transforms.bellowsVertical.push({ position: [center[0] + px * sideInset, center[1], center[2] + pz * sideInset], yaw, scale: [0.09, height, 0.12] });
      transforms.bellowsVertical.push({ position: [center[0] - px * sideInset, center[1], center[2] - pz * sideInset], yaw, scale: [0.09, height, 0.12] });
    }

    const bogieAlong = bridgeEnd - 1.2;
    const bogieX = jetway.x + ux * bogieAlong;
    const bogieZ = jetway.z + uz * bogieAlong;
    transforms.supportColumns.push({ position: [bogieX + px * 0.72, cabinY / 2, bogieZ + pz * 0.72], scale: [0.18, cabinY - 0.42, 0.18] });
    transforms.supportColumns.push({ position: [bogieX - px * 0.72, cabinY / 2, bogieZ - pz * 0.72], scale: [0.18, cabinY - 0.42, 0.18] });
    transforms.bogies.push({ position: [bogieX, 0.56, bogieZ], yaw, scale: [2.65, 0.42, 1.15] });
    for (const side of [-1, 1]) {
      for (const fore of [-0.38, 0.38]) {
        transforms.wheels.push({
          position: [bogieX + px * side * 1.18 + ux * fore, 0.42, bogieZ + pz * side * 1.18 + uz * fore],
          yaw,
          scale: [0.42, 0.26, 0.42],
        });
      }
    }

    for (const side of [-1, 1]) {
      transforms.lights.push({
        position: [endX + px * side * 1.15 + ux * 1.45, cabinY + 0.72, endZ + pz * side * 1.15 + uz * 1.45],
        yaw,
        scale: [0.16, 0.12, 0.08],
      });
    }

    addServiceStairs(transforms, [jetway.x - ux * 2.2 - px * 3.2, 0, jetway.z - uz * 2.2 - pz * 3.2], yaw, [px, pz]);
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const rotunda = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false);
  const column = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false);
  const wheel = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false);
  wheel.rotateZ(Math.PI / 2);

  addInstances(THREE, group, rotunda, materials.rotunda, transforms.rotunda, "KPHX_SourcePlaced_JetwayRotundas");
  addInstances(THREE, group, box, materials.frame, transforms.rotundaRoof, "KPHX_SourcePlaced_JetwayRotundaRoofs");
  addInstances(THREE, group, box, materials.outer, transforms.outer, "KPHX_SourcePlaced_JetwayOuterTunnels");
  addInstances(THREE, group, box, materials.inner, transforms.inner, "KPHX_SourcePlaced_JetwayInnerTunnels");
  addInstances(THREE, group, box, materials.cabin, transforms.cabin, "KPHX_SourcePlaced_JetwayCabins");
  addInstances(THREE, group, box, materials.frame, transforms.cabinRoof, "KPHX_SourcePlaced_JetwayCabinRoofs");
  addInstances(THREE, group, box, materials.glass, transforms.glass, "KPHX_SourcePlaced_JetwaySideGlass");
  addInstances(THREE, group, box, materials.frame, transforms.frameHorizontal, "KPHX_SourcePlaced_JetwayHorizontalRibs");
  addInstances(THREE, group, box, materials.frame, transforms.frameVertical, "KPHX_SourcePlaced_JetwayVerticalRibs");
  addInstances(THREE, group, box, materials.bellows, transforms.bellowsHorizontal, "KPHX_SourcePlaced_JetwayBellowsHorizontal");
  addInstances(THREE, group, box, materials.bellows, transforms.bellowsVertical, "KPHX_SourcePlaced_JetwayBellowsVertical");
  addInstances(THREE, group, column, materials.metal, transforms.supportColumns, "KPHX_SourcePlaced_JetwaySupportColumns");
  addInstances(THREE, group, box, materials.metal, transforms.supportFeet, "KPHX_SourcePlaced_JetwaySupportFeet");
  addInstances(THREE, group, box, materials.metal, transforms.bogies, "KPHX_SourcePlaced_JetwayBogies");
  addInstances(THREE, group, wheel, materials.tire, transforms.wheels, "KPHX_SourcePlaced_JetwayWheels");
  addInstances(THREE, group, box, materials.light, transforms.lights, "KPHX_SourcePlaced_JetwayWorkLights", false);
  addInstances(THREE, group, box, materials.stair, transforms.steps, "KPHX_SourcePlaced_JetwayServiceSteps");
  addInstances(THREE, group, box, materials.metal, transforms.rails, "KPHX_SourcePlaced_JetwayServiceRails");

  group.userData.sourceArchive = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceArchive;
  group.userData.placementSource = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.placementSource;
  group.userData.jetwayCount = jetways.length;
  group.userData.detailLevel = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.detailLevel;
  group.userData.coordinateFrame = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.coordinateFrame;
  return group;
}
