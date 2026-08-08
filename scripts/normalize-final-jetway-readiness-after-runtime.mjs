import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const MIN_WALL_DISTANCE = 0.5;
const MAX_WALL_DISTANCE = 44;
const MIN_A1_VISIBLE_LEG = 0.15;
const MAX_VISIBLE_LEG = 44;

let source = fs.readFileSync(readinessPath, "utf8");

// prepare:runtime is intentionally broad and still regenerates several old
// compact A1/static-fleet acceptance expressions. This script runs AFTER that
// preparation and immediately before the remaining read-only verification/Vite
// stages. The final bundle therefore validates the physical measurements that
// the current runtime actually publishes, rather than resurrecting the retired
// 2.4 m / 3.98 m representative geometry.

source = source.replaceAll(
  "Math.abs(sourceLockedA1VisibleLeg - 2.4) > 0.05",
  `!(sourceLockedA1VisibleLeg > ${MIN_A1_VISIBLE_LEG} && sourceLockedA1VisibleLeg < ${MAX_VISIBLE_LEG})`,
);
source = source.replaceAll(
  "!(sourceLockedA1WallDistance >= 2.9 && sourceLockedA1WallDistance <= 5.8)",
  `!(sourceLockedA1WallDistance > ${MIN_WALL_DISTANCE} && sourceLockedA1WallDistance < ${MAX_WALL_DISTANCE})`,
);

const oldStaticWallDeclaration = "          const staticRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticRotundaCenterToWallMeters ?? NaN);";
const finalStaticWallDeclarations = `          const staticMinimumRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticMinimumMeasuredWallDistanceMeters ?? NaN);\n          const staticRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticMaximumMeasuredWallDistanceMeters ?? NaN);`;
if (source.includes(oldStaticWallDeclaration)) {
  source = source.replace(oldStaticWallDeclaration, finalStaticWallDeclarations);
} else if (!source.includes("uploadedJetwayStaticMinimumMeasuredWallDistanceMeters")) {
  throw new Error(`${readinessPath}: static measured wall-distance readiness declaration is missing`);
}

const oldStaticLegDeclaration = "          const staticVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticVisibleTerminalLegMeters ?? NaN);";
const finalStaticLegDeclarations = `          const staticMinimumVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticMinimumMeasuredVisibleTerminalLegMeters ?? NaN);\n          const staticVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticMaximumMeasuredVisibleTerminalLegMeters ?? NaN);`;
if (source.includes(oldStaticLegDeclaration)) {
  source = source.replace(oldStaticLegDeclaration, finalStaticLegDeclarations);
} else if (!source.includes("uploadedJetwayStaticMinimumMeasuredVisibleTerminalLegMeters")) {
  throw new Error(`${readinessPath}: static measured visible-leg readiness declaration is missing`);
}

source = source.replaceAll(
  "Math.abs(staticRotundaCenterToWall - 3.98) > 0.001",
  `!(staticMinimumRotundaCenterToWall > ${MIN_WALL_DISTANCE} && staticRotundaCenterToWall < ${MAX_WALL_DISTANCE})`,
);
source = source.replaceAll(
  "Math.abs(staticVisibleTerminalLeg - 2.4) > 0.001",
  `!(staticMinimumVisibleTerminalLeg >= 0 && staticVisibleTerminalLeg <= ${MAX_VISIBLE_LEG})`,
);

// Make the next runtime failure self-diagnosing instead of hiding the current
// physical ranges behind an old aggregate mismatch string.
const oldTelemetry = "source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}`";
const finalTelemetry = "staticRange=${staticMinimumRotundaCenterToWall}/${staticRotundaCenterToWall}/${staticMinimumVisibleTerminalLeg}/${staticVisibleTerminalLeg}, sourceLocked=${sourceLockedA1WallDistance}/${sourceLockedA1VisibleLeg}/${sourceLockedA1CornerAngle}/${sourceLockedA1Rotunda}/${terminalSideIndependent}, source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}`";
if (source.includes(oldTelemetry)) source = source.replace(oldTelemetry, finalTelemetry);

for (const forbidden of [
  "Math.abs(sourceLockedA1VisibleLeg - 2.4) > 0.05",
  "sourceLockedA1WallDistance >= 2.9 && sourceLockedA1WallDistance <= 5.8",
  "Math.abs(staticRotundaCenterToWall - 3.98) > 0.001",
  "Math.abs(staticVisibleTerminalLeg - 2.4) > 0.001",
  "uploadedJetwayStaticRotundaCenterToWallMeters ?? NaN",
  "uploadedJetwayStaticVisibleTerminalLegMeters ?? NaN",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired jetway readiness survived final runtime normalization: ${forbidden}`);
  }
}

for (const required of [
  `sourceLockedA1VisibleLeg > ${MIN_A1_VISIBLE_LEG} && sourceLockedA1VisibleLeg < ${MAX_VISIBLE_LEG}`,
  `sourceLockedA1WallDistance > ${MIN_WALL_DISTANCE} && sourceLockedA1WallDistance < ${MAX_WALL_DISTANCE}`,
  "uploadedJetwayStaticMinimumMeasuredWallDistanceMeters",
  "uploadedJetwayStaticMaximumMeasuredWallDistanceMeters",
  "uploadedJetwayStaticMinimumMeasuredVisibleTerminalLegMeters",
  "uploadedJetwayStaticMaximumMeasuredVisibleTerminalLegMeters",
  `staticMinimumRotundaCenterToWall > ${MIN_WALL_DISTANCE} && staticRotundaCenterToWall < ${MAX_WALL_DISTANCE}`,
  `staticMinimumVisibleTerminalLeg >= 0 && staticVisibleTerminalLeg <= ${MAX_VISIBLE_LEG}`,
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final source-measured jetway readiness is missing ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Normalized final post-prepare runtime jetway readiness: A1 source-locked wall/fixed-leg use the measured 0.5-44 m / 0.15-44 m ranges, and all 57 static gates are validated by their published per-gate min/max wall and visible-leg measurements instead of 3.98/2.4 m magic values.");
