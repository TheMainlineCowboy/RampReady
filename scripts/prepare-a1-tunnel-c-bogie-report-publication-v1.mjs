import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const authority = "exact-authored-a1-connected-wheel-pair-ramp-contact-v4";
const retiredAuthority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const marker = "final-a1-exact-wheel-pair-report-publication-v2";
let source = fs.readFileSync(installationPath, "utf8");

source = source.replaceAll(retiredAuthority, authority);

for (const required of [
  "const finalBogieWorldClearanceMeters = authoredA1BogieWorldAfter.minimumY",
  "const report = Object.freeze({",
  "bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,",
  "contactAxisT",
  "rotundaDistance",
  "cabDistance",
  "wheelSeparationMeters",
  "wheelTriangleCount",
]) {
  if (!source.includes(required)) {
    throw new Error(`${installationPath}: exact wheel-pair report publication is missing prerequisite ${required}`);
  }
}

const reportAnchor = "    bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,";
const requiredReportFields = [
  "bogieGroundClearanceMeters: finalBogieWorldClearanceMeters,",
  `bogieGroundContactAuthority: "${authority}",`,
  "bogieGroundContactPointCount: authoredA1BogieWorldAfter.contactPointCount,",
  "bogieGroundContactClusterCount: authoredA1BogieWorldAfter.contactClusterCount,",
  "bogieGroundContactSpanX: authoredA1BogieWorldAfter.spanX,",
  "bogieGroundContactSpanZ: authoredA1BogieWorldAfter.spanZ,",
  "bogieGroundHorizontalContactSpanMeters: authoredA1BogieWorldAfter.horizontalContactSpanMeters,",
  "bogieGroundContactCenterX: authoredA1BogieWorldAfter.centerX,",
  "bogieGroundContactCenterY: authoredA1BogieWorldAfter.centerY,",
  "bogieGroundContactCenterZ: authoredA1BogieWorldAfter.centerZ,",
  "bogieGroundContactAxisT: authoredA1BogieWorldAfter.contactAxisT,",
  "bogieGroundContactRotundaDistanceMeters: authoredA1BogieWorldAfter.rotundaDistance,",
  "bogieGroundContactCabDistanceMeters: authoredA1BogieWorldAfter.cabDistance,",
  "bogieWheelSeparationMeters: authoredA1BogieWorldAfter.wheelSeparationMeters,",
  "bogieWheelTriangleCount: authoredA1BogieWorldAfter.wheelTriangleCount,",
];
if (!requiredReportFields.every((line) => source.includes(line))) {
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: exact wheel-pair report anchor is missing`);
  const missing = requiredReportFields.filter((line) => !source.includes(line));
  source = source.replace(reportAnchor, `${reportAnchor}\n    // ${marker}\n    ${missing.join("\n    ")}`);
} else if (!source.includes(marker)) {
  source = source.replace(reportAnchor, `${reportAnchor}\n    // ${marker}`);
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
  "group.userData.uploadedJetwayBogieGroundContactAxisT = report.bogieGroundContactAxisT;",
  "group.userData.uploadedJetwayBogieGroundContactRotundaDistanceMeters = report.bogieGroundContactRotundaDistanceMeters;",
  "group.userData.uploadedJetwayBogieGroundContactCabDistanceMeters = report.bogieGroundContactCabDistanceMeters;",
  "group.userData.uploadedJetwayBogieWheelSeparationMeters = report.bogieWheelSeparationMeters;",
  "group.userData.uploadedJetwayBogieWheelTriangleCount = report.bogieWheelTriangleCount;",
];
if (!publicationLines.every((line) => source.includes(line))) {
  const groupAnchor = "  group.userData.uploadedJetwayBogieTireContactCorrectionMeters = report.bogieTireContactCorrectionMeters;";
  if (!source.includes(groupAnchor)) throw new Error(`${installationPath}: exact wheel-pair group publication anchor is missing`);
  const missing = publicationLines.filter((line) => !source.includes(line));
  source = source.replace(groupAnchor, `${groupAnchor}\n  ${missing.join("\n  ")}`);
}

for (const required of [marker, ...requiredReportFields, ...publicationLines]) {
  if (!source.includes(required)) throw new Error(`${installationPath}: exact wheel-pair report publication is missing ${required}`);
}
if (source.includes(retiredAuthority)) {
  throw new Error(`${installationPath}: retired v3 bogie authority survived exact wheel-pair report publication`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Published the already-validated exact authored A1 wheel pair into the final installation report, including aircraft-side axis position, Rotunda/Cab proximity, axle separation and source topology; no geometry was changed.");
