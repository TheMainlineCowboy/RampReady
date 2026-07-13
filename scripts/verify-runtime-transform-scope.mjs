import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const repositoryPath = "src/components/RampReadyTrainerStable.jsx";
const prepared = await readFile(trainerPath, "utf8");

let tracked;
try {
  ({ stdout: tracked } = await execFileAsync("git", ["show", `HEAD:${repositoryPath}`], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  }));
} catch (error) {
  console.error("RampReady transform-scope verification failed: unable to read the tracked trainer from git HEAD.");
  console.error(error.message);
  process.exit(1);
}

const replacements = [
  ["const signedDirection = connectedPushPhase ? 1 : drive.direction;", "const signedDirection = drive.direction;"],
  ["if (Math.abs(sim.velocity) < 0.01) sim.velocity = 0;", "if (Math.abs(sim.velocity) < 0.01 && usefulThrottle === 0) sim.velocity = 0;"],
  ["const STOP_Z = -39.6;", "const STOP_Z = 52;"],
  ["stop: NOSE_START_Z - STOP_Z", "stop: STOP_Z - NOSE_START_Z"],
  ["const stopRemaining = sim.aircraft.position.z - STOP_Z;", "const stopRemaining = STOP_Z - sim.aircraft.position.z;"],
  ["if (towActive && sim.aircraft.position.z <= STOP_Z + 0.5) {", "if (towActive && sim.aircraft.position.z >= STOP_Z - 0.5) {"],
  ["new THREE.PlaneGeometry(90, 120)", "new THREE.PlaneGeometry(90, 140)"],
  ["ramp.position.z = 28;", "ramp.position.z = 18;"],
  ["new THREE.PlaneGeometry(0.16, 86)", "new THREE.PlaneGeometry(0.16, 130)"],
  ["center.position.set(0, 0.018, 28);", "center.position.set(0, 0.018, 18);"],
];

const legacyAttachment = `if (sim.connected) {
        const towOffset = (sim.towOffsetLocal || new THREE.Vector3()).clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);
        sim.aircraft.position.x = cradle.x + towOffset.x;
        sim.aircraft.position.z = cradle.z + towOffset.z;
        sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));
      }`;
const preparedAttachment = `if (sim.connected) {
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

let expected = tracked;
const failures = [];
for (const [legacy, physical] of replacements) {
  const legacyCount = expected.split(legacy).length - 1;
  const physicalCount = expected.split(physical).length - 1;
  if (legacyCount === 1 && physicalCount === 0) expected = expected.replace(legacy, physical);
  else if (!(legacyCount === 0 && physicalCount === 1)) failures.push(`ambiguous approved replacement: legacy=${legacyCount}, physical=${physicalCount}, marker=${physical}`);
}

const legacyAttachmentCount = expected.split(legacyAttachment).length - 1;
const preparedAttachmentCount = expected.split(preparedAttachment).length - 1;
if (legacyAttachmentCount === 1 && preparedAttachmentCount === 0) expected = expected.replace(legacyAttachment, preparedAttachment);
else if (!(legacyAttachmentCount === 0 && preparedAttachmentCount === 1)) failures.push(`ambiguous attachment replacement: legacy=${legacyAttachmentCount}, prepared=${preparedAttachmentCount}`);

const connectedLine = "sim.connected = true;";
const connectedReset = "sim.connected = true;\n    sim.lastAttachedNose = null;";
if (!expected.includes(connectedReset)) expected = expected.replace(connectedLine, connectedReset);

const disconnectedLine = "sim.connected = false;";
const disconnectedReset = "sim.connected = false;\n    sim.lastAttachedNose = null;";
if ((expected.split(disconnectedReset).length - 1) === 0) expected = expected.replaceAll(disconnectedLine, disconnectedReset);

if (failures.length) {
  console.error("RampReady transform-scope verification failed before comparison:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

if (prepared !== expected) {
  let firstDifference = 0;
  const limit = Math.min(prepared.length, expected.length);
  while (firstDifference < limit && prepared[firstDifference] === expected[firstDifference]) firstDifference += 1;
  const line = expected.slice(0, firstDifference).split("\n").length;
  console.error(`RampReady transform-scope verification failed: prepared runtime differs from the approved transformation at approximately line ${line}.`);
  process.exit(1);
}

console.log("RampReady runtime transform scope verified: the prepared trainer differs from git HEAD only by the approved route, throttle, capture, attachment-history, and towing-kinematics transformations.");
