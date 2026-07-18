import { appendFile, readFile, rename, rm, writeFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const tempPath = new URL("../src/components/.RampReadyTrainerStable.jsx.tmp", import.meta.url);
const source = await readFile(trainerPath, "utf8");
const legacyDirectionLine = "const signedDirection = connectedPushPhase ? 1 : drive.direction;";
const physicalDirectionLine = "const signedDirection = drive.direction;";
const legacyVelocityFloorLine = "if (Math.abs(sim.velocity) < 0.01) sim.velocity = 0;";
const responsiveVelocityFloorLine = "if (Math.abs(sim.velocity) < 0.01 && usefulThrottle === 0) sim.velocity = 0;";
const legacyStopLine = "const STOP_Z = -39.6;";
const physicalStopLine = "const STOP_Z = 52;";
const legacyHudDistance = "stop: NOSE_START_Z - STOP_Z";
const physicalHudDistance = "stop: STOP_Z - NOSE_START_Z";
const legacyRemainingLine = "const stopRemaining = sim.aircraft.position.z - STOP_Z;";
const physicalRemainingLine = "const stopRemaining = STOP_Z - sim.aircraft.position.z;";
const legacyCompletionLine = "if (towActive && sim.aircraft.position.z <= STOP_Z + 0.5) {";
const physicalCompletionLine = "if (towActive && sim.aircraft.position.z >= STOP_Z - 0.5) {";
const legacyRampGeometry = "new THREE.PlaneGeometry(90, 120)";
const physicalRampGeometry = "new THREE.PlaneGeometry(90, 140)";
const legacyRampPosition = "ramp.position.z = 28;";
const physicalRampPosition = "ramp.position.z = 18;";
const legacyCenterlineGeometry = "new THREE.PlaneGeometry(0.16, 86)";
const physicalCenterlineGeometry = "new THREE.PlaneGeometry(0.16, 130)";
const legacyCenterlinePosition = "center.position.set(0, 0.018, 28);";
const physicalCenterlinePosition = "center.position.set(0, 0.018, 18);";
const connectedLine = "sim.connected = true;";
const previousConnectedResetBlock = `sim.connected = true;
    sim.lastAttachedNose = null;`;
const connectedResetBlock = `sim.connected = true;
    sim.lastAttachedNose = null;
    sim.mainGearCenter = null;`;
const disconnectedLine = "sim.connected = false;";
const previousDisconnectedResetBlock = `sim.connected = false;
    sim.lastAttachedNose = null;`;
const disconnectedResetBlock = `sim.connected = false;
    sim.lastAttachedNose = null;
    sim.mainGearCenter = null;`;
const legacyAttachmentBlock = `if (sim.connected) {
        const towOffset = (sim.towOffsetLocal || new THREE.Vector3()).clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);
        sim.aircraft.position.x = cradle.x + towOffset.x;
        sim.aircraft.position.z = cradle.z + towOffset.z;
        sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));
      }`;
const previousAttachmentBlock = `if (sim.connected) {
        if (sim.towOffsetLocal) {
          const captureOffset = sim.towOffsetLocal.length();
          const maxCaptureCorrection = 0.28 * dt;
          if (captureOffset <= maxCaptureCorrection || captureOffset < 0.002) sim.towOffsetLocal.set(0, 0, 0);
          else sim.towOffsetLocal.multiplyScalar((captureOffset - maxCaptureCorrection) / captureOffset);
        }
        const towOffset = (sim.towOffsetLocal || new THREE.Vector3()).clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);
        const attachedNoseX = cradle.x + towOffset.x;
        const attachedNoseZ = cradle.z + towOffset.z;
        if (!sim.lastAttachedNose) sim.lastAttachedNose = new THREE.Vector3(attachedNoseX, 0, attachedNoseZ);
        const noseDx = attachedNoseX - sim.lastAttachedNose.x;
        const noseDz = attachedNoseZ - sim.lastAttachedNose.z;
        const aircraftRightX = Math.cos(sim.aircraft.rotation.y);
        const aircraftRightZ = -Math.sin(sim.aircraft.rotation.y);
        const lateralNoseTravel = noseDx * aircraftRightX + noseDz * aircraftRightZ;
        const requestedYawStep = lateralNoseTravel / 11.2;
        const yawRateStep = clamp(requestedYawStep, -THREE.MathUtils.degToRad(12) * dt, THREE.MathUtils.degToRad(12) * dt);
        const articulationDelta = sim.aircraft.rotation.y - sim.tug.rotation.y;
        const currentArticulation = Math.atan2(Math.sin(articulationDelta), Math.cos(articulationDelta));
        const boundedArticulation = clamp(currentArticulation + yawRateStep, -THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(70));
        sim.aircraft.rotation.y = sim.tug.rotation.y + boundedArticulation;
        sim.aircraft.position.x = attachedNoseX;
        sim.aircraft.position.z = attachedNoseZ;
        sim.lastAttachedNose.set(attachedNoseX, 0, attachedNoseZ);
      }`;
const preparedAttachmentBlock = `if (sim.connected) {
        if (sim.towOffsetLocal) {
          const captureOffset = sim.towOffsetLocal.length();
          const maxCaptureCorrection = 0.28 * dt;
          if (captureOffset <= maxCaptureCorrection || captureOffset < 0.002) sim.towOffsetLocal.set(0, 0, 0);
          else sim.towOffsetLocal.multiplyScalar((captureOffset - maxCaptureCorrection) / captureOffset);
        }
        const towOffset = (sim.towOffsetLocal || new THREE.Vector3()).clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);
        const attachedNoseX = cradle.x + towOffset.x;
        const attachedNoseZ = cradle.z + towOffset.z;
        if (!sim.lastAttachedNose) sim.lastAttachedNose = new THREE.Vector3(attachedNoseX, 0, attachedNoseZ);
        if (!sim.mainGearCenter) {
          sim.mainGearCenter = new THREE.Vector3(
            sim.aircraft.position.x + Math.sin(sim.aircraft.rotation.y) * 11.2,
            0,
            sim.aircraft.position.z + Math.cos(sim.aircraft.rotation.y) * 11.2,
          );
        }
        let axleX = sim.mainGearCenter.x - attachedNoseX;
        let axleZ = sim.mainGearCenter.z - attachedNoseZ;
        let axleDistance = Math.hypot(axleX, axleZ);
        if (axleDistance < 0.001) {
          axleX = Math.sin(sim.aircraft.rotation.y) * 11.2;
          axleZ = Math.cos(sim.aircraft.rotation.y) * 11.2;
          axleDistance = 11.2;
        }
        const desiredAircraftYaw = Math.atan2(axleX / axleDistance, axleZ / axleDistance);
        const yawDelta = Math.atan2(
          Math.sin(desiredAircraftYaw - sim.aircraft.rotation.y),
          Math.cos(desiredAircraftYaw - sim.aircraft.rotation.y),
        );
        const yawRateStep = clamp(yawDelta, -THREE.MathUtils.degToRad(8) * dt, THREE.MathUtils.degToRad(8) * dt);
        let nextAircraftYaw = sim.aircraft.rotation.y + yawRateStep;
        const articulationDelta = nextAircraftYaw - sim.tug.rotation.y;
        const boundedArticulation = clamp(
          Math.atan2(Math.sin(articulationDelta), Math.cos(articulationDelta)),
          -THREE.MathUtils.degToRad(65),
          THREE.MathUtils.degToRad(65),
        );
        nextAircraftYaw = sim.tug.rotation.y + boundedArticulation;
        sim.aircraft.rotation.y = nextAircraftYaw;
        sim.aircraft.position.x = attachedNoseX;
        sim.aircraft.position.z = attachedNoseZ;
        sim.mainGearCenter.set(
          attachedNoseX + Math.sin(nextAircraftYaw) * 11.2,
          0,
          attachedNoseZ + Math.cos(nextAircraftYaw) * 11.2,
        );
        sim.lastAttachedNose.set(attachedNoseX, 0, attachedNoseZ);
      }`;

async function reportRuntimeSourceState(state, detail) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  await appendFile(summaryPath, `### RampReady runtime source\n- State: **${state}**\n- ${detail}\n`, "utf8");
}

