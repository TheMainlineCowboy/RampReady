import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "static-own-parking-terminal-wall-anchor-v1";
const cornerMarker = "static-a10-a12-corner-source-pivot-wall-plane-v2";
const compactLengthMarker = "static-a3plus-photo-compact-gate-specific-bridge-end-v1";
let source = fs.readFileSync(runtimePath, "utf8");

// A1 is intentionally excluded: its real Terminal 4 architecture is the long
// fixed elevated corridor + dogleg + remote Rotunda, followed by the supplied
// movable bridge. A3+ use much shorter/direct terminal-side Rotunda connections.
// Keep those static movable bridges gate-specific, but compact enough that the
// supplied hood/bellows do not turn a short parked bridge into a full-reach span.
// This only changes the articulation target; the exact supplied GLB meshes,
// hierarchy, materials and UVs remain untouched and may telescope inward only.
const staleCompactLength = '      : 11.9 + (exactUploadedGateCode % 4) * 0.65;';
const photoCompactLength = `      // ${compactLengthMarker}\n      : 8.2 + (exactUploadedGateCode % 5) * 0.45;`;
if (!source.includes(compactLengthMarker)) {
  if (!source.includes(staleCompactLength)) {
    throw new Error(`${runtimePath}: static A3+ compact bridge-end anchor is missing`);
  }
  source = source.replace(staleCompactLength, photoCompactLength);
}

// Replace the first-generation nearest-point corner helper if it is already
// present. The v1 helper still collapsed A10/A12 because it chose a point;
// v2 identifies a real authored facade PLANE and carries that plane forward so
// the registrar can preserve each original KPHX source pivot's tangential
// coordinate along the terminal.
source = source.replace(
  /function findNearestStaticCornerTerminalConnection\([\s\S]*?\n}\n\n(?=function findTerminalWallDistance)/,
  "",
);

if (!source.includes(cornerMarker)) {
  const helperAnchor = "function findTerminalWallDistance(THREE, terminal, originX, originZ, towardX, towardZ, height) {";
  if (!source.includes(helperAnchor)) throw new Error(`${runtimePath}: terminal wall-distance helper anchor is missing`);
  const helper = `function findStaticCornerWallPlane(THREE, terminal, originX, originZ, preferredX, preferredZ, height) {\n  // ${cornerMarker}\n  if (!terminal?.isObject3D) return null;\n  terminal.updateMatrixWorld(true);\n  const origin = new THREE.Vector3(originX, height, originZ);\n  const preferredMagnitude = Math.hypot(preferredX, preferredZ);\n  if (!(preferredMagnitude > 0.9)) return null;\n  const preferred = new THREE.Vector3(preferredX / preferredMagnitude, 0, preferredZ / preferredMagnitude);\n  const baseAngle = Math.atan2(preferred.x, preferred.z);\n  let best = null;\n  // Search only the terminal-facing hemisphere. Prefer a nearby structural face\n  // whose normal meaningfully faces the source pivot; the hit POINT is not the\n  // final anchor. The source pivot is projected onto the selected face plane\n  // later so A10/A12 retain their authored lateral separation.\n  const samples = 97;\n  for (let sample = 0; sample < samples; sample += 1) {\n    const fraction = sample / (samples - 1);\n    const angle = baseAngle - Math.PI / 2 + fraction * Math.PI;\n    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));\n    const raycaster = new THREE.Raycaster(origin, direction, 0.05, 48);\n    const hits = raycaster.intersectObject(terminal, true);\n    for (const hit of hits) {\n      if (!(hit?.distance > 0.05 && hit.distance <= 48) || hit.object?.visible === false || !hit.face) continue;\n      const materials = Array.isArray(hit.object?.material) ? hit.object.material : [hit.object?.material];\n      const material = materials[hit.face?.materialIndex ?? 0] ?? materials[0];\n      if (!/BGATE|DGATE|PHX_TERM400/i.test(material?.name || \"\")) continue;\n      const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);\n      const normal = hit.face.normal.clone().applyMatrix3(normalMatrix);\n      normal.y = 0;\n      if (normal.lengthSq() < 0.25) continue;\n      normal.normalize();\n      // connectorToward points from apron/source toward the terminal.\n      if (normal.dot(preferred) < 0) normal.multiplyScalar(-1);\n      const facing = normal.dot(preferred);\n      if (facing < 0.28) continue;\n      const score = hit.distance + (1 - facing) * 3.0;\n      if (!best || score < best.score) {\n        best = {\n          distance: hit.distance,\n          towardX: direction.x,\n          towardZ: direction.z,\n          wallPointX: hit.point.x,\n          wallPointZ: hit.point.z,\n          wallNormalX: normal.x,\n          wallNormalZ: normal.z,\n          wallMaterialName: material?.name || \"unknown\",\n          score,\n          authority: \"static-kphx-corner-source-pivot-wall-plane-v2\",\n        };\n      }\n      break;\n    }\n  }\n  return best;\n}\n\n`;
  source = source.replace(helperAnchor, `${helper}${helperAnchor}`);
}

