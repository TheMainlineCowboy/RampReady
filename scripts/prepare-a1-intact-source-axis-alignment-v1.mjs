import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-intact-parent-source-axis-alignment-v1";
let source = fs.readFileSync(sourcePath, "utf8");

if (source.includes(marker)) {
  console.log("A1 intact-parent source-axis alignment is already prepared.");
  process.exit(0);
}

// The supplied Airport_Jetway.glb does not guarantee that its local +Z axis is
// the physical Rotunda->Tunnel-A bridge axis. Applying the decoded KPHX yaw to
// the parent as an absolute transform therefore preserves the wrong local-axis
// offset. Keep the whole supplied hierarchy intact, measure its actual bridge
// axis, then rotate the complete parent by only the remaining source-heading
// delta. The Rotunda is translated back afterward so the measured real-wall
// registration cannot move.
const absoluteHeadingBlock = `  anchor.rotation.y = Number(placement.yaw);
  if (!Number.isFinite(anchor.rotation.y)) throw new Error("A1 decoded KPHX BGL heading is missing");
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  const rotatedSourceHeadingRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);`;

const axisAlignedHeadingBlock = `  anchor.rotation.y = Number(placement.yaw);
  if (!Number.isFinite(anchor.rotation.y)) throw new Error("A1 decoded KPHX BGL heading is missing");
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  // ${marker}
  const decodedSourceBridgeDirection = new THREE.Vector3(
    Math.sin(Number(placement.yaw)),
    0,
    Math.cos(Number(placement.yaw)),
  ).normalize();
  const sourceAxisRotundaBefore = objectCenterInFleet(THREE, fleet, rotunda);
  const sourceAxisTunnelBefore = objectCenterInFleet(THREE, fleet, tunnelA);
  const sourceAxisBridgeDirectionBefore = sourceAxisTunnelBefore.clone().sub(sourceAxisRotundaBefore).setY(0);
  if (sourceAxisBridgeDirectionBefore.lengthSq() < 0.25) {
    throw new Error("A1 supplied Rotunda-to-Tunnel-A source axis is degenerate");
  }
  sourceAxisBridgeDirectionBefore.normalize();
  const sourceAxisCurrentHeading = Math.atan2(sourceAxisBridgeDirectionBefore.x, sourceAxisBridgeDirectionBefore.z);
  const sourceAxisDesiredHeading = Math.atan2(decodedSourceBridgeDirection.x, decodedSourceBridgeDirection.z);
  const sourceAxisYawDelta = wrappedAngle(THREE, sourceAxisDesiredHeading - sourceAxisCurrentHeading);
  anchor.rotation.y += sourceAxisYawDelta;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  const rotatedSourceHeadingRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);`;

if (!source.includes(absoluteHeadingBlock)) {
  throw new Error(`${sourcePath}: decoded-heading parent block is unavailable for physical source-axis alignment`);
}
source = source.replace(absoluteHeadingBlock, axisAlignedHeadingBlock);

const relocationTail = `  anchor.position.x += sourceRotundaTarget.x - rotatedSourceHeadingRotundaCenter.x;
  anchor.position.z += sourceRotundaTarget.z - rotatedSourceHeadingRotundaCenter.z;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  fixedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);`;

const relocationWithAxisProof = `  anchor.position.x += sourceRotundaTarget.x - rotatedSourceHeadingRotundaCenter.x;
  anchor.position.z += sourceRotundaTarget.z - rotatedSourceHeadingRotundaCenter.z;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const sourceAxisRotundaAfter = objectCenterInFleet(THREE, fleet, rotunda);
  const sourceAxisTunnelAfter = objectCenterInFleet(THREE, fleet, tunnelA);
  const sourceAxisBridgeDirectionAfter = sourceAxisTunnelAfter.clone().sub(sourceAxisRotundaAfter).setY(0);
  if (sourceAxisBridgeDirectionAfter.lengthSq() < 0.25) {
    throw new Error("A1 final supplied Rotunda-to-Tunnel-A source axis is degenerate");
  }
  sourceAxisBridgeDirectionAfter.normalize();
  const sourceAxisAlignmentCosine = sourceAxisBridgeDirectionAfter.dot(decodedSourceBridgeDirection);
  if (!(sourceAxisAlignmentCosine >= 0.999)) {
    throw new Error(\`A1 complete-parent bridge axis does not match decoded KPHX heading: cosine=\${sourceAxisAlignmentCosine}; yawDelta=\${sourceAxisYawDelta}\`);
  }
  group.userData.uploadedJetwayA1SourceAxisAlignmentAuthority = "${marker}";
  group.userData.uploadedJetwayA1SourceAxisAlignmentCosine = sourceAxisAlignmentCosine;
  group.userData.uploadedJetwayA1SourceAxisYawDeltaRadians = sourceAxisYawDelta;

  fixedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);`;

if (!source.includes(relocationTail)) {
  throw new Error(`${sourcePath}: Rotunda-preserving relocation tail is unavailable for source-axis proof`);
}
source = source.replace(relocationTail, relocationWithAxisProof);

for (const required of [
  marker,
  "const decodedSourceBridgeDirection",
  "const sourceAxisBridgeDirectionBefore",
  "const sourceAxisYawDelta",
  "anchor.rotation.y += sourceAxisYawDelta",
  "const sourceAxisAlignmentCosine",
  "sourceAxisAlignmentCosine >= 0.999",
  "uploadedJetwayA1SourceAxisAlignmentAuthority",
  "uploadedJetwayA1SourceAxisAlignmentCosine",
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: source-axis alignment output is missing ${required}`);
}
for (const forbidden of [
  "bridgePivot.attach(root)",
  "UploadedAirportJetwayA1AircraftSidePivot",
]) {
  if (source.includes(forbidden)) throw new Error(`${sourcePath}: destructive child-pivot behavior survived source-axis alignment: ${forbidden}`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log("Aligned the intact supplied A1 Rotunda-to-Tunnel-A physical axis to the decoded KPHX source heading, preserved the measured Rotunda position, and left every child transform untouched.");
