import { readFile } from "node:fs/promises";

const modelPath = new URL("../src/components/aircraft/crj700Model.js", import.meta.url);
const source = await readFile(modelPath, "utf8");

const requiredRoles = [
  "supplemental-landing-gear",
  "intentional-livery-overlay",
  "operational-light",
  "training-capture-marker",
];

for (const role of requiredRoles) {
  if (!source.includes(`\"${role}\"`)) {
    throw new Error(`CRJ700 retention verification failed: missing approved role ${role}.`);
  }
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

if (!source.includes("if (child !== realModel && !retainedProceduralChildren.has(child)) child.visible = false;")) {
  throw new Error("CRJ700 retention verification failed: procedural fallback hiding logic changed unexpectedly.");
}

console.log("CRJ700 retention policy passed: only supplemental gear, intentional livery, operational lights, and the training marker remain after real-model load.");
