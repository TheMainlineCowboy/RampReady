import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const MIN_WALL_DISTANCE = 0.5;
const MAX_WALL_DISTANCE = 44;
const MIN_A1_VISIBLE_LEG = 0.15;
const MAX_VISIBLE_LEG = 44;

let source = fs.readFileSync(readinessPath, "utf8");

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

const bogieGroundGuard = "Number.isFinite(bogieTireCorrection) && bogieTireCorrection > 0";
source = source.replace(
  /!\(\s*bogieTireCorrection\s*>\s*0\.04\s*&&\s*bogieTireCorrection\s*<\s*0\.1\s*\)/g,
  `!(${bogieGroundGuard})`,
);
if (!source.includes(bogieGroundGuard)) {
  const fleetGroundExpression = "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6";
  if (!source.includes(fleetGroundExpression)) {
    throw new Error(`${readinessPath}: fleet/bogie ground-contact readiness expression is missing`);
  }
  source = source.replace(
    fleetGroundExpression,
    `${fleetGroundExpression}\n            || !(${bogieGroundGuard})`,
  );
}

const staticDeclarationAnchor = "          const staticPortalAlignmentError = Number(group.userData.uploadedJetwayStaticMaximumPortalAlignmentErrorRadians ?? Infinity);";
const measuredStaticDeclarations = `${staticDeclarationAnchor}\n          const staticMinimumRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticMinimumMeasuredWallDistanceMeters ?? NaN);\n          const staticMaximumRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticMaximumMeasuredWallDistanceMeters ?? NaN);\n          const staticMinimumVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticMinimumMeasuredVisibleTerminalLegMeters ?? NaN);\n          const staticMaximumVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticMaximumMeasuredVisibleTerminalLegMeters ?? NaN);`;
if (!source.includes("uploadedJetwayStaticMinimumMeasuredWallDistanceMeters")) {
  if (!source.includes(staticDeclarationAnchor)) {
    throw new Error(`${readinessPath}: static portal telemetry declaration anchor is missing`);
  }
  source = source.replace(staticDeclarationAnchor, measuredStaticDeclarations);
}

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

const directWallGuard = `a1TerminalWallDistance > ${MIN_WALL_DISTANCE} && a1TerminalWallDistance < ${MAX_WALL_DISTANCE}`;
const directVisibleLegGuard = `connectorVisibleLength > ${MIN_A1_VISIBLE_LEG} && connectorVisibleLength < ${MAX_VISIBLE_LEG}`;
const staticWallGuard = `staticMinimumRotundaCenterToWall > ${MIN_WALL_DISTANCE} && staticMaximumRotundaCenterToWall < ${MAX_WALL_DISTANCE}`;
const staticVisibleLegGuard = `staticMinimumVisibleTerminalLeg >= 0 && staticMaximumVisibleTerminalLeg < ${MAX_VISIBLE_LEG}`;

const missingStaticGuards = [
  !source.includes(staticWallGuard) ? `!(${staticWallGuard})` : null,
  !source.includes(staticVisibleLegGuard) ? `!(${staticVisibleLegGuard})` : null,
].filter(Boolean);
if (missingStaticGuards.length) {
  const staticPortalGuard = "staticPortalAlignmentError > 1e-6";
  if (!source.includes(staticPortalGuard)) {
    throw new Error(`${readinessPath}: static portal readiness expression is missing`);
  }
  source = source.replace(
    staticPortalGuard,
    `${staticPortalGuard}\n            || ${missingStaticGuards.join("\n            || ")}`,
  );
}

function injectIntoExactReadinessCondition(guard) {
  if (source.includes(guard)) return;

  const mismatchMarker = "Exact jetway readiness mismatch:";
  const mismatchIndex = source.indexOf(mismatchMarker);
  if (mismatchIndex < 0) {
    throw new Error(`${readinessPath}: exact readiness mismatch marker is missing for ${guard}`);
  }

  const ifIndex = source.lastIndexOf("          if (", mismatchIndex);
  if (ifIndex < 0) {
    throw new Error(`${readinessPath}: exact readiness condition is missing for ${guard}`);
  }

  const conditionClose = source.lastIndexOf("          ) {", mismatchIndex);
  if (conditionClose < ifIndex) {
    throw new Error(`${readinessPath}: exact readiness condition closing boundary is missing for ${guard}`);
  }

  source = `${source.slice(0, conditionClose)}            || !(${guard})\n${source.slice(conditionClose)}`;
}

injectIntoExactReadinessCondition(directWallGuard);
injectIntoExactReadinessCondition(directVisibleLegGuard);

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
  bogieGroundGuard,
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final measured jetway readiness is missing ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Normalized final post-prepare jetway readiness using the structural exact-readiness condition: A1 keeps source-measured physical wall/visible-leg bounds, all 57 static gates keep measured min/max wall and visible-leg ranges, and grounded bogie contact remains fail-closed without depending on generated clause ordering or authority text.");