const count = (value, needle) => value.split(needle).length - 1;
let prepared = source;

function replaceExactlyOne(legacy, physical, label) {
  const physicalCount = count(prepared, physical);
  const legacyCount = count(prepared, legacy);
  if (physicalCount === 0) {
    if (legacyCount !== 1) {
      console.error(`RampReady runtime preparation failed: expected one ${label} implementation, found physical=${physicalCount}, legacy=${legacyCount}.`);
      process.exit(1);
    }
    prepared = prepared.replace(legacy, physical);
  } else if (physicalCount !== 1 || legacyCount !== 0) {
    console.error(`RampReady runtime preparation failed: ambiguous ${label} implementation, found physical=${physicalCount}, legacy=${legacyCount}.`);
    process.exit(1);
  }
}

replaceExactlyOne(legacyDirectionLine, physicalDirectionLine, "direction");
replaceExactlyOne(legacyVelocityFloorLine, responsiveVelocityFloorLine, "velocity floor");
replaceExactlyOne(legacyStopLine, physicalStopLine, "reverse stop target");
replaceExactlyOne(legacyHudDistance, physicalHudDistance, "initial stop distance");
replaceExactlyOne(legacyRemainingLine, physicalRemainingLine, "remaining-distance calculation");
replaceExactlyOne(legacyCompletionLine, physicalCompletionLine, "stop completion gate");
replaceExactlyOne(legacyRampGeometry, physicalRampGeometry, "ramp length");
replaceExactlyOne(legacyRampPosition, physicalRampPosition, "ramp position");
replaceExactlyOne(legacyCenterlineGeometry, physicalCenterlineGeometry, "centerline length");
replaceExactlyOne(legacyCenterlinePosition, physicalCenterlinePosition, "centerline position");

