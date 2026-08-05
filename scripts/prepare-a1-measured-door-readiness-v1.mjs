import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const controllerPath = "src/environment/uploadedAirportJetwayModelSpaceControllerV7.js";
let source = fs.readFileSync(readinessPath, "utf8");
let controllerSource = fs.readFileSync(controllerPath, "utf8");

const MINIMUM_AUTHORED_EXTENSION_METERS = 0.25;
const MAXIMUM_AUTHORED_EXTENSION_METERS = 7;
const MAXIMUM_REACH_ERROR_METERS = 0.05;
const authority = "authored-positive-extension-with-measured-crj-door-reach-v4";
const controllerAuthority = "persistent-whole-assembly-orientation-through-retraction-v1";

const staleCondition = "|| !(a1AttachedExtension > 3 && a1AttachedExtension < 7)";
const intermediateCondition = `|| !(a1AttachedExtension > 0.25 && a1AttachedExtension < 7)
            || Math.abs(sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance) > 0.05`;
const broadCondition = `|| !Number.isFinite(a1AttachedExtension)
            || a1AttachedExtension < -14.5
            || a1AttachedExtension > 8.75
            || Math.abs(sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance) > 0.05`;
const correctedCondition = `|| !(a1AttachedExtension > ${MINIMUM_AUTHORED_EXTENSION_METERS} && a1AttachedExtension < ${MAXIMUM_AUTHORED_EXTENSION_METERS})
            || Math.abs(sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance) > ${MAXIMUM_REACH_ERROR_METERS}`;

if (source.includes(broadCondition)) {
  source = source.replace(broadCondition, correctedCondition);
} else if (source.includes(intermediateCondition)) {
  source = source.replace(intermediateCondition, correctedCondition);
} else if (source.includes(staleCondition)) {
  source = source.replace(staleCondition, correctedCondition);
} else if (!source.includes(correctedCondition)) {
  throw new Error(`${readinessPath}: A1 measured-extension readiness guard is missing`);
}

if (!source.includes("MEASURED_DOOR_READINESS_AUTHORITY")) {
  const constantAnchor = 'const PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1";';
  if (!source.includes(constantAnchor)) {
    throw new Error(`${readinessPath}: readiness constant anchor is missing`);
  }
  source = source.replace(
    constantAnchor,
    `${constantAnchor}\nconst MEASURED_DOOR_READINESS_AUTHORITY = "${authority}";`,
  );
} else {
  source = source.replace(
    /const MEASURED_DOOR_READINESS_AUTHORITY = "[^"]+";/,
    `const MEASURED_DOOR_READINESS_AUTHORITY = "${authority}";`,
  );
}

if (!source.includes("uploadedJetwayA1MeasuredDoorReadinessAuthority")) {
  const evidenceAnchor = "          group.userData.uploadedJetwayA1SourceGeometryReplaced = false;";
  if (!source.includes(evidenceAnchor)) {
    throw new Error(`${readinessPath}: readiness evidence anchor is missing`);
  }
  source = source.replace(
    evidenceAnchor,
    `${evidenceAnchor}\n          group.userData.uploadedJetwayA1MeasuredDoorReadinessAuthority = MEASURED_DOOR_READINESS_AUTHORITY;\n          group.userData.uploadedJetwayA1MinimumAuthoredExtensionMeters = ${MINIMUM_AUTHORED_EXTENSION_METERS};\n          group.userData.uploadedJetwayA1MaximumAuthoredExtensionMeters = ${MAXIMUM_AUTHORED_EXTENSION_METERS};\n          group.userData.uploadedJetwayA1MaximumMeasuredReachErrorMeters = ${MAXIMUM_REACH_ERROR_METERS};`,
  );
} else {
  source = source
    .replace(
      /uploadedJetwayA1MinimumAuthoredExtensionMeters = -?\d+(?:\.\d+)?;/,
      `uploadedJetwayA1MinimumAuthoredExtensionMeters = ${MINIMUM_AUTHORED_EXTENSION_METERS};`,
    )
    .replace(
      /uploadedJetwayA1MaximumAuthoredExtensionMeters = -?\d+(?:\.\d+)?;/,
      `uploadedJetwayA1MaximumAuthoredExtensionMeters = ${MAXIMUM_AUTHORED_EXTENSION_METERS};`,
    );
  if (!source.includes("uploadedJetwayA1MaximumMeasuredReachErrorMeters")) {
    const maximumAnchor = `          group.userData.uploadedJetwayA1MaximumAuthoredExtensionMeters = ${MAXIMUM_AUTHORED_EXTENSION_METERS};`;
    if (!source.includes(maximumAnchor)) {
      throw new Error(`${readinessPath}: maximum extension evidence anchor is missing`);
    }
    source = source.replace(
      maximumAnchor,
      `${maximumAnchor}\n          group.userData.uploadedJetwayA1MaximumMeasuredReachErrorMeters = ${MAXIMUM_REACH_ERROR_METERS};`,
    );
  }
}

