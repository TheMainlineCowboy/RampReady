const DENSITY_RULES = Object.freeze([
  Object.freeze({ pattern: /outer tunnel rib/i, keepEvery: 3 }),
  Object.freeze({ pattern: /inner tunnel rib/i, keepEvery: 3 }),
  Object.freeze({ pattern: /outer shell panel seam/i, keepEvery: 3 }),
  Object.freeze({ pattern: /inner shell panel seam/i, keepEvery: 3 }),
  Object.freeze({ pattern: /corrugation ridge/i, keepEvery: 3 }),
  Object.freeze({ pattern: /roof corrugation/i, keepEvery: 3 }),
  Object.freeze({ pattern: /underbridge crossmember/i, keepEvery: 2 }),
]);

const HIDDEN_DECORATIVE_DETAIL = /roof cable tray|cabin roof safety rail|cabin roof rail post/i;
const CORE_SHADOW_CASTER = /outer telescoping tunnel$|inner telescoping tunnel$|aircraft cabin$|rotunda body|wheel bogie|lift column/i;

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
    const name = entry.name || "";
    if (HIDDEN_DECORATIVE_DETAIL.test(name)) {
      entry.visible = false;
      return;
    }
    const rule = DENSITY_RULES.find(({ pattern }) => pattern.test(name));
    if (!rule) return;
    entry.visible = ordinal(name) % rule.keepEvery === 1;
  });
}

function tuneMaterial(material, name) {
  if (!material) return;
  const label = `${name || ""} ${material.name || ""}`;
  if (/panel frame|structural rib|panel seam|corrugation|crossmember|structural trim/i.test(label)) {
    material.color?.setHex(0xa2a6a7);
    material.roughness = 0.74;
    material.metalness = 0.2;
  }
  if (/outer shell|inner shell|aircraft cabin shell|roof cap|exact-source/i.test(label)) {
    material.color?.setHex(0xffffff);
    material.emissive?.setHex(0x202020);
    material.emissiveIntensity = Math.max(Number(material.emissiveIntensity) || 0, 0.32);
    material.roughness = 0.78;
    material.metalness = 0.04;
  }
  if (/galvanized|lift column|axle|bogie/i.test(label)) {
    material.color?.setHex(0x8e9496);
    material.roughness = 0.64;
    material.metalness = 0.34;
  }
  if (/glass|window/i.test(label)) {
    material.color?.setHex(0x29404b);
    material.roughness = 0.24;
    material.metalness = 0.06;
  }
  material.needsUpdate = true;
}

function tuneMaterialsAndShadows(root) {
  const visited = new Set();
  root.traverse((entry) => {
    if (!entry.isMesh) return;
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material || visited.has(material.uuid)) continue;
      visited.add(material.uuid);
      tuneMaterial(material, entry.name);
    }
    entry.castShadow = CORE_SHADOW_CASTER.test(entry.name || "");
    entry.receiveShadow = true;
    entry.frustumCulled = true;
  });
}

export function applyA1JetwaySimulatorPolish(root) {
  if (!root?.isGroup) throw new Error("A1 simulator polish requires the animated jetway group");
  const controller = root.userData?.controller;
  if (!controller?.setDeployment) throw new Error("A1 simulator polish requires the animated jetway controller");

  tuneMaterialsAndShadows(root);
  applyDetailDensity(root);

  const setDeployment = controller.setDeployment.bind(controller);
  controller.setDeployment = (value) => {
    setDeployment(value);
    applyDetailDensity(root);
  };

  root.userData.simulatorPolishAuthority = "clean-enclosed-soft-galvanized-low-repetition-v13";
  root.userData.simulatorPolishDensity = "one-in-three-ribs-seams-and-corrugation";
  root.userData.simulatorPolishMaterial = "ambient-lifted-exact-source-shell-soft-galvanized-frame";
  root.userData.simulatorPolishHiddenDetail = "overscale-roof-cable-tray-and-cabin-roof-rails";
  controller.setDeployment(controller.getDeployment());
  return root;
}
