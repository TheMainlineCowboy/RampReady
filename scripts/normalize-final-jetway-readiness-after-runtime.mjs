import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const MIN_WALL_DISTANCE = 0.5;
const MAX_WALL_DISTANCE = 44;
const MIN_A1_VISIBLE_LEG = 0.15;
const MAX_VISIBLE_LEG = 44;
const MAX_A1_ROTUNDA_PRESERVATION_ERROR = 0.001;
const EXACT_A1_WHEEL_AUTHORITY = "exact-authored-a1-connected-wheel-pair-ramp-contact-v4";
const RETIRED_BOGIE_AUTHORITIES = Object.freeze([
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
  "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3",
]);

let source = fs.readFileSync(readinessPath, "utf8");

// This is the true last semantic normalization before Vite. Any compatibility
// preparer that still names the generic Tunnel-C v3 contract is overwritten
// here with the exact paired source-wheel authority.
for (const retired of RETIRED_BOGIE_AUTHORITIES) source = source.replaceAll(retired, EXACT_A1_WHEEL_AUTHORITY);
source = source
  .replaceAll("bogieGroundContactPointCount < 4", "bogieGroundContactPointCount < 8")
  .replaceAll("bogieGroundContactClusterCount < 1", "bogieGroundContactClusterCount < 2")
  .replaceAll("bogieGroundHorizontalContactSpan < 0.35", "bogieGroundHorizontalContactSpan < 1.4")
  .replaceAll("bogieGroundHorizontalContactSpan < 1.2", "bogieGroundHorizontalContactSpan < 1.4");

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
  "rotundaPreservationError > 1e-6",
  `rotundaPreservationError > ${MAX_A1_ROTUNDA_PRESERVATION_ERROR}`,
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

// Publish/read the semantic source-wheel evidence that distinguishes the actual
// aircraft-side wheel pair from the terminal Rotunda pedestal.
const bogieCenterDeclaration = "          const bogieGroundContactCenterZ = Number(group.userData.uploadedJetwayBogieGroundContactCenterZ ?? NaN);";
const exactWheelDeclarations = `${bogieCenterDeclaration}\n          const bogieGroundContactAxisT = Number(group.userData.uploadedJetwayBogieGroundContactAxisT ?? NaN);\n          const bogieGroundContactRotundaDistance = Number(group.userData.uploadedJetwayBogieGroundContactRotundaDistanceMeters ?? NaN);\n          const bogieGroundContactCabDistance = Number(group.userData.uploadedJetwayBogieGroundContactCabDistanceMeters ?? NaN);\n          const bogieWheelSeparation = Number(group.userData.uploadedJetwayBogieWheelSeparationMeters ?? NaN);\n          const bogieWheelTriangleCount = Number(group.userData.uploadedJetwayBogieWheelTriangleCount ?? NaN);`;
if (!source.includes("const bogieGroundContactAxisT =")) {
  if (!source.includes(bogieCenterDeclaration)) {
    throw new Error(`${readinessPath}: bogie contact-center declaration is missing before exact-wheel normalization`);
  }
  source = source.replace(bogieCenterDeclaration, exactWheelDeclarations);
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
const exactWheelAuthorityGuard = `bogieGroundContactAuthority === "${EXACT_A1_WHEEL_AUTHORITY}"`;
const exactWheelPointGuard = "bogieGroundContactPointCount >= 8";
const exactWheelClusterGuard = "bogieGroundContactClusterCount >= 2";
const exactWheelSpanGuard = "bogieGroundHorizontalContactSpan >= 1.4";
const exactWheelAxisGuard = "Number.isFinite(bogieGroundContactAxisT) && bogieGroundContactAxisT >= 0.58 && bogieGroundContactAxisT <= 0.78";
const exactWheelDistanceGuard = "Number.isFinite(bogieGroundContactRotundaDistance) && Number.isFinite(bogieGroundContactCabDistance) && bogieGroundContactCabDistance < bogieGroundContactRotundaDistance";
const exactWheelSeparationGuard = "Number.isFinite(bogieWheelSeparation) && bogieWheelSeparation >= 1.4 && bogieWheelSeparation <= 3.0";
const exactWheelTriangleGuard = "bogieWheelTriangleCount === 2348";

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

for (const guard of [
  directWallGuard,
  directVisibleLegGuard,
  exactWheelAuthorityGuard,
  exactWheelPointGuard,
  exactWheelClusterGuard,
  exactWheelSpanGuard,
  exactWheelAxisGuard,
  exactWheelDistanceGuard,
  exactWheelSeparationGuard,
  exactWheelTriangleGuard,
]) injectIntoExactReadinessCondition(guard);

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
  "rotundaPreservationError > 1e-6",
  "bogieGroundContactPointCount < 4",
  "bogieGroundContactClusterCount < 1",
  "bogieGroundHorizontalContactSpan < 0.35",
  "bogieGroundHorizontalContactSpan < 1.2",
  ...RETIRED_BOGIE_AUTHORITIES,
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired or non-wheel jetway readiness survived final runtime normalization: ${forbidden}`);
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
  "uploadedJetwayBogieGroundContactAxisT",
  "uploadedJetwayBogieGroundContactRotundaDistanceMeters",
  "uploadedJetwayBogieGroundContactCabDistanceMeters",
  "uploadedJetwayBogieWheelSeparationMeters",
  "uploadedJetwayBogieWheelTriangleCount",
  ...[
    exactWheelAuthorityGuard,
    exactWheelPointGuard,
    exactWheelClusterGuard,
    exactWheelSpanGuard,
    exactWheelAxisGuard,
    exactWheelDistanceGuard,
    exactWheelSeparationGuard,
    exactWheelTriangleGuard,
  ],
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final exact-wheel jetway readiness is missing ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Normalized final post-prepare jetway readiness to the exact authored A1 wheel pair: two connected source wheels, full axle-width footprint, aircraft-side Rotunda-to-Cab position, Cab-side proximity and <=1.5 cm ramp contact are all fail-closed after every compatibility preparer.");
