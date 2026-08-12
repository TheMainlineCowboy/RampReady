import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-decoded-kphx-terminal-wall-direction-v2";
const MINIMUM_A1_SOURCE_DIRECTION_DOT = 0.90;
const MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 34;
let source = fs.readFileSync(runtimePath, "utf8");

// Browser evidence from 5099979 proved the PHX_TERM400-only rule selected the
// elevated/corridor plane at z=-26.039. The same runtime inventory exposed a
// DGATE5 main-building face at x=-48.001 whose terminal-side vector is nearly
// collinear with the decoded KPHX A1 jetway heading. The previous so-called
// source-direction pass was still feeding -ux/-uz derived from the CRJ target.
// A1 wall selection now uses the decoded BGL jetway heading itself.
if (!source.includes(marker)) {
  const oldGroundedCall = `      const groundedConnection = findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        -ux,
        -uz,
        1.25,
        true,
      );`;
  const sourceHeadingGroundedCall = `      // ${marker}
      const groundedConnection = findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        -sourceJetwayForwardX,
        -sourceJetwayForwardZ,
        1.25,
        true,
      );`;
  if (!source.includes(oldGroundedCall)) {
    throw new Error(`${runtimePath}: A1 grounded wall search call is missing`);
  }
  source = source.replace(oldGroundedCall, sourceHeadingGroundedCall);

  const oldCandidateGate = `      if (requirePreferredHemisphere && directionDot < 0.15) {
        if (!diagnostics.nearestDirectionRejected || horizontalDistance < diagnostics.nearestDirectionRejected.distance) {`;
  const sourceAlignedCandidateGate = `      const minimumDirectionDot = forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15;
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
        throw new Error(\`A1 grounded decoded-KPHX terminal-side direction is invalid: directionDot=\${groundedTerminalDirectionDot}; minimum=${MINIMUM_A1_SOURCE_DIRECTION_DOT}; connection=\${JSON.stringify(groundedConnection)}\`);
      }`;
  if (!source.includes(oldFinalGate)) {
    throw new Error(`${runtimePath}: final A1 grounded direction acceptance gate is missing`);
  }
  source = source.replace(oldFinalGate, sourceAlignedFinalGate);

  const oldDistanceGate = `      if (!(groundedConnection.distance > 3.4
        && groundedConnection.distance < 28)) {
        throw new Error(\`A1 ramp-level real-terminal source wall distance is invalid: \${groundedConnection.distance}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }`;
  const sourceHeadingDistanceGate = `      if (!(groundedConnection.distance > 3.4
        && groundedConnection.distance < ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS})) {
        throw new Error(\`A1 ramp-level decoded-source terminal wall distance is invalid: \${groundedConnection.distance}; maximum=${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }`;
  if (!source.includes(oldDistanceGate)) {
    throw new Error(`${runtimePath}: A1 source wall distance gate is missing`);
  }
  source = source.replace(oldDistanceGate, sourceHeadingDistanceGate);

  const genericMaterialGate = `      const groundedMaterialReference = String(groundedConnection.materialReference || "");
      if (!/BGATE|DGATE|PHX_TERM400/i.test(groundedMaterialReference)) {
        throw new Error(\`A1 grounded search did not resolve the authored Terminal 4 structural material: \${groundedMaterialReference}\`);
      }`;
  if (!source.includes(genericMaterialGate)) {
    throw new Error(`${runtimePath}: generic structural A1 wall material gate is missing`);
  }

  const telemetryAnchor = `        walkwayHierarchyRejectedCount: diagnostics?.walkwayHierarchyRejectedCount ?? 0,
        elevatedWalkwayFootprintCount: diagnostics?.elevatedWalkwayFootprintCount ?? 0,`;
  const telemetryWithDirection = `        walkwayHierarchyRejectedCount: diagnostics?.walkwayHierarchyRejectedCount ?? 0,
        wallSelectionVectorAuthority: "decoded-kphx-bgl-heading-terminal-side-v2",
        selectedMaterialReference: groundedMaterialReference,
        sourceDirectionRejectedCount: diagnostics?.sourceDirectionRejectedCount ?? 0,
        minimumRequiredDirectionDot: ${MINIMUM_A1_SOURCE_DIRECTION_DOT},
        selectedSourceDirectionDot: groundedTerminalDirectionDot,
        maximumSourceWallDistanceMeters: ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS},
        elevatedWalkwayFootprintCount: diagnostics?.elevatedWalkwayFootprintCount ?? 0,`;
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${runtimePath}: final A1 grounded telemetry anchor is missing`);
  }
  source = source.replace(telemetryAnchor, telemetryWithDirection);
}

for (const required of [
  marker,
  "-sourceJetwayForwardX",
  "-sourceJetwayForwardZ",
  `forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15`,
  "diagnostics.sourceDirectionRejectedCount",
  `groundedTerminalDirectionDot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT}`,
  `groundedConnection.distance < ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS}`,
  "/BGATE|DGATE|PHX_TERM400/i.test(groundedMaterialReference)",
  'wallSelectionVectorAuthority: "decoded-kphx-bgl-heading-terminal-side-v2"',
  "selectedMaterialReference: groundedMaterialReference",
  `minimumRequiredDirectionDot: ${MINIMUM_A1_SOURCE_DIRECTION_DOT}`,
  "selectedSourceDirectionDot: groundedTerminalDirectionDot",
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: decoded-KPHX A1 terminal-wall selection is missing ${required}`);
  }
}
for (const forbidden of [
  "forcePreferredHemisphere && !/PHX_TERM400/i.test",
  "requiredA1TerminalMaterial",
  "A1 PHX_TERM400 CANDIDATE DUMP",
  "A1 STRUCTURAL CANDIDATE DUMP",
  "a1-final-phx-term400-candidate-dump-v1",
  "a1-final-structural-candidate-dump-v2",
  "if (!(groundedTerminalDirectionDot >= 0.15))",
  "if (!/PHX_TERM400/i.test(groundedMaterialReference))",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: stale PHX-only/target-vector A1 wall behavior survived: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Selected final A1 terminal wall from the decoded KPHX BGL terminal-side heading (dot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT}) across real structural BGATE/DGATE/PHX_TERM400 faces; the visually rejected PHX-only corridor rule and temporary candidate dumps are removed.`);