const preparedAttachmentCount = count(prepared, preparedAttachmentBlock);
const previousAttachmentCount = count(prepared, previousAttachmentBlock);
const legacyAttachmentCount = count(prepared, legacyAttachmentBlock);
if (preparedAttachmentCount === 0) {
  if (previousAttachmentCount === 1 && legacyAttachmentCount === 0) prepared = prepared.replace(previousAttachmentBlock, preparedAttachmentBlock);
  else if (legacyAttachmentCount === 1 && previousAttachmentCount === 0) prepared = prepared.replace(legacyAttachmentBlock, preparedAttachmentBlock);
  else {
    console.error(`RampReady runtime preparation failed: expected one connected attachment implementation, found prepared=${preparedAttachmentCount}, previous=${previousAttachmentCount}, legacy=${legacyAttachmentCount}.`);
    process.exit(1);
  }
} else if (preparedAttachmentCount !== 1 || previousAttachmentCount !== 0 || legacyAttachmentCount !== 0) {
  console.error(`RampReady runtime preparation failed: ambiguous attachment implementation, found prepared=${preparedAttachmentCount}, previous=${previousAttachmentCount}, legacy=${legacyAttachmentCount}.`);
  process.exit(1);
}

if (!prepared.includes(connectedResetBlock)) {
  if (prepared.includes(previousConnectedResetBlock)) prepared = prepared.replace(previousConnectedResetBlock, connectedResetBlock);
  else if (count(prepared, connectedLine) === 1) prepared = prepared.replace(connectedLine, connectedResetBlock);
  else {
    console.error("RampReady runtime preparation failed: connection transition could not be upgraded with main-gear history reset.");
    process.exit(1);
  }
}

if (!prepared.includes(disconnectedResetBlock)) {
  if (count(prepared, previousDisconnectedResetBlock) === 2) prepared = prepared.replaceAll(previousDisconnectedResetBlock, disconnectedResetBlock);
  else if (count(prepared, disconnectedLine) === 2) prepared = prepared.replaceAll(disconnectedLine, disconnectedResetBlock);
  else {
    console.error("RampReady runtime preparation failed: disconnection transitions could not be upgraded with main-gear history reset.");
    process.exit(1);
  }
}

const requiredPreparedLines = [
  physicalDirectionLine,
  responsiveVelocityFloorLine,
  physicalStopLine,
  physicalHudDistance,
  physicalRemainingLine,
  physicalCompletionLine,
  physicalRampGeometry,
  physicalRampPosition,
  physicalCenterlineGeometry,
  physicalCenterlinePosition,
];
const forbiddenLegacyLines = [
  legacyDirectionLine,
  legacyVelocityFloorLine,
  legacyStopLine,
  legacyHudDistance,
  legacyRemainingLine,
  legacyCompletionLine,
  legacyRampGeometry,
  legacyRampPosition,
  legacyCenterlineGeometry,
  legacyCenterlinePosition,
];
if (requiredPreparedLines.some((line) => count(prepared, line) !== 1)
  || count(prepared, preparedAttachmentBlock) !== 1
  || count(prepared, connectedResetBlock) !== 1
  || count(prepared, disconnectedResetBlock) !== 2
  || forbiddenLegacyLines.some((line) => prepared.includes(line))
  || prepared.includes(previousAttachmentBlock)
  || prepared.includes(legacyAttachmentBlock)) {
  console.error("RampReady runtime preparation failed: runtime transformations did not produce one clean implementation.");
  process.exit(1);
}

if (prepared === source) {
  await reportRuntimeSourceState("tracked implementation", "Verified main-gear trailer kinematics, reverse-route geometry, and ramp coverage are committed directly; no source rewrite was required.");
  console.log("RampReady runtime preparation passed: delayed main-gear aircraft turning, opposite-sign initial yaw response, articulation protection, capture settling, and clean attachment history already present.");
  process.exit(0);
}

await reportRuntimeSourceState("build-time transformation required", "The tracked trainer was upgraded to wheelbase-constrained main-gear trailer kinematics for this verified build.");

try {
  await writeFile(tempPath, prepared, { encoding: "utf8", flag: "wx" });
  await rename(tempPath, trainerPath);
} finally {
  await rm(tempPath, { force: true });
}

const persisted = await readFile(trainerPath, "utf8");
if (persisted !== prepared) {
  console.error("RampReady runtime preparation failed: prepared trainer source did not persist exactly.");
  process.exit(1);
}

console.log("RampReady runtime preparation applied main-gear trailer kinematics: the tug controls the captured nose while the aircraft pivots around its main gear with bounded, delayed articulation.");
