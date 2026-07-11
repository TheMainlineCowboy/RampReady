import { appendFile, readFile, rename, rm, writeFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const tempPath = new URL("../src/components/.RampReadyTrainerStable.jsx.tmp", import.meta.url);
const source = await readFile(trainerPath, "utf8");
const legacyDirectionLine = "const signedDirection = connectedPushPhase ? 1 : drive.direction;";
const physicalDirectionLine = "const signedDirection = drive.direction;";
const legacyVelocityFloorLine = "if (Math.abs(sim.velocity) < 0.01) sim.velocity = 0;";
const responsiveVelocityFloorLine = "if (Math.abs(sim.velocity) < 0.01 && usefulThrottle === 0) sim.velocity = 0;";
const legacyStopLine = "const STOP_Z = 52;";
const physicalStopLine = "const STOP_Z = -39.6;";
const legacyHudDistance = "stop: STOP_Z - NOSE_START_Z";
const physicalHudDistance = "stop: NOSE_START_Z - STOP_Z";
const legacyRemainingLine = "const stopRemaining = STOP_Z - sim.aircraft.position.z;";
const physicalRemainingLine = "const stopRemaining = sim.aircraft.position.z - STOP_Z;";
const legacyCompletionLine = "if (towActive && sim.aircraft.position.z >= STOP_Z - 0.5) {";
const physicalCompletionLine = "if (towActive && sim.aircraft.position.z <= STOP_Z + 0.5) {";
const connectedLine = "sim.connected = true;";
const connectedResetBlock = `sim.connected = true;
    sim.lastAttachedNose = null;`;
const disconnectedLine = "sim.connected = false;";
const disconnectedResetBlock = `sim.connected = false;
    sim.lastAttachedNose = null;`;
const legacyAttachmentBlock = `if (sim.connected) {
        const towOffset = (sim.towOffsetLocal || new THREE.Vector3()).clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);
        sim.aircraft.position.x = cradle.x + towOffset.x;
        sim.aircraft.position.z = cradle.z + towOffset.z;
        sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));
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

const preparedAttachmentCount = count(prepared, preparedAttachmentBlock);
const legacyAttachmentCount = count(prepared, legacyAttachmentBlock);
if (preparedAttachmentCount === 0) {
  if (legacyAttachmentCount !== 1) {
    console.error(`RampReady runtime preparation failed: expected one connected attachment implementation, found prepared=${preparedAttachmentCount}, legacy=${legacyAttachmentCount}.`);
    process.exit(1);
  }
  prepared = prepared.replace(legacyAttachmentBlock, preparedAttachmentBlock);
} else if (preparedAttachmentCount !== 1 || legacyAttachmentCount !== 0) {
  console.error(`RampReady runtime preparation failed: ambiguous attachment implementation, found prepared=${preparedAttachmentCount}, legacy=${legacyAttachmentCount}.`);
  process.exit(1);
}

if (!prepared.includes(connectedResetBlock)) {
  if (count(prepared, connectedLine) !== 1) {
    console.error(`RampReady runtime preparation failed: expected one connection transition, found ${count(prepared, connectedLine)}.`);
    process.exit(1);
  }
  prepared = prepared.replace(connectedLine, connectedResetBlock);
}

const disconnectCount = count(prepared, disconnectedLine);
const disconnectResetCount = count(prepared, disconnectedResetBlock);
if (disconnectResetCount === 0) {
  if (disconnectCount !== 2) {
    console.error(`RampReady runtime preparation failed: expected reset and release disconnection transitions, found ${disconnectCount}.`);
    process.exit(1);
  }
  prepared = prepared.replaceAll(disconnectedLine, disconnectedResetBlock);
} else if (disconnectResetCount !== 2 || disconnectCount !== 2) {
  console.error(`RampReady runtime preparation failed: ambiguous disconnection history resets, found reset=${disconnectResetCount}, total=${disconnectCount}.`);
  process.exit(1);
}

const requiredPreparedLines = [physicalDirectionLine, responsiveVelocityFloorLine, physicalStopLine, physicalHudDistance, physicalRemainingLine, physicalCompletionLine];
const forbiddenLegacyLines = [legacyDirectionLine, legacyVelocityFloorLine, legacyStopLine, legacyHudDistance, legacyRemainingLine, legacyCompletionLine];
if (requiredPreparedLines.some((line) => count(prepared, line) !== 1) || count(prepared, preparedAttachmentBlock) !== 1 || count(prepared, connectedResetBlock) !== 1 || count(prepared, disconnectedResetBlock) !== 2 || forbiddenLegacyLines.some((line) => prepared.includes(line)) || prepared.includes(legacyAttachmentBlock)) {
  console.error("RampReady runtime preparation failed: runtime transformations did not produce one clean implementation.");
  process.exit(1);
}

if (prepared === source) {
  await reportRuntimeSourceState("tracked implementation", "Verified towing behavior and reverse-route geometry are committed directly in RampReadyTrainerStable.jsx; no source rewrite was required.");
  console.log("RampReady runtime preparation passed: reverse route, reverse travel, frame-rate-stable partial throttle, bounded capture correction, wheelbase-constrained towing, articulation protection, and clean attachment history already present.");
  process.exit(0);
}

await reportRuntimeSourceState("build-time transformation required", "The tracked trainer still contains legacy towing or route code. The build is using a temporary verified rewrite and is not yet the final source architecture.");

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

console.log("RampReady runtime preparation applied and verified reverse route, reverse travel, frame-rate-stable partial throttle, bounded capture correction, wheelbase-constrained towing, articulation protection, and clean attachment history.");