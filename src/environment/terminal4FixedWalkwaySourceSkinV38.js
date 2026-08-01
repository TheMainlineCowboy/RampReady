import * as THREE from "three";

const AUTHORITY = "exact-terminal4-T4_WALK-package-mesh-material-authority-v53";

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

function cloneExactMaterial(source, name) {
  if (!source?.map) throw new Error(`Terminal 4 fixed walkway source material is missing ${name}`);
  const material = source.clone();
  material.name = name;
  material.color?.setHex(0xffffff);
  material.roughness = 0.7;
  material.metalness = 0.025;
  material.side = THREE.DoubleSide;
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.dithering = true;
  material.map = source.map.clone();
  material.map.name = `${name} exact diffuse`;
  material.map.wrapS = THREE.RepeatWrapping;
  material.map.wrapT = THREE.ClampToEdgeWrapping;
  material.map.needsUpdate = true;
  if (source.emissiveMap) {
    material.emissiveMap = source.emissiveMap.clone();
    material.emissiveMap.name = `${name} exact lightmap`;
    material.emissiveMap.needsUpdate = true;
    material.emissive?.setHex(0xffffff);
    material.emissiveIntensity = 0.02;
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

export function installTerminal4FixedWalkwaySourceSkinV38(group, terminal) {
  if (!group?.isGroup) throw new Error("Terminal 4 fixed walkway source skin requires the source jetway group");
  if (!terminal?.isObject3D) throw new Error("Terminal 4 fixed walkway source skin requires the authored terminal");
  const existing = group.getObjectByName("Terminal4_FixedWalkway_SourceSkin_V53");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  if (!source?.isInstancedMesh || source.count < 1) {
    throw new Error("Terminal 4 package fixed walkway source mesh is missing");
  }

  const wallSource = findSourceMaterial(terminal, ["T4_WALK.BMP", "T4_WALK.PNG"]);
  const roofSource = findSourceMaterial(terminal, ["T4_WALK2.BMP", "T4_WALK2.PNG"]) || wallSource;
  if (!wallSource || !roofSource) {
    throw new Error("Terminal 4 fixed walkway source skin could not find exact T4_WALK/T4_WALK2 materials");
  }

  const exactMaterial = cloneExactMaterial(
    wallSource,
    "Terminal 4 package fixed walkway exact T4_WALK material V53",
  );
  source.material = exactMaterial;
  source.visible = true;
  source.castShadow = true;
  source.receiveShadow = true;

  const marker = new THREE.Group();
  marker.name = "Terminal4_FixedWalkway_SourceSkin_V53";
  marker.userData.authority = AUTHORITY;
  marker.userData.walkwayCount = source.count;
  marker.userData.exactWallTexture = materialReference(wallSource);
  marker.userData.exactRoofTexture = materialReference(roofSource);
  marker.userData.sourceGeometryUnmoved = true;
  marker.userData.proceduralSkinMeshCount = 0;
  marker.userData.packageMeshMaterialOnly = true;
  marker.userData.packageWalkwayIsSoleVisualAuthority = true;
  group.add(marker);

  group.userData.fixedWalkwaySourceSkinAuthority = AUTHORITY;
  group.userData.fixedWalkwaySourceSkinCount = source.count;
  group.userData.fixedWalkwaySourceRoofCount = source.count;
  group.userData.fixedWalkwayExactWallTexture = marker.userData.exactWallTexture;
  group.userData.fixedWalkwayExactRoofTexture = marker.userData.exactRoofTexture;
  group.userData.fixedWalkwayTranslucentBacking = false;
  group.userData.fixedWalkwayProceduralSkinMeshCount = 0;
  group.userData.fixedWalkwayPackageMeshMaterialOnly = true;
  return marker;
}
