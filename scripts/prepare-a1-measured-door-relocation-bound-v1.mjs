import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const MAXIMUM_MEASURED_RELOCATION_METERS = 32;
const authority = "measured-crj-forward-door-bounded-a1-relocation-v1";

const oldGuard = "if (!(relocationDistance >= 0 && relocationDistance < 28)) {";
const newGuard = `if (!(relocationDistance >= 0 && relocationDistance < ${MAXIMUM_MEASURED_RELOCATION_METERS})) {`;
if (source.includes(oldGuard)) {
  source = source.replace(oldGuard, newGuard);
} else if (!source.includes(newGuard)) {
  throw new Error(`${installationPath}: A1 photo-registration relocation guard is missing`);
}

if (!source.includes("A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY")) {
  const constantAnchor = "const A1_PHOTO_REGISTRATION_AUTHORITY";
  const lineStart = source.indexOf(constantAnchor);
  const lineEnd = lineStart >= 0 ? source.indexOf("\n", lineStart) : -1;
  if (lineStart < 0 || lineEnd < 0) {
    throw new Error(`${installationPath}: photo-registration authority anchor is missing`);
  }
  source = `${source.slice(0, lineEnd + 1)}const A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY = "${authority}";\n${source.slice(lineEnd + 1)}`;
}

if (!source.includes("a1MeasuredDoorRelocationBoundAuthority")) {
  const reportAnchor = "    a1RelocationDistanceMeters: relocationDistance,";
  if (!source.includes(reportAnchor)) {
    throw new Error(`${installationPath}: relocation report anchor is missing`);
  }
  source = source.replace(
    reportAnchor,
    `${reportAnchor}\n    a1MeasuredDoorRelocationBoundAuthority: A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY,\n    a1MaximumMeasuredRelocationMeters: ${MAXIMUM_MEASURED_RELOCATION_METERS},`,
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
  newGuard,
  `A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY = "${authority}"`,
  "a1MeasuredDoorRelocationBoundAuthority: A1_MEASURED_DOOR_RELOCATION_BOUND_AUTHORITY",
  `a1MaximumMeasuredRelocationMeters: ${MAXIMUM_MEASURED_RELOCATION_METERS}`,
  "uploadedJetwayA1MaximumMeasuredRelocationMeters",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: measured-door relocation bound output is missing ${token}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Expanded the bounded whole-A1 relocation limit to ${MAXIMUM_MEASURED_RELOCATION_METERS} m so the 28.935 m authored-model forward-door correction can load; nonfinite, negative and larger relocations remain rejected.`);