// The model-space controller captured the gate yaw before the installation
// correction and restored that stale yaw on every deployment update. Preserve
// the whole A1 parent correction so the Rotunda remains terminal-side through
// attached, retracting and parked states. No authored child node is rotated.
const staleControllerYaw = "    anchor.rotation.y = base.yaw;";
const persistentControllerYaw = `    const wholeAssemblyOrientationCorrectionRadians = Number(
      anchor.userData.wholeAssemblyOrientationCorrectionRadians || 0,
    );
    anchor.rotation.y = base.yaw + wholeAssemblyOrientationCorrectionRadians;
    anchor.userData.wholeAssemblyOrientationControllerAuthority = "${controllerAuthority}";`;
if (controllerSource.includes(staleControllerYaw)) {
  controllerSource = controllerSource.replace(staleControllerYaw, persistentControllerYaw);
} else if (!controllerSource.includes(persistentControllerYaw)) {
  throw new Error(`${controllerPath}: A1 controller yaw reset anchor is missing`);
}

for (const token of [
  correctedCondition,
  `MEASURED_DOOR_READINESS_AUTHORITY = "${authority}"`,
  "uploadedJetwayA1MeasuredDoorReadinessAuthority",
  `uploadedJetwayA1MinimumAuthoredExtensionMeters = ${MINIMUM_AUTHORED_EXTENSION_METERS}`,
  `uploadedJetwayA1MaximumAuthoredExtensionMeters = ${MAXIMUM_AUTHORED_EXTENSION_METERS}`,
  `uploadedJetwayA1MaximumMeasuredReachErrorMeters = ${MAXIMUM_REACH_ERROR_METERS}`,
  "sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance",
]) {
  if (!source.includes(token)) {
    throw new Error(`${readinessPath}: measured-door readiness output is missing ${token}`);
  }
}
for (const token of [
  "wholeAssemblyOrientationCorrectionRadians",
  "base.yaw + wholeAssemblyOrientationCorrectionRadians",
  `wholeAssemblyOrientationControllerAuthority = "${controllerAuthority}"`,
]) {
  if (!controllerSource.includes(token)) {
    throw new Error(`${controllerPath}: persistent A1 orientation output is missing ${token}`);
  }
}

for (const forbidden of [staleCondition, broadCondition]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: obsolete A1 extension rule survived`);
  }
}
if (controllerSource.includes(staleControllerYaw)) {
  throw new Error(`${controllerPath}: stale A1 parent-yaw reset survived`);
}

fs.writeFileSync(readinessPath, source, "utf8");
fs.writeFileSync(controllerPath, controllerSource, "utf8");
console.log(`Prepared A1 readiness with positive ${MINIMUM_AUTHORED_EXTENSION_METERS}–${MAXIMUM_AUTHORED_EXTENSION_METERS} m authored travel, a ${MAXIMUM_REACH_ERROR_METERS} m measured-reach identity, and a retraction controller that preserves the parent-level Rotunda-terminal orientation; exact predicted/actual gap, continuity and part-order checks remain mandatory.`);
