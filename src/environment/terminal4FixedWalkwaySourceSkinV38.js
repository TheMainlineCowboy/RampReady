import * as THREE from "three";

const AUTHORITY = "exact-terminal4-T4_WALK-source-skin-and-roof-v38";

function materialReference(material) {
  return `${material?.userData?.diffuseTexture || material?.name || ""}`.toUpperCase();
}

function findSourceMaterial(terminal, references) {
  const wanted = references.map((reference) => reference.toUpperCase());
  let match = null;
  terminal?.traverse?.((entry) => {
    if (match || !entry.isMesh) return;
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material?.map) continue;
      const reference = materialReference(material);
      if (wanted.some((candidate) => reference.includes(candidate))) {
        match = material;
        break;
      }
    }
  });
  return match;
}

function cloneExactMaterial(source, name, { roughness, metalness, emissiveIntensity, roofCrop = false }) {
  if (!source?.map) throw new Error(`Terminal 4 fixed walkway source skin is missing mapped material ${name}`);
  const material = source.clone();
  material.name = name;
  material.color?.setHex(0xffffff);
  material.roughness = roughness;
  material.metalness = metalness;
  material.side = THREE.DoubleSide;
  material.transparent = false;
  material.opacity = 1;
  material.alphaTest = 0;
  material.depthWrite = true;
  material.dithering = true;
  material.map = source.map.clone();
  material.map.name = `${name} exact diffuse`;
  material.map.wrapS = THREE.RepeatWrapping;
  material.map.wrapT = THREE.ClampToEdgeWrapping;
  material.map.offset.set(0, roofCrop ? 0.72 : 0);
  material.map.repeat.set(1, roofCrop ? 0.26 : 1);
  material.map.needsUpdate = true;
  if (source.emissiveMap) {
    material.emissiveMap = source.emissiveMap.clone();
    material.emissiveMap.name = `${name} exact lightmap`;
    material.emissiveMap.wrapS = THREE.RepeatWrapping;
    material.emissiveMap.wrapT = THREE.ClampToEdgeWrapping;
    material.emissiveMap.offset.copy(material.map.offset);
    material.emissiveMap.repeat.copy(material.map.repeat);
    material.emissiveMap.needsUpdate = true;
    material.emissive?.setHex(0xffffff);
    material.emissiveIntensity = emissiveIntensity;
  } else {
    material.emissive?.setHex(0x000000);
    material.emissiveIntensity = 0;
  }
  material.userData = {
    ...(material.userData || {}),
    fixedWalkwaySourceSkinAuthority: AUTHORITY,
    exactTerminal4SourceTexture: materialReference(source),
    sourceGeometryUnmoved: true,
  };
  material.needsUpdate = true;
  return material;
}

function extractRecords(source) {
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
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize(),
      length: Math.abs(scale.z),
    });
  }
  return records;
}

function addInstancedBoxes(parent, name, material, records) {
  if (!records.length) return null;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, records.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  for (const [index, record] of records.entries()) {
    dummy.position.copy(record.position);
    dummy.quaternion.copy(record.quaternion);
    dummy.scale.copy(record.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  parent.add(mesh);
  return mesh;
}

export function installTerminal4FixedWalkwaySourceSkinV38(group, terminal) {
  if (!group?.isGroup) throw new Error("Terminal 4 fixed walkway source skin requires the source jetway group");
  if (!terminal?.isObject3D) throw new Error("Terminal 4 fixed walkway source skin requires the authored terminal");
  const existing = group.getObjectByName("Terminal4_FixedWalkway_SourceSkin_V38");
  if (existing) return existing;

  const fixedWalkway = group.getObjectByName("Terminal4_GlassFixedWalkways_V20");
  const sourceTransforms = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  if (!fixedWalkway || !sourceTransforms) {
    throw new Error("Terminal 4 fixed walkway source skin requires the V20 walkway and exact source transforms");
  }
  const records = extractRecords(sourceTransforms);
  if (!records.length) throw new Error("Terminal 4 fixed walkway source skin recovered zero corridor transforms");

  const wallSource = findSourceMaterial(terminal, ["T4_WALK.BMP", "T4_WALK.PNG"]);
  const roofSource = findSourceMaterial(terminal, ["T4_WALK2.BMP", "T4_WALK2.PNG"])
    || wallSource;
  if (!wallSource || !roofSource) {
    throw new Error("Terminal 4 fixed walkway source skin could not find exact T4_WALK/T4_WALK2 terminal materials");
  }

  const wallMaterial = cloneExactMaterial(
    wallSource,
    "Terminal 4 fixed walkway exact T4_WALK side skin V38",
    { roughness: 0.5, metalness: 0.04, emissiveIntensity: 0.055 },
  );
  const roofMaterial = cloneExactMaterial(
    roofSource,
    "Terminal 4 fixed walkway exact T4_WALK2 roof skin V38",
    { roughness: 0.78, metalness: 0.025, emissiveIntensity: 0.035, roofCrop: true },
  );

  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkway_SourceSkin_V38";
  const sides = [];
  const roofs = [];
  for (const record of records) {
    const length = Math.max(1.15, record.length - 0.38);
    for (const side of [-1, 1]) {
      sides.push({
        position: record.position.clone()
          .addScaledVector(record.right, side * 1.225)
          .add(new THREE.Vector3(0, 0.08, 0)),
        quaternion: record.quaternion,
        scale: new THREE.Vector3(0.028, 2.08, length),
      });
    }
    roofs.push({
      position: record.position.clone().add(new THREE.Vector3(0, 1.295, 0)),
      quaternion: record.quaternion,
      scale: new THREE.Vector3(2.54, 0.035, length),
    });
  }

  const sideMesh = addInstancedBoxes(root, "Terminal4_FixedWalkway_ExactSourceSideSkins_V38", wallMaterial, sides);
  const roofMesh = addInstancedBoxes(root, "Terminal4_FixedWalkway_ExactSourceRoofSkins_V38", roofMaterial, roofs);
  root.userData.authority = AUTHORITY;
  root.userData.walkwayCount = records.length;
  root.userData.sideSkinCount = sideMesh?.count ?? 0;
  root.userData.roofSkinCount = roofMesh?.count ?? 0;
  root.userData.exactWallTexture = materialReference(wallSource);
  root.userData.exactRoofTexture = materialReference(roofSource);
  root.userData.sourceGeometryUnmoved = true;
  group.add(root);

  group.userData.fixedWalkwaySourceSkinAuthority = AUTHORITY;
  group.userData.fixedWalkwaySourceSkinCount = root.userData.sideSkinCount;
  group.userData.fixedWalkwaySourceRoofCount = root.userData.roofSkinCount;
  group.userData.fixedWalkwayExactWallTexture = root.userData.exactWallTexture;
  group.userData.fixedWalkwayExactRoofTexture = root.userData.exactRoofTexture;
  return root;
}
