import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const authority = "exact-authored-a1-lowest-geometry-ramp-contact-v1";
const fixedOffsetBlock = `  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);`;
const measuredOffsetBlock = `  // ${authority}
  // Ground the complete supplied jetway parent from its authored lowest geometry.
  // Yaw and X/Z registration cannot change this contact height, and no child node
  // is translated or rotated independently.
  fleet.updateMatrixWorld(true);
  const authoredA1GroundBoundsBefore = new THREE.Box3().setFromObject(a1Model);
  if (authoredA1GroundBoundsBefore.isEmpty()) {
    throw new Error("A1 exact authored jetway has empty ground-contact bounds");
  }
  const measuredBogieGroundOffsetMeters = -authoredA1GroundBoundsBefore.min.y;
  if (!Number.isFinite(measuredBogieGroundOffsetMeters)
    || Math.abs(measuredBogieGroundOffsetMeters) > 0.5) {
    throw new Error(\`A1 exact authored bogie ground offset is invalid: \${measuredBogieGroundOffsetMeters}\`);
  }
  fleet.position.y += measuredBogieGroundOffsetMeters;
  fleet.updateMatrixWorld(true);
  const authoredA1GroundBoundsAfter = new THREE.Box3().setFromObject(a1Model);
  const measuredBogieGroundClearanceMeters = authoredA1GroundBoundsAfter.min.y;
  if (Math.abs(measuredBogieGroundClearanceMeters) > 0.005) {
    throw new Error(\`A1 exact authored bogie missed the ramp by \${measuredBogieGroundClearanceMeters} m\`);
  }`;

if (source.includes(fixedOffsetBlock)) {
  source = source.replace(fixedOffsetBlock, measuredOffsetBlock);
} else if (!source.includes(authority)) {
  throw new Error(`${installationPath}: fixed A1 fleet ground offset block is missing`);
}

source = source.replace(
  `    groundOffsetMeters: -BOGIE_TIRE_CONTACT_CORRECTION_METERS,
    bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,`,
  `    groundOffsetMeters: measuredBogieGroundOffsetMeters,
    bogieTireContactCorrectionMeters: Math.abs(measuredBogieGroundOffsetMeters),
    bogieGroundClearanceMeters: measuredBogieGroundClearanceMeters,
    bogieGroundContactAuthority: "${authority}",`,
);

const groupAnchor = `  group.userData.uploadedJetwayBogieTireContactCorrectionMeters = report.bogieTireContactCorrectionMeters;`;
if (source.includes(groupAnchor) && !source.includes("uploadedJetwayBogieGroundContactAuthority")) {
  source = source.replace(
    groupAnchor,
    `${groupAnchor}
  group.userData.uploadedJetwayBogieGroundClearanceMeters = report.bogieGroundClearanceMeters;
  group.userData.uploadedJetwayBogieGroundContactAuthority = report.bogieGroundContactAuthority;`,
  );
}

for (const token of [
  authority,
  "const authoredA1GroundBoundsBefore = new THREE.Box3().setFromObject(a1Model)",
  "const measuredBogieGroundOffsetMeters = -authoredA1GroundBoundsBefore.min.y",
  "fleet.position.y += measuredBogieGroundOffsetMeters",
  "const measuredBogieGroundClearanceMeters = authoredA1GroundBoundsAfter.min.y",
  "bogieGroundClearanceMeters: measuredBogieGroundClearanceMeters",
  "uploadedJetwayBogieGroundContactAuthority",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: exact bogie ground-contact output is missing ${token}`);
  }
}
if (source.includes("fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS")) {
  throw new Error(`${installationPath}: hard-coded fleet ground correction remains active`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Grounded the complete supplied A1 jetway parent from exact authored lowest geometry and required post-offset ramp clearance within 5 mm.");
