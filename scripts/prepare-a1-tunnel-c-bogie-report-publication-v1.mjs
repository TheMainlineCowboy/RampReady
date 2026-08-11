import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const authority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const marker = "final-a1-tunnel-c-bogie-report-publication-v1";
let source = fs.readFileSync(installationPath, "utf8");

for (const required of [
  "const finalBogieWorldClearanceMeters = authoredA1BogieWorldAfter.minimumY",
  "const report = Object.freeze({",
  "bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,",
]) {
  if (!source.includes(required)) {
    throw new Error(`${installationPath}: final Tunnel-C report publication is missing prerequisite ${required}`);
  }
}

if (!source.includes(marker)) {
  const reportAnchor = "    bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,";
  const reportFields = `${reportAnchor}\n    // ${marker}\n    bogieGroundClearanceMeters: finalBogieWorldClearanceMeters,\n    bogieGroundContactAuthority: \"${authority}\",\n    bogieGroundContactPointCount: authoredA1BogieWorldAfter.contactPointCount,\n    bogieGroundContactClusterCount: authoredA1BogieWorldAfter.contactClusterCount,\n    bogieGroundContactSpanX: authoredA1BogieWorldAfter.spanX,\n    bogieGroundContactSpanZ: authoredA1BogieWorldAfter.spanZ,\n    bogieGroundHorizontalContactSpanMeters: authoredA1BogieWorldAfter.horizontalContactSpanMeters,\n    bogieGroundContactCenterX: authoredA1BogieWorldAfter.centerX,\n    bogieGroundContactCenterY: authoredA1BogieWorldAfter.centerY,\n    bogieGroundContactCenterZ: authoredA1BogieWorldAfter.centerZ,`;
  if (!source.includes(reportAnchor)) {
    throw new Error(`${installationPath}: final Tunnel-C report anchor is missing`);
  }
  source = source.replace(reportAnchor, reportFields);
}

const publicationLines = [
  "group.userData.uploadedJetwayBogieGroundClearanceMeters = report.bogieGroundClearanceMeters;",
  "group.userData.uploadedJetwayBogieGroundContactAuthority = report.bogieGroundContactAuthority;",
  "group.userData.uploadedJetwayBogieGroundContactPointCount = report.bogieGroundContactPointCount;",
  "group.userData.uploadedJetwayBogieGroundContactClusterCount = report.bogieGroundContactClusterCount;",
  "group.userData.uploadedJetwayBogieGroundContactSpanX = report.bogieGroundContactSpanX;",
  "group.userData.uploadedJetwayBogieGroundContactSpanZ = report.bogieGroundContactSpanZ;",
  "group.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters = report.bogieGroundHorizontalContactSpanMeters;",
  "group.userData.uploadedJetwayBogieGroundContactCenterX = report.bogieGroundContactCenterX;",
  "group.userData.uploadedJetwayBogieGroundContactCenterY = report.bogieGroundContactCenterY;",
  "group.userData.uploadedJetwayBogieGroundContactCenterZ = report.bogieGroundContactCenterZ;",
];
if (!publicationLines.every((line) => source.includes(line))) {
  const groupAnchor = "  group.userData.uploadedJetwayBogieTireContactCorrectionMeters = report.bogieTireContactCorrectionMeters;";
  if (!source.includes(groupAnchor)) {
    throw new Error(`${installationPath}: final Tunnel-C group publication anchor is missing`);
  }
  const missing = publicationLines.filter((line) => !source.includes(line));
  source = source.replace(groupAnchor, `${groupAnchor}\n  ${missing.join("\n  ")}`);
}

for (const required of [
  marker,
  `bogieGroundContactAuthority: \"${authority}\"`,
  "bogieGroundClearanceMeters: finalBogieWorldClearanceMeters",
  "bogieGroundContactPointCount: authoredA1BogieWorldAfter.contactPointCount",
  "bogieGroundContactClusterCount: authoredA1BogieWorldAfter.contactClusterCount",
  "bogieGroundHorizontalContactSpanMeters: authoredA1BogieWorldAfter.horizontalContactSpanMeters",
  ...publicationLines,
]) {
  if (!source.includes(required)) {
    throw new Error(`${installationPath}: final Tunnel-C report publication is missing ${required}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Published the already-validated final world Tunnel-C bogie clearance and contact footprint into the exact-jetway installation report; no geometry was changed.");
