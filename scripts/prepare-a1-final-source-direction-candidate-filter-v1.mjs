import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-decoded-kphx-terminal-wall-direction-v4";
const fullHeightMarker = "a1-decoded-kphx-full-height-terminal-building-wall-v31";
const MINIMUM_A1_SOURCE_DIRECTION_DOT = 0.90;
const MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 34;
const MAXIMUM_FULL_HEIGHT_PLANE_DELTA_METERS = 0.50;
let source = fs.readFileSync(runtimePath, "utf8");

// Browser evidence proved the PHX_TERM400-only rule selected the elevated
// corridor plane. The structural candidate inventory then exposed the DGATE5
// main-building facade. Selection and acceptance now use only the decoded KPHX
// BGL terminal-side heading; no CRJ target vector is allowed to own the wall.
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

  const oldDirectionMeasurement = `      const groundedTerminalDirectionDot = groundedConnection.towardX * -ux
        + groundedConnection.towardZ * -uz;`;
  const sourceDirectionMeasurement = `      const groundedTerminalDirectionDot = groundedConnection.towardX * -sourceJetwayForwardX
        + groundedConnection.towardZ * -sourceJetwayForwardZ;`;
  if (!source.includes(oldDirectionMeasurement)) {
    throw new Error(`${runtimePath}: A1 grounded direction measurement is missing`);
  }
  source = source.replace(oldDirectionMeasurement, sourceDirectionMeasurement);

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
        wallSelectionVectorAuthority: "decoded-kphx-bgl-heading-terminal-side-v4",
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
  source = source.replace("sourceDistanceRangeMeters: [3.4, 28]", `sourceDistanceRangeMeters: [3.4, ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS}]`);
}

