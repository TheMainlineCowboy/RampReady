import fs from "node:fs";

const runtimePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-preserve-measured-wall-parent-yaw-v1";
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  source = source.replace(
    `const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2";`,
    `const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "a1-real-wall-registered-rotunda-measured-wall-parent-yaw-v3";`,
  );
  source = source.replace(
    `const TARGET_DIRECTION_AUTHORITY = "decoded-kphx-heading-owns-intact-a1-aircraft-must-conform-v2";`,
    `const TARGET_DIRECTION_AUTHORITY = "measured-wall-parent-owns-a1-aircraft-target-diagnostic-v3";`,
  );

  const startToken = `  // Apply the decoded KPHX heading to the COMPLETE supplied A1 anchor, never to`;
  const endToken = `  group.userData.uploadedJetwayA1SourceAxisYawDeltaRadians = sourceAxisYawDelta;`;
  const start = source.indexOf(startToken);
  const endStart = source.indexOf(endToken, start);
  if (start < 0 || endStart < 0) {
    throw new Error(`${runtimePath}: decoded-heading parent overwrite block is missing`);
  }
  const end = endStart + endToken.length;
  const replacement = `  // ${marker}
  // correctUploadedJetwayInstallationV1 already rotated the COMPLETE supplied
  // parent so the exact Rotunda opening faces the measured Terminal 4 wall and
  // then translated that same parent onto the short wall connector. Do not
  // overwrite that physical registration with the AIR_Jetway01 BGL heading.
  // The BGL heading belongs to the replaced stock model and remains provenance
  // only. Every supplied child transform stays untouched.
  const decodedSourceBridgeDirection = new THREE.Vector3(
    Math.sin(Number(placement.yaw)),
    0,
    Math.cos(Number(placement.yaw)),
  ).normalize();
  const sourceAxisRotundaAfter = objectCenterInFleet(THREE, fleet, rotunda);
  const sourceAxisTunnelAfter = objectCenterInFleet(THREE, fleet, tunnelA);
  const sourceAxisBridgeDirectionAfter = sourceAxisTunnelAfter.clone().sub(sourceAxisRotundaAfter).setY(0);
  if (sourceAxisBridgeDirectionAfter.lengthSq() < 0.25) {
    throw new Error("A1 measured-wall Rotunda-to-Tunnel-A source axis is degenerate");
  }
  sourceAxisBridgeDirectionAfter.normalize();
  const sourceAxisCurrentHeading = Math.atan2(sourceAxisBridgeDirectionAfter.x, sourceAxisBridgeDirectionAfter.z);
  const sourceAxisDecodedHeading = Math.atan2(decodedSourceBridgeDirection.x, decodedSourceBridgeDirection.z);
  const sourceAxisYawDelta = wrappedAngle(THREE, sourceAxisDecodedHeading - sourceAxisCurrentHeading);
  const sourceAxisAlignmentCosine = sourceAxisBridgeDirectionAfter.dot(decodedSourceBridgeDirection);
  if (![sourceAxisYawDelta, sourceAxisAlignmentCosine, anchor.rotation.y].every(Number.isFinite)) {
    throw new Error("A1 measured-wall parent-yaw provenance telemetry is not finite");
  }
  group.userData.uploadedJetwayA1SourceAxisAlignmentAuthority = "${marker}";
  group.userData.uploadedJetwayA1SourceAxisAlignmentCosine = sourceAxisAlignmentCosine;
  group.userData.uploadedJetwayA1SourceAxisYawDeltaRadians = sourceAxisYawDelta;
  group.userData.uploadedJetwayA1DecodedBglHeadingIsProvenanceOnly = true;
  group.userData.uploadedJetwayA1MeasuredWallParentYawRadians = anchor.rotation.y;`;
  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;

  source = source.replaceAll(
    "intact source-heading lock",
    "measured-wall parent-yaw lock",
  );
  source = source.replaceAll(
    "intact source-heading",
    "measured-wall parent-yaw",
  );
}

for (const required of [
  marker,
  'a1-real-wall-registered-rotunda-measured-wall-parent-yaw-v3',
  'measured-wall-parent-owns-a1-aircraft-target-diagnostic-v3',
  'uploadedJetwayA1DecodedBglHeadingIsProvenanceOnly = true',
  'uploadedJetwayA1MeasuredWallParentYawRadians = anchor.rotation.y',
  'sourceAxisAlignmentCosine = sourceAxisBridgeDirectionAfter.dot(decodedSourceBridgeDirection)',
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: measured-wall parent-yaw contract is missing ${required}`);
}
for (const forbidden of [
  "anchor.rotation.y = Number(placement.yaw);",
  "anchor.rotation.y += sourceAxisYawDelta;",
  "A1 complete-parent bridge axis does not match decoded KPHX heading",
  "sourceAxisAlignmentCosine >= 0.999",
  'a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2',
  'decoded-kphx-heading-owns-intact-a1-aircraft-must-conform-v2',
]) {
  if (source.includes(forbidden)) throw new Error(`${runtimePath}: destructive decoded-heading ownership survived: ${forbidden}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Preserved the complete A1 parent orientation already registered to the measured Terminal 4 wall; decoded AIR_Jetway01 BGL heading is provenance only, supplied child transforms remain untouched, and physical Rotunda through-continuity remains fail-closed.");
