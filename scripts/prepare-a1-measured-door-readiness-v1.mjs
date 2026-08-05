import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const MINIMUM_AUTHORED_EXTENSION_METERS = -14.5;
const MAXIMUM_AUTHORED_EXTENSION_METERS = 8.75;
const authority = "authored-articulation-limits-with-measured-crj-door-v2";

const staleCondition = "|| !(a1AttachedExtension > 3 && a1AttachedExtension < 7)";
const intermediateCondition = `|| !(a1AttachedExtension > 0.25 && a1AttachedExtension < 7)
            || Math.abs(sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance) > 0.05`;
const correctedCondition = `|| !Number.isFinite(a1AttachedExtension)
            || a1AttachedExtension < ${MINIMUM_AUTHORED_EXTENSION_METERS}
            || a1AttachedExtension > ${MAXIMUM_AUTHORED_EXTENSION_METERS}
            || Math.abs(sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance) > 0.05`;

if (source.includes(intermediateCondition)) {
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
    `${evidenceAnchor}\n          group.userData.uploadedJetwayA1MeasuredDoorReadinessAuthority = MEASURED_DOOR_READINESS_AUTHORITY;\n          group.userData.uploadedJetwayA1MinimumAuthoredExtensionMeters = ${MINIMUM_AUTHORED_EXTENSION_METERS};\n          group.userData.uploadedJetwayA1MaximumAuthoredExtensionMeters = ${MAXIMUM_AUTHORED_EXTENSION_METERS};`,
  );
}

for (const token of [
  correctedCondition,
  `MEASURED_DOOR_READINESS_AUTHORITY = "${authority}"`,
  "uploadedJetwayA1MeasuredDoorReadinessAuthority",
  `uploadedJetwayA1MinimumAuthoredExtensionMeters = ${MINIMUM_AUTHORED_EXTENSION_METERS}`,
  `uploadedJetwayA1MaximumAuthoredExtensionMeters = ${MAXIMUM_AUTHORED_EXTENSION_METERS}`,
  "sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance",
]) {
  if (!source.includes(token)) {
    throw new Error(`${readinessPath}: measured-door readiness output is missing ${token}`);
  }
}

for (const forbidden of [staleCondition, intermediateCondition]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: obsolete A1 extension window survived`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log(`Prepared A1 readiness against the authored ${MINIMUM_AUTHORED_EXTENSION_METERS} to ${MAXIMUM_AUTHORED_EXTENSION_METERS} m articulation limits and the exact measured-reach identity; the 1.842 m forward-door extension remains subject to predicted/actual contact, gap, continuity and part-order checks.`);
