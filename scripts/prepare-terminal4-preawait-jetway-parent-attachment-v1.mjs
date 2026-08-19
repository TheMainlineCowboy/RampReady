import fs from "node:fs";

const path = "src/environment/authoredTerminal4Visual.js";
const marker = "terminal4-preawait-exact-jetway-parent-attachment-v1";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(marker)) {
  const anchor = `  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);\n  if (!sourcePlacedJetways.userData.uploadedJetwayReady) {`;
  const replacement = `  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);\n  // ${marker}\n  // The deferred per-gate pavement registration needs the exact jetway group to\n  // share the live environment ancestor with the concurrently loaded KPHX ADEX\n  // ground. Attach only the jetway group before awaiting its readiness promise;\n  // the authored terminal is still added at the normal validated handoff below.\n  // Re-adding sourcePlacedJetways later is idempotent in THREE and preserves its\n  // transforms while allowing the ground-registration promise to resolve.\n  environment.add(sourcePlacedJetways);\n  sourcePlacedJetways.updateMatrixWorld(true);\n  if (!sourcePlacedJetways.userData.uploadedJetwayReady) {`;
  if (!source.includes(anchor)) {
    throw new Error(`${path}: pre-await exact-jetway attachment anchor is missing`);
  }
  source = source.replace(anchor, replacement);
}

for (const required of [
  marker,
  "environment.add(sourcePlacedJetways);",
  "await sourcePlacedJetways.userData.uploadedJetwayReady;",
  "environment.add(authored, sourcePlacedJetways);",
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: pre-await jetway parent attachment is missing ${required}`);
  }
}

const attachIndex = source.indexOf("environment.add(sourcePlacedJetways);");
const awaitIndex = source.indexOf("await sourcePlacedJetways.userData.uploadedJetwayReady;");
const finalAddIndex = source.indexOf("environment.add(authored, sourcePlacedJetways);");
if (!(attachIndex >= 0 && attachIndex < awaitIndex && awaitIndex < finalAddIndex)) {
  throw new Error(`${path}: exact jetway group must attach before readiness await and terminal handoff`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: the exact jetway group now shares the live environment before its deferred KPHX pavement registration is awaited, breaking the previous parent-attachment deadlock without moving terminal, aircraft, or supplied GLB children.`);