// Migrate either the original source-heading priority or the v1/v2 own-parking
// block to the final corner-plane selection.
source = source.replace(
  /    const cornerTerminalConnection = \(jetway\.g === "A10" \|\| jetway\.g === "A12"\)[\s\S]*?    const resolvedTerminalConnection = jetway\.g === "A1"\n      \? terminalConnection\n      : \(cornerTerminalConnection \|\| terminalConnection \|\| sourceHeadingTerminalConnection\);/,
  `    const cornerWallPlane = (jetway.g === "A10" || jetway.g === "A12")\n      ? findStaticCornerWallPlane(\n        THREE,\n        terminal,\n        jetway.x,\n        jetway.z + sourceOffsetZ,\n        -ux,\n        -uz,\n        rotundaY,\n      )\n      : null;\n    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (cornerWallPlane || terminalConnection || sourceHeadingTerminalConnection);`,
);

if (!source.includes("cornerWallPlane")) {
  const oldBlocks = [
    `    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (sourceHeadingTerminalConnection || terminalConnection);`,
    `    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (terminalConnection || sourceHeadingTerminalConnection);`,
  ];
  const oldBlock = oldBlocks.find((block) => source.includes(block));
  if (!oldBlock) throw new Error(`${runtimePath}: static wall-priority block is missing before corner-plane migration`);
  source = source.replace(
    oldBlock,
    `    // ${marker}\n    const cornerWallPlane = (jetway.g === "A10" || jetway.g === "A12")\n      ? findStaticCornerWallPlane(\n        THREE, terminal, jetway.x, jetway.z + sourceOffsetZ, -ux, -uz, rotundaY,\n      )\n      : null;\n    const resolvedTerminalConnection = jetway.g === "A1"\n      ? terminalConnection\n      : (cornerWallPlane || terminalConnection || sourceHeadingTerminalConnection);`,
  );
}

// Carry the corner face plane into the exact-GLB placement record. Z is returned
// to the A1-local coordinate frame by removing the Terminal-4 scene offset.
const placementAnchor = `      connectorTowardX,\n      connectorTowardZ,\n    });`;
if (source.includes(placementAnchor) && !source.includes("staticCornerWallPlaneAuthority")) {
  source = source.replace(
    placementAnchor,
    `      connectorTowardX,\n      connectorTowardZ,\n      staticCornerWallPointX: cornerWallPlane?.wallPointX ?? null,\n      staticCornerWallPointZ: cornerWallPlane?.wallPointZ != null ? cornerWallPlane.wallPointZ - sourceOffsetZ : null,\n      staticCornerWallNormalX: cornerWallPlane?.wallNormalX ?? null,\n      staticCornerWallNormalZ: cornerWallPlane?.wallNormalZ ?? null,\n      staticCornerWallMaterialName: cornerWallPlane?.wallMaterialName ?? null,\n      staticCornerWallPlaneAuthority: cornerWallPlane?.authority ?? null,\n    });`,
  );
}

for (const required of [
  marker,
  cornerMarker,
  compactLengthMarker,
  "function findStaticCornerWallPlane",
  'jetway.g === "A10" || jetway.g === "A12"',
  "staticCornerWallPointX",
  "staticCornerWallNormalX",
  "staticCornerWallPlaneAuthority",
  ': (cornerWallPlane || terminalConnection || sourceHeadingTerminalConnection);',
  ': 8.2 + (exactUploadedGateCode % 5) * 0.45;',
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: static corner/photo-compact contract is missing ${required}`);
}
for (const forbidden of [
  "function findNearestStaticCornerTerminalConnection",
  ': (sourceHeadingTerminalConnection || terminalConnection);',
  ': (terminalConnection || sourceHeadingTerminalConnection);',
  staleCompactLength,
]) {
  if (source.includes(forbidden)) throw new Error(`${runtimePath}: stale static corner/length contract survived: ${forbidden}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Resolved A10/A12 to authored terminal face planes and tightened only A3+ to photo-compact gate-specific inward telescope targets; A1 remains excluded with its long fixed corridor/dogleg/remote-Rotunda architecture and no supplied GLB geometry is stretched or replaced.");
