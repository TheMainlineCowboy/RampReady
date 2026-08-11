import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const AUTHORITY = "a1-aircraft-target-follows-intact-parent-relocation-v1";
let source = fs.readFileSync(sourcePath, "utf8");

const legacyTargetBlock = `  const targetPoint = new THREE.Vector3(Number(placement.targetX), fixedRotundaCenter.y, Number(placement.targetZ));
  if (![targetPoint.x, targetPoint.z].every(Number.isFinite)) throw new Error("A1 source parking door target is missing");
  const targetDirection = targetPoint.clone().sub(fixedRotundaCenter);
  targetDirection.y = 0;
  const targetDistance = targetDirection.length();
  if (!(targetDistance > 15 && targetDistance < 45)) throw new Error(\`A1 source door target distance is invalid: \${targetDistance}\`);
  targetDirection.normalize();`;

const relocatedTargetBlock = `  // ${AUTHORITY}
  // placement.targetX/targetZ are authored in the original BGL model-origin
  // frame. The intact supplied A1 parent has already been translated so its
  // Rotunda stays on the measured real Terminal 4 wall after the decoded KPHX
  // heading is applied. Move the aircraft/door target by that exact same model-
  // origin translation; never move the airport or Rotunda back toward the old
  // aircraft stop to make the bridge fit.
  const rawTargetX = Number(placement.targetX);
  const rawTargetZ = Number(placement.targetZ);
  if (![rawTargetX, rawTargetZ].every(Number.isFinite)) throw new Error("A1 source parking door target is missing");
  const sourceModelOriginRelocationX = anchor.position.x - rawBglPlacementX;
  const sourceModelOriginRelocationZ = anchor.position.z - rawBglPlacementZ;
  const sourceModelOriginRelocationMeters = Math.hypot(sourceModelOriginRelocationX, sourceModelOriginRelocationZ);
  if (![sourceModelOriginRelocationX, sourceModelOriginRelocationZ, sourceModelOriginRelocationMeters].every(Number.isFinite)
    || sourceModelOriginRelocationMeters > 30) {
    throw new Error(\`A1 intact-parent model-origin relocation is invalid: x=\${sourceModelOriginRelocationX}, z=\${sourceModelOriginRelocationZ}, distance=\${sourceModelOriginRelocationMeters}\`);
  }
  const targetPoint = new THREE.Vector3(
    rawTargetX + sourceModelOriginRelocationX,
    fixedRotundaCenter.y,
    rawTargetZ + sourceModelOriginRelocationZ,
  );
  const rawTargetOffsetFromModelOrigin = Math.hypot(rawTargetX - rawBglPlacementX, rawTargetZ - rawBglPlacementZ);
  const relocatedTargetOffsetFromModelOrigin = Math.hypot(targetPoint.x - anchor.position.x, targetPoint.z - anchor.position.z);
  const aircraftTargetFrameErrorMeters = Math.abs(rawTargetOffsetFromModelOrigin - relocatedTargetOffsetFromModelOrigin);
  if (aircraftTargetFrameErrorMeters > 0.002) {
    throw new Error(\`A1 aircraft target did not preserve its source model-origin offset after relocation: \${aircraftTargetFrameErrorMeters}\`);
  }
  const targetDirection = targetPoint.clone().sub(fixedRotundaCenter);
  targetDirection.y = 0;
  const targetDistance = targetDirection.length();
  if (!(targetDistance > 15 && targetDistance < 45)) throw new Error(\`A1 relocated source door target distance is invalid: \${targetDistance}\`);
  targetDirection.normalize();`;

if (!source.includes(AUTHORITY)) {
  if (!source.includes(legacyTargetBlock)) {
    throw new Error(`${sourcePath}: direct raw-BGL A1 aircraft target block is missing; refusing to guess a coordinate-frame rewrite`);
  }
  source = source.replace(legacyTargetBlock, relocatedTargetBlock);
}

const telemetryAnchor = "  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = SOURCE_REGISTERED_A1_ELBOW_AUTHORITY;";
if (!source.includes("uploadedJetwayA1AircraftTargetRelocationAuthority")) {
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${sourcePath}: A1 source-locked telemetry anchor is missing`);
  }
  source = source.replace(
    telemetryAnchor,
    `  group.userData.uploadedJetwayA1AircraftTargetRelocationAuthority = "${AUTHORITY}";
  group.userData.uploadedJetwayA1AircraftTargetRelocationX = sourceModelOriginRelocationX;
  group.userData.uploadedJetwayA1AircraftTargetRelocationZ = sourceModelOriginRelocationZ;
  group.userData.uploadedJetwayA1AircraftTargetRelocationMeters = sourceModelOriginRelocationMeters;
  group.userData.uploadedJetwayA1AircraftTargetFrameErrorMeters = aircraftTargetFrameErrorMeters;
  group.userData.uploadedJetwayA1RelocatedDoorTargetDistanceMeters = targetDistance;
  ${telemetryAnchor}`,
  );
}

for (const required of [
  AUTHORITY,
  "const sourceModelOriginRelocationX = anchor.position.x - rawBglPlacementX;",
  "rawTargetX + sourceModelOriginRelocationX",
  "aircraftTargetFrameErrorMeters",
  "A1 relocated source door target distance is invalid",
  "uploadedJetwayA1AircraftTargetRelocationAuthority",
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: relocated A1 aircraft target output is missing ${required}`);
}
if (source.includes("const targetPoint = new THREE.Vector3(Number(placement.targetX), fixedRotundaCenter.y, Number(placement.targetZ));")) {
  throw new Error(`${sourcePath}: raw source-space A1 door target survived after the jetway parent was relocated`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log("Prepared A1 aircraft target in the same translated model-origin frame as the intact real-wall jetway parent; the terminal and Rotunda remain fixed.");
