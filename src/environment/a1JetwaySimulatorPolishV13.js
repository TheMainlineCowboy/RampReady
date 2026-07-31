const DENSITY_RULES = Object.freeze([
  Object.freeze({ pattern: /outer tunnel rib/i, keepEvery: 2 }),
  Object.freeze({ pattern: /inner tunnel rib/i, keepEvery: 2 }),
  Object.freeze({ pattern: /outer shell panel seam/i, keepEvery: 2 }),
  Object.freeze({ pattern: /inner shell panel seam/i, keepEvery: 2 }),
  Object.freeze({ pattern: /corrugation ridge/i, keepEvery: 2 }),
  Object.freeze({ pattern: /roof corrugation/i, keepEvery: 2 }),
  Object.freeze({ pattern: /underbridge crossmember/i, keepEvery: 2 }),
]);

function ordinal(name) {
  const label = String(name || "");
  const indexedFeature = label.match(/(?:tunnel rib|panel seam|corrugation(?: ridge)?|crossmember)\s+(-?\d+(?:\.\d+)?)/i);
  const trailingNumber = label.match(/(-?\d+(?:\.\d+)?)\s*$/);
  const match = indexedFeature || trailingNumber;
  if (!match) return 1;
  const value = Math.abs(Math.round(Number(match[1])));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function applyDetailDensity(root) {
  root.traverse((entry) => {
    const rule = DENSITY_RULES.find(({ pattern }) => pattern.test(entry.name || ""));
    if (!rule) return;
    entry.visible = ordinal(entry.name) % rule.keepEvery === 1;
  });
}

function tuneMaterial(material, name) {
  if (!material) return;
  const label = `${name || ""} ${material.name || ""}`;
  if (/panel frame|structural rib|panel seam|corrugation|crossmember/i.test(label)) {
    material.color?.setHex(0x858c8f);
    material.roughness = 0.68;
    material.metalness = 0.28;
  }
  if (/outer shell|inner shell|aircraft cabin shell|roof cap/i.test(label)) {
    material.color?.setHex(0xe7e6e0);
    material.roughness = 0.76;
    material.metalness = 0.06;
  }
  if (/glass|window/i.test(label)) {
    material.color?.setHex(0x23343d);
    material.roughness = 0.22;
    material.metalness = 0.08;
  }
  material.needsUpdate = true;
}

function tuneMaterials(root) {
  const visited = new Set();
  root.traverse((entry) => {
    if (!entry.isMesh) return;
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material || visited.has(material.uuid)) continue;
      visited.add(material.uuid);
      tuneMaterial(material, entry.name);
    }
    entry.castShadow = true;
    entry.receiveShadow = true;
    entry.frustumCulled = true;
  });
}

export function applyA1JetwaySimulatorPolish(root) {
  if (!root?.isGroup) throw new Error("A1 simulator polish requires the animated jetway group");
  const controller = root.userData?.controller;
  if (!controller?.setDeployment) throw new Error("A1 simulator polish requires the animated jetway controller");

  tuneMaterials(root);
  applyDetailDensity(root);

  const setDeployment = controller.setDeployment.bind(controller);
  controller.setDeployment = (value) => {
    setDeployment(value);
    applyDetailDensity(root);
  };

  root.userData.simulatorPolishAuthority = "reduced-repetition-soft-galvanized-structural-detail-v13";
  root.userData.simulatorPolishDensity = "alternating-structural-ribs-seams-and-corrugation";
  root.userData.simulatorPolishMaterial = "soft-galvanized-frame-warm-light-shell";
  controller.setDeployment(controller.getDeployment());
  return root;
}
