import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-source-direction-candidate-filter-v1";
const MINIMUM_A1_SOURCE_DIRECTION_DOT = 0.75;
let source = fs.readFileSync(runtimePath, "utf8");

// The grounded-wall preparer intentionally disabled direction discrimination at
// ramp height and the later hierarchy pass restored only a 0.15 hemisphere
// check. Visual evidence proved that this admits the elevated connector-side
// facade because the nearest terminal-looking triangle can be badly misaligned
// with the decoded KPHX A1 terminal-side axis. Filter candidates themselves by
// the source axis so the wrong surface cannot win merely by being closer.
if (!source.includes(marker)) {
  const oldCandidateGate = `      if (requirePreferredHemisphere && directionDot < 0.15) {
        if (!diagnostics.nearestDirectionRejected || horizontalDistance < diagnostics.nearestDirectionRejected.distance) {`;
  const sourceAlignedCandidateGate = `      // ${marker}
      const minimumDirectionDot = forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15;
      if (requirePreferredHemisphere && directionDot < minimumDirectionDot) {
        diagnostics.sourceDirectionRejectedCount = (diagnostics.sourceDirectionRejectedCount || 0) + 1;
        diagnostics.minimumRequiredDirectionDot = minimumDirectionDot;
        if (!diagnostics.nearestDirectionRejected || horizontalDistance < diagnostics.nearestDirectionRejected.distance) {`;
  if (!source.includes(oldCandidateGate)) {
    throw new Error(`${runtimePath}: final A1 candidate direction gate is missing`);
  }
  source = source.replace(oldCandidateGate, sourceAlignedCandidateGate);

  const oldFinalGate = `      if (!(groundedTerminalDirectionDot >= 0.15)) {
        throw new Error(\`A1 grounded terminal-side direction is invalid: directionDot=\${groundedTerminalDirectionDot}; connection=\${JSON.stringify(groundedConnection)}\`);
      }`;
  const sourceAlignedFinalGate = `      if (!(groundedTerminalDirectionDot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT})) {
        throw new Error(\`A1 grounded terminal-side direction is invalid: directionDot=\${groundedTerminalDirectionDot}; minimum=${MINIMUM_A1_SOURCE_DIRECTION_DOT}; connection=\${JSON.stringify(groundedConnection)}\`);
      }`;
  if (!source.includes(oldFinalGate)) {
    throw new Error(`${runtimePath}: final A1 grounded direction acceptance gate is missing`);
  }
  source = source.replace(oldFinalGate, sourceAlignedFinalGate);

  const telemetryAnchor = `        walkwayHierarchyRejectedCount: diagnostics?.walkwayHierarchyRejectedCount ?? 0,
        elevatedWalkwayFootprintCount: diagnostics?.elevatedWalkwayFootprintCount ?? 0,`;
  const telemetryWithDirection = `        walkwayHierarchyRejectedCount: diagnostics?.walkwayHierarchyRejectedCount ?? 0,
        sourceDirectionRejectedCount: diagnostics?.sourceDirectionRejectedCount ?? 0,
        minimumRequiredDirectionDot: ${MINIMUM_A1_SOURCE_DIRECTION_DOT},
        selectedSourceDirectionDot: groundedTerminalDirectionDot,
        elevatedWalkwayFootprintCount: diagnostics?.elevatedWalkwayFootprintCount ?? 0,`;
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${runtimePath}: final A1 grounded telemetry anchor is missing`);
  }
  source = source.replace(telemetryAnchor, telemetryWithDirection);
}

for (const required of [
  marker,
  `forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15`,
  "diagnostics.sourceDirectionRejectedCount",
  `groundedTerminalDirectionDot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT}`,
  `minimumRequiredDirectionDot: ${MINIMUM_A1_SOURCE_DIRECTION_DOT}`,
  "selectedSourceDirectionDot: groundedTerminalDirectionDot",
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: final source-direction candidate filter is missing ${required}`);
  }
}
if (source.includes("if (!(groundedTerminalDirectionDot >= 0.15))")) {
  throw new Error(`${runtimePath}: permissive A1 final 0.15 direction gate survived source-direction filtering`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Filtered final A1 ramp-level wall candidates against the decoded terminal-side source axis at dot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT}; connector-side surfaces can no longer win solely by nearest distance.`);
