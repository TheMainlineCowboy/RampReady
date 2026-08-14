import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "static-own-parking-terminal-wall-anchor-v1";
const cornerMarker = "static-a10-a12-corner-nearest-authored-facade-v1";
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(cornerMarker)) {
  const helperAnchor = "function findTerminalWallDistance(THREE, terminal, originX, originZ, towardX, towardZ, height) {";
  if (!source.includes(helperAnchor)) {
    throw new Error(`${runtimePath}: terminal wall-distance helper anchor is missing`);
  }
  const helper = `function findNearestStaticCornerTerminalConnection(THREE, terminal, originX, originZ, preferredX, preferredZ, height) {\n  // ${cornerMarker}\n  // A10 and A12 sit on opposite faces of the same authored concourse corner.\n  // Their straight stand-centerline rays converge on the corner vertex and can\n  // collapse two replacement Rotundas into the same space. Resolve the nearest\n  // real structural facade in the terminal-side hemisphere around each original\n  // KPHX AIR_Jetway01 pivot instead of snapping both gates to that corner point.\n  if (!terminal?.isObject3D) return null;\n  terminal.updateMatrixWorld(true);\n  const origin = new THREE.Vector3(originX, height, originZ);\n  const preferredMagnitude = Math.hypot(preferredX, preferredZ);\n  if (!(preferredMagnitude > 0.9)) return null;\n  const baseAngle = Math.atan2(preferredX / preferredMagnitude, preferredZ / preferredMagnitude);\n  let nearest = null;\n  const samples = 73;\n  for (let sample = 0; sample < samples; sample += 1) {\n    const fraction = sample / (samples - 1);\n    const angle = baseAngle - Math.PI / 2 + fraction * Math.PI;\n    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));\n    const raycaster = new THREE.Raycaster(origin, direction, 0.05, 48);\n    const hit = raycaster.intersectObject(terminal, true).find((entry) => {\n      if (entry.object?.visible === false) return false;\n      const materials = Array.isArray(entry.object?.material) ? entry.object.material : [entry.object?.material];\n      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];\n      return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || \"\");\n    });\n    if (!(hit?.distance > 0.05 && hit.distance <= 48)) continue;\n    if (!nearest || hit.distance < nearest.distance) {\n      nearest = {\n        distance: hit.distance,\n        towardX: direction.x,\n        towardZ: direction.z,\n        authority: \"static-kphx-corner-nearest-authored-wall-v1\",\n      };\n    }\n  }\n  return nearest;\n}\n\n`;
  source = source.replace(helperAnchor, `${helper}${helperAnchor}`);
}

if (!source.includes(marker)) {
  const oldBlock = `    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (sourceHeadingTerminalConnection || terminalConnection);`;
  const newBlock = `    // ${marker}\n    // For static bridges, the actual KPHX stand geometry owns both sides of the\n    // rigid replacement. A10/A12 are the one authored concourse-corner pair\n    // whose direct terminal rays meet at the same corner vertex, so resolve each\n    // from the nearest real facade around its original KPHX jetway pivot.\n    const cornerTerminalConnection = (jetway.g === "A10" || jetway.g === "A12")\n      ? findNearestStaticCornerTerminalConnection(\n        THREE,\n        terminal,\n        jetway.x,\n        jetway.z + sourceOffsetZ,\n        -ux,\n        -uz,\n        rotundaY,\n      )\n      : null;\n    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (cornerTerminalConnection || terminalConnection || sourceHeadingTerminalConnection);`;
  if (!source.includes(oldBlock)) {
    throw new Error(`${runtimePath}: static source-heading wall-priority block is missing`);
  }
  source = source.replace(oldBlock, newBlock);
} else if (!source.includes("cornerTerminalConnection")) {
  const currentBlock = `    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (terminalConnection || sourceHeadingTerminalConnection);`;
  const upgradedBlock = `    const cornerTerminalConnection = (jetway.g === "A10" || jetway.g === "A12")\n      ? findNearestStaticCornerTerminalConnection(\n        THREE,\n        terminal,\n        jetway.x,\n        jetway.z + sourceOffsetZ,\n        -ux,\n        -uz,\n        rotundaY,\n      )\n      : null;\n    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (cornerTerminalConnection || terminalConnection || sourceHeadingTerminalConnection);`;
  if (!source.includes(currentBlock)) {
    throw new Error(`${runtimePath}: current static wall-priority block is missing before corner upgrade`);
  }
  source = source.replace(currentBlock, upgradedBlock);
}

for (const required of [
  marker,
  cornerMarker,
  "function findNearestStaticCornerTerminalConnection",
  'jetway.g === "A10" || jetway.g === "A12"',
  ': (cornerTerminalConnection || terminalConnection || sourceHeadingTerminalConnection);',
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: static corner wall-anchor contract is missing ${required}`);
  }
}
for (const forbidden of [
  ': (sourceHeadingTerminalConnection || terminalConnection);',
  ': (terminalConnection || sourceHeadingTerminalConnection);',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: stale static wall priority survived: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Anchored static Terminal 4 jetways to their own KPHX stand geometry, with A10/A12 resolved onto separate nearest authored terminal faces around their original source pivots instead of one shared concourse corner.");
