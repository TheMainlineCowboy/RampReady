import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const FALLBACK_MAXIMUM_MEASURED_RELOCATION_METERS = 32;
const authority = "measured-crj-forward-door-authored-span-bound-v2";

const oldGuard = "if (!(relocationDistance >= 0 && relocationDistance < 28)) {";
const fallbackGuard = `if (!(relocationDistance >= 0 && relocationDistance < ${FALLBACK_MAXIMUM_MEASURED_RELOCATION_METERS})) {`;
const geometryBoundTokens = [
  "const maximumPhotoRegistrationRelocationMeters",
  "photoRegistrationHorizontalSpanMeters + sourceTerminalDistance + terminalDistance",
  "relocationDistance <= maximumPhotoRegistrationRelocationMeters",
];
const hasGeometryDerivedGuard = geometryBoundTokens.every((token) => source.includes(token));

let maximumRelocationExpression;
if (hasGeometryDerivedGuard) {
  // The whole authored assembly is reversed around its measured midpoint. Keep
  // the resulting strict bound derived from the actual Rotunda-to-Cab geometry
  // instead of replacing it with another arbitrary fixed number.
  maximumRelocationExpression = "maximumPhotoRegistrationRelocationMeters";
} else if (source.includes(oldGuard)) {
  source = source.replace(oldGuard, fallbackGuard);
  maximumRelocationExpression = String(FALLBACK_MAXIMUM_MEASURED_RELOCATION_METERS);
} else if (source.includes(fallbackGuard)) {
  maximumRelocationExpression = String(FALLBACK_MAXIMUM_MEASURED_RELOCATION_METERS);
} else {
  throw new Error(`${installationPath}: no valid A1 photo-registration relocation guard is present`);
}

if (!source.includes("A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY")) {
  const constantAnchor = "const A1_PHOTO_REGISTRATION_AUTHORITY";
  const lineStart = source.indexOf(constantAnchor);
  const lineEnd = lineStart >= 0 ? source.indexOf("\n", lineStart) : -1;
  if (lineStart < 0 || lineEnd < 0) {
    throw new Error(`${installationPath}: photo-registration authority anchor is missing`);
  }
  source = `${source.slice(0, lineEnd + 1)}const A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY = "${authority}";\n${source.slice(lineEnd + 1)}`;
} else {
  source = source.replace(
    /const A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY = "[^"]+";/,
    `const A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY = "${authority}";`,
  );
}

if (!source.includes("a1MeasuredDoorRelocationBoundAuthority")) {
  const reportAnchor = "    a1RelocationDistanceMeters: relocationDistance,";
  if (!source.includes(reportAnchor)) {
    throw new Error(`${installationPath}: relocation report anchor is missing`);
  }
  source = source.replace(
    reportAnchor,
    `${reportAnchor}\n    a1MeasuredDoorRelocationBoundAuthority: A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY,\n    a1MaximumMeasuredRelocationMeters: ${maximumRelocationExpression},`,
  );
} else {
  source = source.replace(
    /a1MaximumMeasuredRelocationMeters:\s*(?:\d+(?:\.\d+)?|maximumPhotoRegistrationRelocationMeters),/,
    `a1MaximumMeasuredRelocationMeters: ${maximumRelocationExpression},`,
  );
}

if (!source.includes("uploadedJetwayA1MaximumMeasuredRelocationMeters")) {
  const groupAnchor = "  group.userData.uploadedJetwayA1RelocationDistanceMeters = report.a1RelocationDistanceMeters;";
  if (!source.includes(groupAnchor)) {
    throw new Error(`${installationPath}: relocation runtime-evidence anchor is missing`);
  }
  source = source.replace(
    groupAnchor,
    `${groupAnchor}\n  group.userData.uploadedJetwayA1MeasuredDoorRelocationBoundAuthority = report.a1MeasuredDoorRelocationBoundAuthority;\n  group.userData.uploadedJetwayA1MaximumMeasuredRelocationMeters = report.a1MaximumMeasuredRelocationMeters;`,
  );
}

for (const token of [
  `A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY = "${authority}"`,
  "a1MeasuredDoorRelocationBoundAuthority: A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY",
  `a1MaximumMeasuredRelocationMeters: ${maximumRelocationExpression}`,
  "uploadedJetwayA1MaximumMeasuredRelocationMeters",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: measured-door relocation bound output is missing ${token}`);
  }
}
if (hasGeometryDerivedGuard && !geometryBoundTokens.every((token) => source.includes(token))) {
  throw new Error(`${installationPath}: authored-span relocation guard was not preserved`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(
  hasGeometryDerivedGuard
    ? "Preserved the authored-span A1 relocation bound for the measured CRJ forward-door target; no arbitrary fixed cutoff replaced it."
    : `Applied the ${FALLBACK_MAXIMUM_MEASURED_RELOCATION_METERS} m compatibility bound because the authored-span guard was not present.`,
);