// The v30 preparer is invoked more than once during the production chain. Its
// old non-idempotent replacement could inject the same nearest-point cosine
// validator twice. Worse, after the grounded A1 override both "upper" and
// "lower" searches no longer represented two physical heights. Remove every
// generated legacy copy and replace it with one direct vertical-facade test:
// the decoded-heading ramp hit and a decoded-heading Rotunda-height hit must lie
// on the same dominant facade plane. Nearest points may slide along a large
// triangulated wall; the wall-plane coordinate itself may not.
const legacyFullHeightBlockPattern = /    if \(jetway\.g === "A1"\) \{\n      if \(!terminalConnection\) \{\n        throw new Error\("A1 could not find the real Terminal 4 building facade"\);\n      \}\n      const upperDirection = new THREE\.Vector3\([\s\S]*?      terminalConnection\.sameDirectionCosine = sameDirectionCosine;\n    \}\n/g;
const legacyFullHeightBlocks = source.match(legacyFullHeightBlockPattern) || [];
if (legacyFullHeightBlocks.length < 1) {
  throw new Error(`${runtimePath}: generated legacy A1 full-height validator is missing`);
}
source = source.replace(legacyFullHeightBlockPattern, "");

const fullHeightAnchor = `    // static-bgl-heading-terminal-search-v2-non-a1-resolved`;
const robustFullHeightBlock = `    // ${fullHeightMarker}
    if (jetway.g === "A1") {
      if (!terminalConnection) {
        throw new Error("A1 decoded-heading ramp-level terminal wall is missing before full-height validation");
      }
      const fullHeightUpperConnection = findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        -sourceJetwayForwardX,
        -sourceJetwayForwardZ,
        rotundaY,
        true,
      );
      if (!fullHeightUpperConnection) {
        throw new Error("A1 decoded-heading terminal facade has no structural Rotunda-height continuation");
      }
      if (fullHeightUpperConnection.underElevatedWalkway !== false
        || fullHeightUpperConnection.elevatedWalkwayClearanceVerified !== true
        || fullHeightUpperConnection.sourceHierarchyWalkwayExcluded !== true) {
        throw new Error(\`A1 Rotunda-height terminal facade did not prove T4_WALK exclusion: \${JSON.stringify(fullHeightUpperConnection)}\`);
      }
      const fullHeightUpperSourceDot = fullHeightUpperConnection.towardX * -sourceJetwayForwardX
        + fullHeightUpperConnection.towardZ * -sourceJetwayForwardZ;
      if (!(fullHeightUpperSourceDot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT})) {
        throw new Error(\`A1 Rotunda-height facade is not aligned to decoded KPHX heading: dot=\${fullHeightUpperSourceDot}\`);
      }
      if (!(Number.isFinite(fullHeightUpperConnection.pointY)
        && fullHeightUpperConnection.pointY > 2.2)) {
        throw new Error(\`A1 Rotunda-height facade hit is not above the ramp-level wall sample: y=\${fullHeightUpperConnection.pointY}\`);
      }
      const fullHeightDominantPlaneAxis = Math.abs(terminalConnection.towardX) >= Math.abs(terminalConnection.towardZ)
        ? "x"
        : "z";
      const rampFacadePlaneCoordinate = fullHeightDominantPlaneAxis === "x"
        ? Number(terminalConnection.pointX)
        : Number(terminalConnection.pointZ);
      const upperFacadePlaneCoordinate = fullHeightDominantPlaneAxis === "x"
        ? Number(fullHeightUpperConnection.pointX)
        : Number(fullHeightUpperConnection.pointZ);
      const fullHeightFacadePlaneDeltaMeters = Math.abs(upperFacadePlaneCoordinate - rampFacadePlaneCoordinate);
      if (!(Number.isFinite(fullHeightFacadePlaneDeltaMeters)
        && fullHeightFacadePlaneDeltaMeters <= ${MAXIMUM_FULL_HEIGHT_PLANE_DELTA_METERS})) {
        throw new Error(\`A1 ramp and Rotunda-height hits are not on one terminal facade plane: axis=\${fullHeightDominantPlaneAxis} delta=\${fullHeightFacadePlaneDeltaMeters}; ramp=\${JSON.stringify(terminalConnection)}; upper=\${JSON.stringify(fullHeightUpperConnection)}\`);
      }
      terminalConnection.authority = "${fullHeightMarker}";
      terminalConnection.fullHeightFacadePlaneAxis = fullHeightDominantPlaneAxis;
      terminalConnection.fullHeightFacadePlaneDeltaMeters = fullHeightFacadePlaneDeltaMeters;
      terminalConnection.fullHeightUpperDistanceMeters = fullHeightUpperConnection.distance;
      terminalConnection.fullHeightUpperSourceDirectionDot = fullHeightUpperSourceDot;
      terminalConnection.fullHeightUpperPointY = fullHeightUpperConnection.pointY;
      terminalConnection.legacyFullHeightValidatorCopiesRemoved = ${legacyFullHeightBlocks.length};
    }
`;
if (!source.includes(fullHeightAnchor)) {
  throw new Error(`${runtimePath}: A1 full-height validator insertion anchor is missing`);
}
source = source.replace(fullHeightAnchor, robustFullHeightBlock + fullHeightAnchor);

for (const required of [
  marker,
  fullHeightMarker,
  "-sourceJetwayForwardX",
  "-sourceJetwayForwardZ",
  `groundedConnection.towardX * -sourceJetwayForwardX`,
  `groundedConnection.towardZ * -sourceJetwayForwardZ`,
  `forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15`,
  "diagnostics.sourceDirectionRejectedCount",
  `groundedTerminalDirectionDot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT}`,
  `groundedConnection.distance < ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS}`,
  "/BGATE|DGATE|PHX_TERM400/i.test(groundedMaterialReference)",
  'wallSelectionVectorAuthority: "decoded-kphx-bgl-heading-terminal-side-v4"',
  "fullHeightUpperConnection",
  "fullHeightDominantPlaneAxis",
  "fullHeightFacadePlaneDeltaMeters",
  `fullHeightFacadePlaneDeltaMeters <= ${MAXIMUM_FULL_HEIGHT_PLANE_DELTA_METERS}`,
  "legacyFullHeightValidatorCopiesRemoved",
  "selectedMaterialReference: groundedMaterialReference",
  `minimumRequiredDirectionDot: ${MINIMUM_A1_SOURCE_DIRECTION_DOT}`,
  "selectedSourceDirectionDot: groundedTerminalDirectionDot",
  `sourceDistanceRangeMeters: [3.4, ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS}]`,
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: decoded-KPHX A1 terminal-wall authority is missing ${required}`);
  }
}
for (const forbidden of [
  "groundedConnection.towardX * -ux",
  "groundedConnection.towardZ * -uz",
  "forcePreferredHemisphere && !/PHX_TERM400/i.test",
  "requiredA1TerminalMaterial",
  "A1 PHX_TERM400 CANDIDATE DUMP",
  "A1 STRUCTURAL CANDIDATE DUMP",
  "a1-final-phx-term400-candidate-dump-v1",
  "a1-final-structural-candidate-dump-v2",
  "if (!(groundedTerminalDirectionDot >= 0.15))",
  "if (!/PHX_TERM400/i.test(groundedMaterialReference))",
  "sourceDistanceRangeMeters: [3.4, 28]",
  "A1 attachment is not a full-height terminal-building wall",
  "sameDirectionCosine < 0.995",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: stale PHX-only/target-vector/legacy full-height A1 behavior survived: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Selected and accepted A1 terminal wall from decoded KPHX heading (dot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT}), removed ${legacyFullHeightBlocks.length} duplicate legacy nearest-point validator block(s), and required ramp/Rotunda-height hits to share one facade plane within ${MAXIMUM_FULL_HEIGHT_PLANE_DELTA_METERS} m.`);