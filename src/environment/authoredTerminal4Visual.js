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
  provisionalOffset: Object.freeze([0, 0, 300]),
  placementAuthority: "legacy Terminal 4 massing retained behind exact KPHX 1.8.1 A/B gate modules",
});

function fallbackColorFor(materialName = "") {
  const name = materialName.toUpperCase();
  if (name.includes("PHX_TERM400")) return 0x9f896f;
  if (name.includes("BGATE") || name.includes("DGATE")) return 0x4e6678;
  if (name.includes("PARKRAMP")) return 0x555a5e;
  if (name.includes("SUPPORT")) return 0x4d5155;
  if (name.includes("T4_WALK")) return 0xb0a18b;
  if (name.includes("RAMPLIGHT")) return 0x666c71;
  if (name.includes("RW.")) return 0x494d52;
  return 0x9b9287;
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
      material.roughness = Math.max(0.58, material.roughness ?? 0.8);
      material.metalness = Math.min(0.16, material.metalness ?? 0);
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
