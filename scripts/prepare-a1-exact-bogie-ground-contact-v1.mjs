import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const authority = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
const legacyAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v1";
const fixedOffsetBlock = `  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);`;
const measuredOffsetBlock = `  // ${authority}
  // Ground the complete supplied jetway parent from separated authored low
  // contact clusters. This rejects a false contact produced by one stair tip,
  // helper, or shell vertex while preserving every supplied child transform.
  // Retain the exact world-space contact centroid so the browser can frame the
  // actual bogie footprint instead of guessing from the Cab or aircraft nose.
  const measureAuthoredA1RampContact = () => {
    a1Model.updateMatrixWorld(true);
    let minimumY = Number.POSITIVE_INFINITY;
    let authoredVertexCount = 0;
    const point = new THREE.Vector3();
    a1Model.traverse((object) => {
      if (!object?.isMesh || object.visible === false) return;
      const position = object.geometry?.getAttribute?.("position");
      if (!position) return;
      for (let index = 0; index < position.count; index += 1) {
        point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
        minimumY = Math.min(minimumY, point.y);
        authoredVertexCount += 1;
      }
    });
    if (!Number.isFinite(minimumY) || authoredVertexCount < 1000) {
      throw new Error(\`A1 exact authored jetway ground scan is invalid: minimum=\${minimumY}, vertices=\${authoredVertexCount}\`);
    }

    const contactBandMeters = 0.08;
    const cellSizeMeters = 0.28;
    const contactBounds = new THREE.Box3();
    const occupiedCells = new Set();
    let contactPointCount = 0;
    a1Model.traverse((object) => {
      if (!object?.isMesh || object.visible === false) return;
      const position = object.geometry?.getAttribute?.("position");
      if (!position) return;
      for (let index = 0; index < position.count; index += 1) {
        point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
        if (point.y > minimumY + contactBandMeters) continue;
        contactBounds.expandByPoint(point);
        occupiedCells.add([
          Math.floor(point.x / cellSizeMeters),
          Math.floor(point.z / cellSizeMeters),
        ].join(","));
        contactPointCount += 1;
      }
    });

    const remaining = new Set(occupiedCells);
    let contactClusterCount = 0;
    while (remaining.size) {
      contactClusterCount += 1;
      const first = remaining.values().next().value;
      remaining.delete(first);
      const stack = [first];
      while (stack.length) {
        const [cellX, cellZ] = stack.pop().split(",").map(Number);
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dz = -1; dz <= 1; dz += 1) {
            const neighbor = [cellX + dx, cellZ + dz].join(",");
            if (!remaining.delete(neighbor)) continue;
            stack.push(neighbor);
          }
        }
      }
    }

    const contactSpan = contactBounds.getSize(new THREE.Vector3());
    const contactCenter = contactBounds.getCenter(new THREE.Vector3());
    const horizontalContactSpanMeters = Math.hypot(contactSpan.x, contactSpan.z);
    if (contactBounds.isEmpty()
      || contactPointCount < 8
      || contactClusterCount < 2
      || horizontalContactSpanMeters < 1.2
      || ![contactCenter.x, contactCenter.y, contactCenter.z].every(Number.isFinite)) {
      throw new Error(\`A1 exact authored jetway does not expose a credible multi-point ramp footprint: points=\${contactPointCount}, clusters=\${contactClusterCount}, span=\${contactSpan.x}x\${contactSpan.z}, center=\${contactCenter.toArray().join(",")}\`);
    }
    return Object.freeze({
      minimumY,
      authoredVertexCount,
      contactPointCount,
      contactClusterCount,
      spanX: contactSpan.x,
      spanZ: contactSpan.z,
      horizontalContactSpanMeters,
      centerX: contactCenter.x,
      centerY: contactCenter.y,
      centerZ: contactCenter.z,
      minimumX: contactBounds.min.x,
      minimumZ: contactBounds.min.z,
      maximumX: contactBounds.max.x,
      maximumZ: contactBounds.max.z,
    });
  };

  fleet.updateMatrixWorld(true);
  const authoredA1GroundContactBefore = measureAuthoredA1RampContact();
  const measuredBogieGroundOffsetMeters = -authoredA1GroundContactBefore.minimumY;
  if (!Number.isFinite(measuredBogieGroundOffsetMeters)
    || Math.abs(measuredBogieGroundOffsetMeters) > 3) {
    throw new Error(\`A1 exact authored bogie ground offset is invalid: \${measuredBogieGroundOffsetMeters}\`);
  }
  fleet.position.y += measuredBogieGroundOffsetMeters;
  fleet.updateMatrixWorld(true);
  const authoredA1GroundContactAfter = measureAuthoredA1RampContact();
  const measuredBogieGroundClearanceMeters = authoredA1GroundContactAfter.minimumY;
  if (Math.abs(measuredBogieGroundClearanceMeters) > 0.005) {
    throw new Error(\`A1 exact authored bogie missed the ramp by \${measuredBogieGroundClearanceMeters} m\`);
  }`;

