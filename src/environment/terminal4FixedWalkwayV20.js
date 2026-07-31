import * as THREE from "three";

function material(name, color, roughness, metalness = 0.04, extra = {}) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
    side: THREE.DoubleSide,
    ...extra,
  });
}

function addInstancedBoxes(parent, name, sourceMaterial, records) {
  if (!records.length) return null;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial, records.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  for (const [index, record] of records.entries()) {
    dummy.position.copy(record.position);
    dummy.quaternion.copy(record.quaternion || new THREE.Quaternion());
    dummy.scale.copy(record.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  parent.add(mesh);
  return mesh;
}

function extractWalkways(source) {
  if (!source?.isInstancedMesh || source.count < 1) return [];
  const records = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let instance = 0; instance < source.count; instance += 1) {
    source.getMatrixAt(instance, matrix);
    matrix.decompose(position, quaternion, scale);
    records.push({
      position: position.clone(),
      quaternion: quaternion.clone(),
      forward: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize(),
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize(),
      length: Math.abs(scale.z),
    });
  }
  return records;
}

function localTilt(recordQuaternion, angle) {
  const local = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  return recordQuaternion.clone().multiply(local);
}

export function installTerminal4FixedWalkwayV20(group) {
  if (!group?.isGroup) throw new Error("Terminal 4 fixed-walkway replacement requires the source jetway group");
  const existing = group.getObjectByName("Terminal4_GlassFixedWalkways_V20");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  const records = extractWalkways(source);
  if (!records.length) throw new Error("Terminal 4 fixed-walkway replacement could not recover source transforms");

  // The legacy arched extrusion is a closed solid and reads as an oversized
  // beige wall from the ramp. Preserve its exact transforms, but replace its
  // visible shell with a framed passenger corridor.
  source.visible = false;
  source.castShadow = false;
  const legacyOverlay = group.getObjectByName("Terminal4_FixedWalkwayArchitecturalDetail_V15");
  if (legacyOverlay) {
    legacyOverlay.visible = false;
    legacyOverlay.traverse((node) => { if (node.isMesh) node.castShadow = false; });
  }

  const root = new THREE.Group();
  root.name = "Terminal4_GlassFixedWalkways_V20";

  const glass = material("Terminal 4 fixed walkway solar-control glazing", 0x365361, 0.2, 0.08, {
    emissive: 0x101c22,
    emissiveIntensity: 0.16,
    transparent: true,
    opacity: 0.82,
    depthWrite: true,
  });
  const frame = material("Terminal 4 fixed walkway aluminum frame", 0x8c9293, 0.62, 0.34);
  const lowerPanel = material("Terminal 4 fixed walkway lower impact panel", 0xb1aaa0, 0.86, 0.035);
  const floor = material("Terminal 4 fixed walkway structural floor", 0x666b6c, 0.84, 0.12);
  const roof = material("Terminal 4 fixed walkway insulated roof", 0xd9d6cf, 0.88, 0.025, {
    emissive: 0x242424,
    emissiveIntensity: 0.12,
  });
  const interior = material("Terminal 4 fixed walkway interior sill", 0xc6c3bc, 0.82, 0.03);

  const floors = [];
  const roofs = [];
  const glazing = [];
  const lowerPanels = [];
  const upperRails = [];
  const lowerRails = [];
  const mullions = [];
  const interiorSills = [];
  const diagonalBraces = [];

  for (const record of records) {
    const length = Math.max(1.15, record.length - 0.34);
    floors.push({
      position: record.position.clone().add(new THREE.Vector3(0, -1.12, 0)),
      quaternion: record.quaternion,
      scale: new THREE.Vector3(2.5, 0.18, length),
    });
    roofs.push({
      position: record.position.clone().add(new THREE.Vector3(0, 1.19, 0)),
      quaternion: record.quaternion,
      scale: new THREE.Vector3(2.62, 0.18, length),
    });

    for (const side of [-1, 1]) {
      const sidePosition = record.position.clone().addScaledVector(record.right, side * 1.255);
      glazing.push({
        position: sidePosition.clone().add(new THREE.Vector3(0, 0.15, 0)),
        quaternion: record.quaternion,
        scale: new THREE.Vector3(0.055, 1.68, length),
      });
      lowerPanels.push({
        position: sidePosition.clone().add(new THREE.Vector3(0, -0.87, 0)),
        quaternion: record.quaternion,
        scale: new THREE.Vector3(0.075, 0.42, length),
      });
      upperRails.push({
        position: sidePosition.clone().add(new THREE.Vector3(0, 1.02, 0)),
        quaternion: record.quaternion,
        scale: new THREE.Vector3(0.085, 0.12, length),
      });
      lowerRails.push({
        position: sidePosition.clone().add(new THREE.Vector3(0, -0.57, 0)),
        quaternion: record.quaternion,
        scale: new THREE.Vector3(0.085, 0.12, length),
      });
      interiorSills.push({
        position: record.position.clone()
          .addScaledVector(record.right, side * 1.09)
          .add(new THREE.Vector3(0, -0.55, 0)),
        quaternion: record.quaternion,
        scale: new THREE.Vector3(0.13, 0.1, length),
      });

      for (let along = 0.75; along < record.length - 0.45; along += 2.1) {
        mullions.push({
          position: record.position.clone()
            .addScaledVector(record.forward, along - record.length / 2)
            .addScaledVector(record.right, side * 1.285)
            .add(new THREE.Vector3(0, 0.15, 0)),
          quaternion: record.quaternion,
          scale: new THREE.Vector3(0.075, 1.82, 0.085),
        });
      }

      // One restrained X-brace per long structural bay provides a recognizable
      // airport-walkway silhouette without recreating the dense rib cage that
      // made earlier jetways look noisy and black.
      if (record.length > 9) {
        for (let bay = 3.0; bay < record.length - 2.1; bay += 6.3) {
          for (const slope of [-1, 1]) {
            const braceLength = 2.28;
            diagonalBraces.push({
              position: record.position.clone()
                .addScaledVector(record.forward, bay - record.length / 2)
                .addScaledVector(record.right, side * 1.29)
                .add(new THREE.Vector3(0, 0.18, 0)),
              quaternion: localTilt(record.quaternion, slope * 0.76),
              scale: new THREE.Vector3(0.06, braceLength, 0.065),
            });
          }
        }
      }
    }
  }

  addInstancedBoxes(root, "Terminal4_FixedWalkway_Floors_V20", floor, floors);
  addInstancedBoxes(root, "Terminal4_FixedWalkway_Roofs_V20", roof, roofs);
  addInstancedBoxes(root, "Terminal4_FixedWalkway_Glazing_V20", glass, glazing);
  addInstancedBoxes(root, "Terminal4_FixedWalkway_LowerImpactPanels_V20", lowerPanel, lowerPanels);
  addInstancedBoxes(root, "Terminal4_FixedWalkway_UpperRails_V20", frame, upperRails);
  addInstancedBoxes(root, "Terminal4_FixedWalkway_LowerRails_V20", frame, lowerRails);
  addInstancedBoxes(root, "Terminal4_FixedWalkway_Mullions_V20", frame, mullions);
  addInstancedBoxes(root, "Terminal4_FixedWalkway_InteriorSills_V20", interior, interiorSills);
  addInstancedBoxes(root, "Terminal4_FixedWalkway_DiagonalBraces_V20", frame, diagonalBraces);

  root.userData.authority = "source-transform-glass-frame-grounded-fixed-walkways-v20";
  root.userData.walkwayCount = records.length;
  root.userData.legacyClosedShellHidden = true;
  root.userData.legacyOverlayHidden = Boolean(legacyOverlay);
  root.userData.glazingPanelCount = glazing.length;
  root.userData.mullionCount = mullions.length;
  root.userData.diagonalBraceCount = diagonalBraces.length;
  group.add(root);
  return root;
}
