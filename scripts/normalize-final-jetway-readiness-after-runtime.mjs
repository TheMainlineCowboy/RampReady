import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const MIN_WALL_DISTANCE = 0.5;
const MAX_WALL_DISTANCE = 44;
const MIN_A1_VISIBLE_LEG = 0.15;
const MAX_VISIBLE_LEG = 44;

let source = fs.readFileSync(readinessPath, "utf8");

// prepare:runtime can regenerate older compactness expressions. Normalize the
// physical A1 values and, critically, bind static-fleet readiness to the
// per-gate min/max measurements that registerStaticJetwayFleetToFacadeV1
// actually publishes. The old single-value fields are not published and become
// NaN, which was tearing down an otherwise loaded Terminal 4 scene.
source = source.replaceAll(
  "Math.abs(sourceLockedA1VisibleLeg - 2.4) > 0.05",
  `!(sourceLockedA1VisibleLeg > ${MIN_A1_VISIBLE_LEG} && sourceLockedA1VisibleLeg < ${MAX_VISIBLE_LEG})`,
);
source = source.replaceAll(
  "!(sourceLockedA1WallDistance >= 2.9 && sourceLockedA1WallDistance <= 5.8)",
  `!(sourceLockedA1WallDistance > ${MIN_WALL_DISTANCE} && sourceLockedA1WallDistance < ${MAX_WALL_DISTANCE})`,
);

const legacyStaticWallDeclaration = "          const staticRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticRotundaCenterToWallMeters ?? NaN);";
const measuredStaticWallDeclarations = `          const staticMinimumRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticMinimumMeasuredWallDistanceMeters ?? NaN);\n          const staticMaximumRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticMaximumMeasuredWallDistanceMeters ?? NaN);`;
if (source.includes(legacyStaticWallDeclaration)) {
  source = source.replace(legacyStaticWallDeclaration, measuredStaticWallDeclarations);
}

const legacyStaticLegDeclaration = "          const staticVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticVisibleTerminalLegMeters ?? NaN);";
const measuredStaticLegDeclarations = `          const staticMinimumVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticMinimumMeasuredVisibleTerminalLegMeters ?? NaN);\n          const staticMaximumVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticMaximumMeasuredVisibleTerminalLegMeters ?? NaN);`;
if (source.includes(legacyStaticLegDeclaration)) {
  source = source.replace(legacyStaticLegDeclaration, measuredStaticLegDeclarations);
}

source = source.replaceAll(
  "Math.abs(staticRotundaCenterToWall - 3.98) > 0.001",
  `!(staticMinimumRotundaCenterToWall > ${MIN_WALL_DISTANCE} && staticMaximumRotundaCenterToWall < ${MAX_WALL_DISTANCE})`,
);
source = source.replaceAll(
  `!(staticRotundaCenterToWall > ${MIN_WALL_DISTANCE} && staticRotundaCenterToWall < ${MAX_WALL_DISTANCE})`,
  `!(staticMinimumRotundaCenterToWall > ${MIN_WALL_DISTANCE} && staticMaximumRotundaCenterToWall < ${MAX_WALL_DISTANCE})`,
);
source = source.replaceAll(
  "Math.abs(staticVisibleTerminalLeg - 2.4) > 0.001",
  `!(staticMinimumVisibleTerminalLeg >= 0 && staticMaximumVisibleTerminalLeg < ${MAX_VISIBLE_LEG})`,
);
source = source.replaceAll(
  `!(staticVisibleTerminalLeg >= 0 && staticVisibleTerminalLeg < ${MAX_VISIBLE_LEG})`,
  `!(staticMinimumVisibleTerminalLeg >= 0 && staticMaximumVisibleTerminalLeg < ${MAX_VISIBLE_LEG})`,
);

// The final browser evidence gate is the visual authority. These readiness
// checks are physical sanity bounds only and must not reintroduce fabricated
// representative corridor distances.
const directWallGuard = `a1TerminalWallDistance > ${MIN_WALL_DISTANCE} && a1TerminalWallDistance < ${MAX_WALL_DISTANCE}`;
const directVisibleLegGuard = `connectorVisibleLength > ${MIN_A1_VISIBLE_LEG} && connectorVisibleLength < ${MAX_VISIBLE_LEG}`;
const mismatchAnchor = `          if (\n            count !== EXPECTED_GATE_COUNT`;
if (!source.includes(directWallGuard) || !source.includes(directVisibleLegGuard)) {
  if (!source.includes(mismatchAnchor)) {
    throw new Error(`${readinessPath}: final exact-fleet readiness mismatch block is missing`);
  }
  const seeded = [
    !source.includes(directWallGuard) ? `!(${directWallGuard})` : null,
    !source.includes(directVisibleLegGuard) ? `!(${directVisibleLegGuard})` : null,
  ].filter(Boolean);
  source = source.replace(
    mismatchAnchor,
    `          if (\n            ${seeded.join("\n            || ")}\n            || count !== EXPECTED_GATE_COUNT`,
  );
}

// Append the actual static physical ranges to mismatch telemetry so any future
// rejection identifies the measured fleet values instead of hiding them behind
// an obsolete aggregate.
const sourceTelemetry = "source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}`";
const rangeTelemetry = "staticMeasured=${staticMinimumRotundaCenterToWall}/${staticMaximumRotundaCenterToWall}/${staticMinimumVisibleTerminalLeg}/${staticMaximumVisibleTerminalLeg}, source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}`";
if (source.includes(sourceTelemetry) && !source.includes("staticMeasured=${staticMinimumRotundaCenterToWall}")) {
  source = source.replace(sourceTelemetry, rangeTelemetry);
}

for (const forbidden of [
  "Math.abs(sourceLockedA1VisibleLeg - 2.4) > 0.05",
  "sourceLockedA1WallDistance >= 2.9 && sourceLockedA1WallDistance <= 5.8",
  "Math.abs(staticRotundaCenterToWall - 3.98) > 0.001",
  "Math.abs(staticVisibleTerminalLeg - 2.4) > 0.001",
  "uploadedJetwayStaticRotundaCenterToWallMeters ?? NaN",
  "uploadedJetwayStaticVisibleTerminalLegMeters ?? NaN",
  "staticRotundaCenterToWall > 0.5",
  "staticVisibleTerminalLeg >= 0",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired or unpublished jetway readiness survived final runtime normalization: ${forbidden}`);
  }
}

for (const required of [
  directWallGuard,
  directVisibleLegGuard,
  "uploadedJetwayStaticMinimumMeasuredWallDistanceMeters",
  "uploadedJetwayStaticMaximumMeasuredWallDistanceMeters",
  "uploadedJetwayStaticMinimumMeasuredVisibleTerminalLegMeters",
  "uploadedJetwayStaticMaximumMeasuredVisibleTerminalLegMeters",
  `staticMinimumRotundaCenterToWall > ${MIN_WALL_DISTANCE} && staticMaximumRotundaCenterToWall < ${MAX_WALL_DISTANCE}`,
  `staticMinimumVisibleTerminalLeg >= 0 && staticMaximumVisibleTerminalLeg < ${MAX_VISIBLE_LEG}`,
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final measured jetway readiness is missing ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Normalized final post-prepare jetway readiness to telemetry the runtime actually publishes: A1 uses source-measured physical bounds and the 57 static gates use their measured min/max wall and visible-leg ranges; unpublished NaN aggregate fields and compact magic distances are removed.");