if (source.includes(fixedOffsetBlock)) {
  source = source.replace(fixedOffsetBlock, measuredOffsetBlock);
} else if (!source.includes(authority)) {
  if (source.includes(legacyAuthority)) {
    source = source.replaceAll(legacyAuthority, authority);
  } else {
    throw new Error(`${installationPath}: fixed A1 fleet ground offset block is missing`);
  }
}

source = source.replaceAll(legacyAuthority, authority);

source = source.replace(
  `    groundOffsetMeters: -BOGIE_TIRE_CONTACT_CORRECTION_METERS,
    bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,`,
  `    groundOffsetMeters: measuredBogieGroundOffsetMeters,
    bogieTireContactCorrectionMeters: Math.abs(measuredBogieGroundOffsetMeters),
    bogieGroundClearanceMeters: measuredBogieGroundClearanceMeters,
    bogieGroundContactAuthority: "${authority}",
    bogieGroundContactPointCount: authoredA1GroundContactAfter.contactPointCount,
    bogieGroundContactClusterCount: authoredA1GroundContactAfter.contactClusterCount,
    bogieGroundContactSpanX: authoredA1GroundContactAfter.spanX,
    bogieGroundContactSpanZ: authoredA1GroundContactAfter.spanZ,
    bogieGroundHorizontalContactSpanMeters: authoredA1GroundContactAfter.horizontalContactSpanMeters,
    bogieGroundContactCenterX: authoredA1GroundContactAfter.centerX,
    bogieGroundContactCenterY: authoredA1GroundContactAfter.centerY,
    bogieGroundContactCenterZ: authoredA1GroundContactAfter.centerZ,
    bogieGroundContactMinimumX: authoredA1GroundContactAfter.minimumX,
    bogieGroundContactMinimumZ: authoredA1GroundContactAfter.minimumZ,
    bogieGroundContactMaximumX: authoredA1GroundContactAfter.maximumX,
    bogieGroundContactMaximumZ: authoredA1GroundContactAfter.maximumZ,`,
);

if (!source.includes("bogieGroundContactCenterX: authoredA1GroundContactAfter.centerX")) {
  const reportAnchor = "    bogieGroundHorizontalContactSpanMeters: authoredA1GroundContactAfter.horizontalContactSpanMeters,";
  if (!source.includes(reportAnchor)) {
    throw new Error(`${installationPath}: bogie contact report anchor is missing`);
  }
  source = source.replace(
    reportAnchor,
    `${reportAnchor}
    bogieGroundContactCenterX: authoredA1GroundContactAfter.centerX,
    bogieGroundContactCenterY: authoredA1GroundContactAfter.centerY,
    bogieGroundContactCenterZ: authoredA1GroundContactAfter.centerZ,
    bogieGroundContactMinimumX: authoredA1GroundContactAfter.minimumX,
    bogieGroundContactMinimumZ: authoredA1GroundContactAfter.minimumZ,
    bogieGroundContactMaximumX: authoredA1GroundContactAfter.maximumX,
    bogieGroundContactMaximumZ: authoredA1GroundContactAfter.maximumZ,`,
  );
}

