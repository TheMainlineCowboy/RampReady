import fs from "node:fs";

const pavement = fs.readFileSync("scripts/prepare-kphx-source-aerial-priority-v41.mjs", "utf8");
const production = fs.readFileSync("scripts/build-production-simulator-quality.mjs", "utf8");
const evidence = fs.readFileSync("scripts/prepare-phx-runtime-evidence.mjs", "utf8");

for (const token of [
  "full-source-aerial-primary-with-subtle-package-surface-detail-v41",
  "material.opacity = 0.18",
  "material.opacity = 0.2",
  "material.opacity = 0.14",
  "material.depthWrite = false",
  "material.userData.sourceAerialPriority = true",
  "environment.userData.authoredGroundSourceAerialPriority = true",
  "environment.userData.authoredGroundNearfieldDetailOpacity = 0.18",
]) {
  if (!pavement.includes(token)) throw new Error(`KPHX source-aerial pavement contract is missing ${token}`);
}

for (const forbidden of [
  'nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background"',
  'nearfieldBlendMode = "opaque-authored-asphalt-over-aerial-background"',
  'nearfieldBlendMode = "opaque-authored-service-road-over-aerial-background"',
]) {
  if (pavement.includes(forbidden)) throw new Error(`KPHX pavement still contains opaque aerial-masking authority: ${forbidden}`);
}

if (!production.includes('await runNode("scripts/prepare-kphx-source-aerial-priority-v41.mjs")')) {
  throw new Error("Production build does not run KPHX source-aerial pavement priority after the nearfield pass");
}

for (const token of [
  "dataset.groundPavementAuthority = environment.userData.authoredGroundPavementAuthority",
  "dataset.groundSourceAerialPriority = String(environment.userData.authoredGroundSourceAerialPriority === true)",
  "dataset.groundNearfieldDetailOpacity = String(environment.userData.authoredGroundNearfieldDetailOpacity",
]) {
  if (!evidence.includes(token)) throw new Error(`KPHX source-aerial runtime evidence is missing ${token}`);
}

console.log("Verified full KPHX source aerial as visible pavement authority with subtle non-depth-writing surface detail and browser evidence.");
