const HIDDEN_REPETITIVE_DETAIL = /AIR_Jetway01_(?:HorizontalRibs|VerticalRibs|PanelSeams)/i;
const LARGE_SHADOW_CASTER = /AIR_Jetway01_(?:OuterTelescopingTunnels|InnerTelescopingTunnels|AircraftCabins|Rotundas|WallCollars)/i;

function tuneSharedMaterial(material, labels) {
  if (!material) return;
  const label = `${labels} ${material.name || ""}`;
  if (/HorizontalRibs|VerticalRibs|PanelSeams|structural|frame|trim/i.test(label)) {
    material.color?.setHex(0xa1a5a6);
    material.roughness = 0.74;
    material.metalness = 0.2;
  } else if (/OuterTelescopingTunnels|InnerTelescopingTunnels|FixedTerminalWalkways|WallCollars|Rotundas|AircraftCabins|exact-source/i.test(label)) {
    material.color?.setHex(material.map ? 0xffffff : 0xe9e7e1);
    material.emissive?.setHex(0x202020);
    material.emissiveIntensity = Math.max(Number(material.emissiveIntensity) || 0, 0.3);
    material.roughness = 0.78;
    material.metalness = 0.04;
  } else if (/Window|Glass/i.test(label)) {
    material.color?.setHex(0x29404b);
    material.roughness = 0.24;
    material.metalness = 0.06;
  } else if (/galvanized|LiftColumns|WheelBogies|Axles|SupportFeet/i.test(label)) {
    material.color?.setHex(0x8f9496);
    material.roughness = 0.64;
    material.metalness = 0.34;
  }
  material.needsUpdate = true;
}

export function applyTerminal4JetwaySimulatorPolish(group) {
  if (!group?.isGroup) throw new Error("Terminal 4 jetway simulator polish requires the source-placed jetway group");
  const materialLabels = new Map();
  let hiddenRepetitiveMeshCount = 0;
  let reducedShadowCasterCount = 0;

  group.traverse((entry) => {
    if (!entry.isMesh) return;
    const name = entry.name || "";
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material) continue;
      if (!materialLabels.has(material)) materialLabels.set(material, new Set());
      materialLabels.get(material).add(name || "unnamed");
    }

    if (HIDDEN_REPETITIVE_DETAIL.test(name)) {
      entry.visible = false;
      entry.castShadow = false;
      hiddenRepetitiveMeshCount += 1;
    } else {
      entry.castShadow = LARGE_SHADOW_CASTER.test(name);
      if (!entry.castShadow) reducedShadowCasterCount += 1;
    }
    entry.receiveShadow = true;
    entry.frustumCulled = true;
  });

  for (const [material, labels] of materialLabels) {
    tuneSharedMaterial(material, [...labels].join(" "));
  }

  group.userData.simulatorPolishAuthority = "exact-source-clean-shell-low-repetition-shadow-v13";
  group.userData.simulatorPolishMaterialCount = materialLabels.size;
  group.userData.simulatorPolishHiddenRepetitiveMeshCount = hiddenRepetitiveMeshCount;
  group.userData.simulatorPolishReducedShadowCasterCount = reducedShadowCasterCount;
  group.userData.simulatorPolishSilhouette = "exact-atlas-shells-with-procedural-ribs-and-seams-suppressed";
  return group;
}
