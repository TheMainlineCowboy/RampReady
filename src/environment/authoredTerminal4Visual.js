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
  materialPass: "procedural-terminal4-source-materials-v2",
});

const textureCache = new Map();

function textureKind(materialName = "") {
  const name = materialName.toUpperCase();
  if (name.includes("PHX_TERM400")) return "terminal";
  if (name.includes("BGATE") || name.includes("DGATE")) return "gate";
  if (name.includes("PARKRAMP")) return "ramp";
  if (name.includes("SUPPORT")) return "support";
  if (name.includes("T4_WALK")) return "walkway";
  if (name.includes("RAMPLIGHT")) return "light";
  if (name.includes("RW.")) return "road";
  return "terminal";
}

function createTexture(THREE, kind) {
  if (textureCache.has(kind)) return textureCache.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (kind === "terminal") {
    ctx.fillStyle = "#9b8975";
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 128) {
      ctx.fillStyle = y % 256 === 0 ? "#a79580" : "#96816c";
      ctx.fillRect(0, y, 512, 128);
      ctx.fillStyle = "#263846";
      ctx.fillRect(0, y + 35, 512, 34);
      ctx.fillStyle = "rgba(175,205,220,0.24)";
      for (let x = 8; x < 512; x += 42) ctx.fillRect(x, y + 39, 29, 25);
    }
    ctx.strokeStyle = "rgba(72,59,47,0.48)";
    ctx.lineWidth = 3;
    for (let x = 0; x <= 512; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
  } else if (kind === "gate") {
    ctx.fillStyle = "#78858d";
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#273b49";
    ctx.fillRect(0, 96, 512, 122);
    ctx.fillStyle = "rgba(188,216,228,0.34)";
    for (let x = 8; x < 512; x += 55) ctx.fillRect(x, 106, 39, 100);
    ctx.strokeStyle = "rgba(45,51,55,0.55)";
    ctx.lineWidth = 4;
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
  } else if (kind === "ramp") {
    ctx.fillStyle = "#696d6e";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(45,48,50,0.62)";
    ctx.lineWidth = 5;
    for (let p = 0; p <= 512; p += 128) {
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(512, p); ctx.stroke();
    }
  } else if (kind === "support") {
    ctx.fillStyle = "#42484c";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#778086";
    ctx.lineWidth = 16;
    for (let x = -256; x < 768; x += 96) {
      ctx.beginPath(); ctx.moveTo(x, 512); ctx.lineTo(x + 320, 0); ctx.stroke();
    }
  } else if (kind === "walkway") {
    ctx.fillStyle = "#ada291";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(79,70,62,0.4)";
    ctx.lineWidth = 4;
    for (let x = 0; x <= 512; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 96) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
  } else if (kind === "light") {
    ctx.fillStyle = "#596067";
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#f0c869";
    ctx.fillRect(96, 96, 320, 320);
  } else {
    ctx.fillStyle = "#3f4549";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(220,220,210,0.55)";
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();
  }

  const grime = ctx.createLinearGradient(0, 0, 0, 512);
  grime.addColorStop(0, "rgba(255,255,255,0.10)");
  grime.addColorStop(0.62, "rgba(255,255,255,0)");
  grime.addColorStop(1, "rgba(25,28,30,0.25)");
  ctx.fillStyle = grime;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "terminal" ? 2.5 : 1.5, 1.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(kind, texture);
  return texture;
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
      const kind = textureKind(material.name);
      material.map = createTexture(THREE, kind);
      if (material.color) material.color.setHex(0xffffff);
      material.roughness = kind === "gate" ? 0.52 : 0.8;
      material.metalness = kind === "support" || kind === "light" ? 0.42 : 0.04;
      if (kind === "gate") {
        material.transparent = true;
        material.opacity = 0.94;
      }
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
  environment.userData.authoredTerminal4MaterialPass = AUTHORED_TERMINAL4_PROFILE.materialPass;
  environment.userData.authoredTerminal4TriangleCount = AUTHORED_TERMINAL4_PROFILE.triangleCount;
  environment.userData.authoredTerminal4PartCount = AUTHORED_TERMINAL4_PROFILE.partCount;
  return authored;
}
