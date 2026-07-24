import { readFile } from "node:fs/promises";

const modelPath = new URL("../src/components/aircraft/crj700Model.js", import.meta.url);
const source = await readFile(modelPath, "utf8");

const requiredRoles = [
  "supplemental-landing-gear",
  "operational-light",
  "training-capture-marker",
];

for (const role of requiredRoles) {
  if (!source.includes(`"${role}"`)) {
    throw new Error(`CRJ700 retention verification failed: missing approved role ${role}.`);
  }
}

if (source.includes('"intentional-livery-overlay"') || source.includes("buildAmericanEagleMarkings")) {
  throw new Error("CRJ700 retention verification failed: livery overlay geometry is still retained outside the selected model.");
}

const forbiddenRetainedBodyMarkers = [
  "retain(box(0.68, 0.34, 0.72",
  "retain(box(0.035, 0.13, 20.0",
  "retain(box(1.52, 0.12, 17.8",
  "retain(box(0.025, 0.92, 0.55",
  "retain(box(0.035, 0.12, 0.22",
];

for (const marker of forbiddenRetainedBodyMarkers) {
  if (source.includes(marker)) {
    throw new Error(`CRJ700 retention verification failed: procedural body marker remains retained: ${marker}`);
  }
}

if (!source.includes("mesh.userData.retainedProceduralRole = role;")) {
  throw new Error("CRJ700 retention verification failed: retained meshes are not role-tagged.");
}

for (const marker of [
  "if (child === realModel) continue;",
  'role === "operational-light"',
  'role === "training-capture-marker"',
  'role === "supplemental-landing-gear"',
  "!result.preserveMaterials",
  "child.visible = keep;",
]) {
  if (!source.includes(marker)) throw new Error(`CRJ700 retention verification failed: selected-aircraft hiding policy missing ${marker}.`);
}

if (source.includes("retainedProceduralChildren.has(child)")) {
  throw new Error("CRJ700 retention verification failed: obsolete all-real-model retention logic remains.");
}
if (!source.includes('"authored-materials-preserved"')) {
  throw new Error("CRJ700 retention verification failed: authored-material state marker is missing.");
}

console.log("CRJ700 retention policy passed: authored aircraft keeps its own body, livery and landing gear; only operational lights and the training marker remain, while supplemental procedural gear is retained solely for the fallback asset.");