const groupAnchor = `  group.userData.uploadedJetwayBogieTireContactCorrectionMeters = report.bogieTireContactCorrectionMeters;`;
if (source.includes(groupAnchor) && !source.includes("uploadedJetwayBogieGroundContactAuthority")) {
  source = source.replace(
    groupAnchor,
    `${groupAnchor}
  group.userData.uploadedJetwayBogieGroundClearanceMeters = report.bogieGroundClearanceMeters;
  group.userData.uploadedJetwayBogieGroundContactAuthority = report.bogieGroundContactAuthority;
  group.userData.uploadedJetwayBogieGroundContactPointCount = report.bogieGroundContactPointCount;
  group.userData.uploadedJetwayBogieGroundContactClusterCount = report.bogieGroundContactClusterCount;
  group.userData.uploadedJetwayBogieGroundContactSpanX = report.bogieGroundContactSpanX;
  group.userData.uploadedJetwayBogieGroundContactSpanZ = report.bogieGroundContactSpanZ;
  group.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters = report.bogieGroundHorizontalContactSpanMeters;
  group.userData.uploadedJetwayBogieGroundContactCenterX = report.bogieGroundContactCenterX;
  group.userData.uploadedJetwayBogieGroundContactCenterY = report.bogieGroundContactCenterY;
  group.userData.uploadedJetwayBogieGroundContactCenterZ = report.bogieGroundContactCenterZ;
  group.userData.uploadedJetwayBogieGroundContactMinimumX = report.bogieGroundContactMinimumX;
  group.userData.uploadedJetwayBogieGroundContactMinimumZ = report.bogieGroundContactMinimumZ;
  group.userData.uploadedJetwayBogieGroundContactMaximumX = report.bogieGroundContactMaximumX;
  group.userData.uploadedJetwayBogieGroundContactMaximumZ = report.bogieGroundContactMaximumZ;`,
  );
} else if (!source.includes("uploadedJetwayBogieGroundContactCenterX")) {
  const existingGroupAnchor = "  group.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters = report.bogieGroundHorizontalContactSpanMeters;";
  if (!source.includes(existingGroupAnchor)) {
    throw new Error(`${installationPath}: existing bogie contact group publication anchor is missing`);
  }
  source = source.replace(
    existingGroupAnchor,
    `${existingGroupAnchor}
  group.userData.uploadedJetwayBogieGroundContactCenterX = report.bogieGroundContactCenterX;
  group.userData.uploadedJetwayBogieGroundContactCenterY = report.bogieGroundContactCenterY;
  group.userData.uploadedJetwayBogieGroundContactCenterZ = report.bogieGroundContactCenterZ;
  group.userData.uploadedJetwayBogieGroundContactMinimumX = report.bogieGroundContactMinimumX;
  group.userData.uploadedJetwayBogieGroundContactMinimumZ = report.bogieGroundContactMinimumZ;
  group.userData.uploadedJetwayBogieGroundContactMaximumX = report.bogieGroundContactMaximumX;
  group.userData.uploadedJetwayBogieGroundContactMaximumZ = report.bogieGroundContactMaximumZ;`,
  );
}

for (const token of [
  authority,
  "const measureAuthoredA1RampContact = () =>",
  "const contactCenter = contactBounds.getCenter",
  "contactPointCount < 8",
  "contactClusterCount < 2",
  "horizontalContactSpanMeters < 1.2",
  "const measuredBogieGroundOffsetMeters = -authoredA1GroundContactBefore.minimumY",
  "fleet.position.y += measuredBogieGroundOffsetMeters",
  "const measuredBogieGroundClearanceMeters = authoredA1GroundContactAfter.minimumY",
  "bogieGroundContactClusterCount: authoredA1GroundContactAfter.contactClusterCount",
  "bogieGroundContactCenterX: authoredA1GroundContactAfter.centerX",
  "uploadedJetwayBogieGroundContactCenterX",
  "uploadedJetwayBogieGroundContactCenterY",
  "uploadedJetwayBogieGroundContactCenterZ",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: exact bogie ground-contact output is missing ${token}`);
  }
}
if (source.includes("fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS")) {
  throw new Error(`${installationPath}: hard-coded fleet ground correction remains active`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Grounded the complete supplied A1 parent from separated authored low-contact clusters and published the exact world-space contact centroid/bounds for a real bogie close-up.");
