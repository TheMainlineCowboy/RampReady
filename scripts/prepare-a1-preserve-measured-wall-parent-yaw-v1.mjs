import fs from "node:fs";

const runtimePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-preserve-measured-wall-parent-yaw-v1";
const photoAuthority = "a1-real-photo-remote-rotunda-fixed-corridor-v1";
const legacySourceAuthority = "a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2";
const measuredWallAuthority = "a1-real-wall-registered-rotunda-measured-wall-parent-yaw-v3";
const legacyTargetAuthority = "decoded-kphx-heading-owns-intact-a1-aircraft-must-conform-v2";
const measuredWallTargetAuthority = "measured-wall-parent-owns-a1-aircraft-target-diagnostic-v3";
let source = fs.readFileSync(runtimePath, "utf8");

if (source.includes(photoAuthority)) {
  // The Aug. 15 KPHX A1/A3 reference supersedes this legacy wall-normal yaw
  // rewrite. The long fixed terminal corridor reaches the real BGATE1 facade;
  // the exact movable jetway itself remains at the decoded source model origin
  // and the COMPLETE supplied parent is calibrated from its physical
  // Rotunda->Tunnel-A axis. Do not rotate that parent to a facade normal and do
  // not demote the decoded source heading to provenance-only telemetry.
  for (const required of [
    photoAuthority,
    legacySourceAuthority,
    "anchor.position.x = rawBglPlacementX;",
    "anchor.position.z = rawBglPlacementZ;",
    "anchor.rotation.y = Number(placement.yaw);",
    "anchor.rotation.y += sourceAxisYawDelta;",
    "uploadedJetwayA1SourceAxisAlignmentCosine",
    "uploadedJetwayA1RemoteSourceRotunda",
    "uploadedJetwayA1LongFixedTerminalCorridor",
    "const sourceModelOriginRelocationX = 0;",
    "const sourceModelOriginRelocationZ = 0;",
  ]) {
    if (!source.includes(required)) throw new Error(`${runtimePath}: real-photo source-heading preservation is missing ${required}`);
  }
  for (const forbidden of [
    measuredWallAuthority,
    measuredWallTargetAuthority,
    "uploadedJetwayA1DecodedBglHeadingIsProvenanceOnly = true",
    "uploadedJetwayA1MeasuredWallParentYawRadians = anchor.rotation.y",
    "bridgePivot.attach(root)",
    "anchor.rotation.y += yawDelta",
  ]) {
    if (source.includes(forbidden)) throw new Error(`${runtimePath}: stale measured-wall yaw ownership survived real-photo authority: ${forbidden}`);
  }

  // Preserve the useful half of the old wall-normal pass: publish the exact
  // selected BGATE1 facade point and oriented wall normal into the final A1
  // placement so correctUploadedJetwayInstallationV1 can build the fixed
  // corridor to the real terminal. The photo-safe publisher is forbidden from
  // changing A1 yaw or demoting the decoded source heading.
  await import(`./prepare-a1-photo-explicit-terminal-wall-v1.mjs?photo-wall=${Date.now()}`);
  console.log(`Skipped ${marker} yaw rewrite: ${photoAuthority} keeps the complete exact A1 parent on its decoded source pose/physical bridge heading while the explicit BGATE1 wall endpoint owns the fixed terminal corridor.`);
} else {
  if (!source.includes(marker)) {
    source = source.replaceAll(legacySourceAuthority, measuredWallAuthority);
    source = source.replaceAll(legacyTargetAuthority, measuredWallTargetAuthority);

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

    source = source.replaceAll("intact source-heading lock", "measured-wall parent-yaw lock");
    source = source.replaceAll("intact source-heading", "measured-wall parent-yaw");
  }

  for (const required of [
    marker,
    measuredWallAuthority,
    measuredWallTargetAuthority,
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
    legacySourceAuthority,
    legacyTargetAuthority,
  ]) {
    if (source.includes(forbidden)) throw new Error(`${runtimePath}: destructive/stale decoded-heading ownership survived: ${forbidden}`);
  }

  fs.writeFileSync(runtimePath, source, "utf8");
  console.log("Preserved the complete A1 parent orientation already registered to the measured Terminal 4 wall; decoded AIR_Jetway01 BGL heading is provenance only, supplied child transforms remain untouched, and physical Rotunda through-continuity remains fail-closed.");

  await import(`./prepare-a1-main-facade-wall-normal-registration-v1.mjs?after-measured-wall-parent=${Date.now()}`);
}
