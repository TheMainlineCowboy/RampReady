import fs from "node:fs";

const runtimePath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const measuredMarker = "static-a14-terminal-corner-connector-inclusive-zero-overlap-articulation-v3";
const measuredAuthority = "a14-terminal-corner-exact-arm-minus-11.5deg-connector-inclusive-zero-overlap-v3";
const source = fs.readFileSync(runtimePath, "utf8");

for (const required of [
  measuredMarker,
  measuredAuthority,
  "staticCornerArmArticulationDegrees = -11.5",
  "uploadedJetwayStaticA14CornerArmArticulationDegrees = -11.5",
  "const finalOccupiedCenterlines = staticRegisteredPlacements.map(staticFinalOccupiedCenterline);",
  "const staticExactPartOverlaps = [];",
  "if (staticExactPartOverlaps.length)",
  "Static Terminal 4 exact supplied part envelopes overlap after final registration/telescoping",
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: measured A14/full-fleet overlap authority is missing ${required}`);
  }
}

for (const retired of [
  "static-a14-vs-a12-zero-raw-overlap-refinement-v7",
  "static-a14-vs-a12-minimum-clear-angle-refinement-v6",
  "static-a14-vs-a12-clean-articulation-sweep-v5",
  "static-a12-a14-articulation-exact-envelope-sweep-v4",
  "static-a14-terminal-corner-measured-zero-overlap-articulation-v2",
  "a14-terminal-corner-exact-arm-minus-7.5deg-zero-raw-overlap-v2",
]) {
  if (source.includes(retired)) {
    throw new Error(`${runtimePath}: retired body-only/temporary overlap authority survived production promotion: ${retired}`);
  }
}

console.log("Verified measured A14 -11.50 degree connector-inclusive zero-overlap articulation and restored the unmodified fail-closed full 57-gate supplied-part validator; generated terminal sleeves are validated separately by the connector-inclusive guard.");
