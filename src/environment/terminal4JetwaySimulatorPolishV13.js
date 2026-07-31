function tuneSharedMaterial(material, labels) {
  if (!material) return;
  const label = `${labels} ${material.name || ""}`;
  if (/TunnelFrames|PanelSeams|structural|frame|trim/i.test(label)) {
    material.color?.setHex(0x8a9093);
    material.roughness = 0.7;
    material.metalness = 0.26;
  } else if (/OuterTunnels|InnerTunnels|FixedTerminalWalkways|WallCollars|RotundaBodies|Cabins/i.test(label)) {
    material.color?.setHex(material.map ? 0xffffff : 0xe6e4de);
    material.roughness = 0.76;
    material.metalness = 0.06;
  } else if (/Window|Glass/i.test(label)) {
    material.color?.setHex(0x273942);
    material.roughness = 0.2;
    material.metalness = 0.08;
  }
  material.needsUpdate = true;
}

export function applyTerminal4JetwaySimulatorPolish(group) {
  if (!group?.isGroup) throw new Error("Terminal 4 jetway simulator polish requires the source-placed jetway group");
  const materialLabels = new Map();
  let repeatedShadowCasterCount = 0;

  group.traverse((entry) => {
    if (!entry.isMesh) return;
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material) continue;
      if (!materialLabels.has(material)) materialLabels.set(material, new Set());
      materialLabels.get(material).add(entry.name || "unnamed");
    }
    if (/TunnelFrames|PanelSeams|FacadeVent/i.test(entry.name || "")) {
      entry.castShadow = false;
      repeatedShadowCasterCount += 1;
    } else {
      entry.castShadow = true;
    }
    entry.receiveShadow = true;
    entry.frustumCulled = true;
  });

  for (const [material, labels] of materialLabels) {
    tuneSharedMaterial(material, [...labels].join(" "));
  }

  group.userData.simulatorPolishAuthority = "source-texture-soft-galvanized-low-repetition-shadow-v13";
  group.userData.simulatorPolishMaterialCount = materialLabels.size;
  group.userData.simulatorPolishReducedShadowCasterCount = repeatedShadowCasterCount;
  return group;
}
