import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const AUTHORED_TERMINAL4_PROFILE = Object.freeze({
  source: "TheMainlineCowboy/SkyHarborPhx@2e6642778c9c88eac6a82b21063763cc78be7cfe/scenery/term4.BGL",
  modelName: "phx_term400",
  triangleCount: 11138,
  partCount: 19,
  sourceBounds: Object.freeze({
    min: Object.freeze([-361.947998046875, 0, -213.22799682617188]),
    max: Object.freeze([488.2799987792969, 30.215999603271484, 266.8240051269531]),
  }),
  // Preserve the existing training origin while bringing the nearest authored Terminal 4
  // structure to approximately the same setback as the old calibration facade. Exact gate
  // registration remains blocked on KPHX_ADEX.BGL extraction and is not claimed here.
  provisionalOffset: Object.freeze([0, 0, 300]),
  placementAuthority: "provisional-visible-placement; KPHX_ADEX gate registration pending",
});

function fallbackColorFor(materialName = "") {
  const name = materialName.toUpperCase();
  if (name.includes("PHX_TERM400")) return 0xb7b2aa;
  if (name.includes("BGATE") || name.includes("DGATE")) return 0xa7adb1;
  if (name.includes("PARKRAMP")) return 0x747a80;
  if (name.includes("SUPPORT")) return 0x656a70;
  if (name.includes("T4_WALK")) return 0x969da3;
  if (name.includes("RAMPLIGHT")) return 0x777d82;
  if (name.includes("RW.")) return 0x5e6267;
  return 0xa3a7aa;
}

function hideCalibrationTerminal(environment) {
  environment.traverse((node) => {
    if (node.name === "TerminalFacadeModule" || node.name === "TerminalFacadeGlass") node.visible = false;
  });
}

function applyReadableSourceMaterials(THREE, scene) {
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const originals = Array.isArray(node.material) ? node.material : [node.material];
    const replacements = originals.map((source) => {
      if (!source?.clone) return source;
      const material = source.clone();
      if (material.color) material.color.setHex(fallbackColorFor(material.name));
      material.roughness = Math.max(0.62, material.roughness ?? 0.82);
      material.metalness = Math.min(0.18, material.metalness ?? 0);
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
      return material;
    });
    node.material = Array.isArray(node.material) ? replacements : replacements[0];
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

export async function installAuthoredTerminal4Visual(THREE, environment) {
  if (!environment?.isGroup) throw new Error("Terminal 4 environment group is required");
  hideCalibrationTerminal(environment);
  environment.userData.environmentSource = "loading-authored-phx-terminal4";
  environment.userData.authoredTerminal4Placement = AUTHORED_TERMINAL4_PROFILE.placementAuthority;

  const url = `${import.meta.env.BASE_URL}models/phx-terminal4/terminal4.gltf`;
  const gltf = await new GLTFLoader().loadAsync(url);
  const authored = gltf.scene;
  authored.name = "PHX_Terminal4_AuthoredVisual";
  authored.position.fromArray(AUTHORED_TERMINAL4_PROFILE.provisionalOffset);
  applyReadableSourceMaterials(THREE, authored);
  environment.add(authored);

  environment.userData.environmentSource = "authored-phx-terminal4";
  environment.userData.authoredTerminal4Url = url;
  environment.userData.authoredTerminal4 = authored;
  environment.userData.authoredTerminal4TriangleCount = AUTHORED_TERMINAL4_PROFILE.triangleCount;
  environment.userData.authoredTerminal4PartCount = AUTHORED_TERMINAL4_PROFILE.partCount;
  return authored;
}
