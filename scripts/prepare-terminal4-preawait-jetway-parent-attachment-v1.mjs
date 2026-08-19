import fs from "node:fs";

const path = "src/environment/authoredTerminal4Visual.js";
const marker = "terminal4-preawait-exact-jetway-parent-attachment-v2";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(marker)) {
  // Late Terminal 4 preparers can legitimately insert validation/cleanup lines
  // between construction of the exact jetway group and the readiness guard. Do
  // not depend on those two statements remaining adjacent. Insert immediately
  // after the unique construction statement instead, then prove ordering below.
  const buildLine = "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);";
  const buildCount = source.split(buildLine).length - 1;
  if (buildCount !== 1) {
    throw new Error(`${path}: expected one exact-jetway construction statement, found ${buildCount}`);
  }
  const attachment = `${buildLine}\n  // ${marker}\n  // The deferred per-gate pavement registration needs the exact jetway group to\n  // share the live environment ancestor with the concurrently loaded KPHX ADEX\n  // ground. Attach only the jetway group before awaiting its readiness promise;\n  // the authored terminal is still added at the normal validated handoff below.\n  // Re-adding sourcePlacedJetways later is idempotent in THREE and preserves its\n  // transforms while allowing the ground-registration promise to resolve.\n  environment.add(sourcePlacedJetways);\n  sourcePlacedJetways.updateMatrixWorld(true);`;
  source = source.replace(buildLine, attachment);
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

const buildIndex = source.indexOf("const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways");
const attachIndex = source.indexOf("environment.add(sourcePlacedJetways);");
const awaitIndex = source.indexOf("await sourcePlacedJetways.userData.uploadedJetwayReady;");
const finalAddIndex = source.indexOf("environment.add(authored, sourcePlacedJetways);");
if (!(buildIndex >= 0 && buildIndex < attachIndex && attachIndex < awaitIndex && awaitIndex < finalAddIndex)) {
  throw new Error(`${path}: exact jetway group must construct, attach, resolve readiness, then enter final terminal handoff in that order`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: late Terminal 4 preparers may change nearby validation text, but the exact jetway group is still attached to the live environment immediately after construction and before deferred KPHX pavement readiness.`);
