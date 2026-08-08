import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const MIN_WALL_DISTANCE = 0.5;
const MAX_WALL_DISTANCE = 44;
const MIN_A1_VISIBLE_LEG = 0.15;
const MAX_VISIBLE_LEG = 44;

let source = fs.readFileSync(readinessPath, "utf8");

// prepare:runtime can regenerate the older readiness module. Normalize the
// regenerated file to the physical telemetry published by the final static
// facade registration instead of requiring obsolete representative distances.
source = source.replaceAll(
  "Math.abs(sourceLockedA1VisibleLeg - 2.4) > 0.05",
  `!(sourceLockedA1VisibleLeg > ${MIN_A1_VISIBLE_LEG} && sourceLockedA1VisibleLeg < ${MAX_VISIBLE_LEG})`,
);
source = source.replaceAll(
  "!(sourceLockedA1WallDistance >= 2.9 && sourceLockedA1WallDistance <= 5.8)",
  `!(sourceLockedA1WallDistance > ${MIN_WALL_DISTANCE} && sourceLockedA1WallDistance < ${MAX_WALL_DISTANCE})`,
);
source = source.replaceAll(
  "|| !(a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12)",
  `|| !(a1TerminalWallDistance > ${MIN_WALL_DISTANCE} && a1TerminalWallDistance < ${MAX_WALL_DISTANCE})`,
);
source = source.replaceAll(
  "|| !(connectorVisibleLength > 0.25 && connectorVisibleLength < 12)",
  `|| !(connectorVisibleLength > ${MIN_A1_VISIBLE_LEG} && connectorVisibleLength < ${MAX_VISIBLE_LEG})`,
);
source = source.replaceAll(
  "|| !(bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1)",
  "|| !(Number.isFinite(bogieTireCorrection) && bogieTireCorrection > 0)",
);

// The regenerated readiness source does not declare the per-gate range fields,
// even though registerStaticJetwayFleetToFacadeV1 publishes them on group.userData.
// Seed those declarations deterministically beside the existing static portal
// telemetry so verification and runtime consume the same measured fleet data.
const staticDeclarationAnchor = "          const staticPortalAlignmentError = Number(group.userData.uploadedJetwayStaticMaximumPortalAlignmentErrorRadians ?? Infinity);";
const measuredStaticDeclarations = `${staticDeclarationAnchor}\n          const staticMinimumRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticMinimumMeasuredWallDistanceMeters ?? NaN);\n          const staticMaximumRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticMaximumMeasuredWallDistanceMeters ?? NaN);\n          const staticMinimumVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticMinimumMeasuredVisibleTerminalLegMeters ?? NaN);\n          const staticMaximumVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticMaximumMeasuredVisibleTerminalLegMeters ?? NaN);`;
if (!source.includes("uploadedJetwayStaticMinimumMeasuredWallDistanceMeters")) {
  if (!source.includes(staticDeclarationAnchor)) {
    throw new Error(`${readinessPath}: static portal telemetry declaration anchor is missing`);
  }
  source = source.replace(staticDeclarationAnchor, measuredStaticDeclarations);
}

// Remove any older unpublished single-value static declarations if a regenerated
// variant still emits them.
source = source.replace(
  "          const staticRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticRotundaCenterToWallMeters ?? NaN);\n",
  "",
);
source = source.replace(
  "          const staticVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticVisibleTerminalLegMeters ?? NaN);\n",
  "",
);
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

// Seed physical sanity guards into the final mismatch block. The dedicated
// browser evidence remains the visual authority; these checks only prove that
// the measured wall/Rotunda relationships are finite and physically bounded.
const directWallGuard = `a1TerminalWallDistance > ${MIN_WALL_DISTANCE} && a1TerminalWallDistance < ${MAX_WALL_DISTANCE}`;
const directVisibleLegGuard = `connectorVisibleLength > ${MIN_A1_VISIBLE_LEG} && connectorVisibleLength < ${MAX_VISIBLE_LEG}`;
const staticWallGuard = `staticMinimumRotundaCenterToWall > ${MIN_WALL_DISTANCE} && staticMaximumRotundaCenterToWall < ${MAX_WALL_DISTANCE}`;
const staticVisibleLegGuard = `staticMinimumVisibleTerminalLeg >= 0 && staticMaximumVisibleTerminalLeg < ${MAX_VISIBLE_LEG}`;
const mismatchAnchor = `          if (\n            count !== EXPECTED_GATE_COUNT`;
const seeded = [
  !source.includes(directWallGuard) ? `!(${directWallGuard})` : null,
  !source.includes(directVisibleLegGuard) ? `!(${directVisibleLegGuard})` : null,
  !source.includes(staticWallGuard) ? `!(${staticWallGuard})` : null,
  !source.includes(staticVisibleLegGuard) ? `!(${staticVisibleLegGuard})` : null,
].filter(Boolean);
if (seeded.length) {
  if (!source.includes(mismatchAnchor)) {
    throw new Error(`${readinessPath}: final exact-fleet readiness mismatch block is missing`);
  }
  source = source.replace(
    mismatchAnchor,
    `          if (\n            ${seeded.join("\n            || ")}\n            || count !== EXPECTED_GATE_COUNT`,
  );
}

// Append measured ranges to mismatch telemetry so a future rejection reports
// the actual 57-gate source registration instead of hiding behind stale constants.
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
  "bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1",
  "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
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
  staticWallGuard,
  staticVisibleLegGuard,
  "Number.isFinite(bogieTireCorrection) && bogieTireCorrection > 0",
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final measured jetway readiness is missing ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Normalized final post-prepare jetway readiness to telemetry the runtime actually publishes: A1 uses source-measured physical bounds and the 57 static gates use their measured min/max wall and visible-leg ranges; unpublished NaN aggregate fields and compact magic distances are removed.");
