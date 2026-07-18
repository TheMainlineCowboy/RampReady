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

function normalizeApprovedRoute(source) {
  let normalized = source;
  for (const [legacy, physical] of replacements) normalized = normalized.replaceAll(legacy, physical);
  return normalized;
}

function normalizeAttachment(source) {
  const searchFrom = source.indexOf("const { cradle, capture } = captureState;");
  const start = source.indexOf("      if (sim.connected) {", searchFrom);
  const end = source.indexOf("\n\n      const towActive", start);
  if (searchFrom < 0 || start < 0 || end < 0) throw new Error("unable to isolate connected towing block");
  return `${source.slice(0, start)}      /* APPROVED_ARTICULATED_TOW_BLOCK */${source.slice(end)}`;
}

function normalizeHistoryResets(source) {
  return source
    .replace(
      /sim\.connected = true;\n(?:    sim\.lastAttachedNose = null;\n)?(?:    sim\.mainGearCenter = null;\n)?/g,
      "sim.connected = true;\n    /* APPROVED_CONNECTION_HISTORY_RESET */\n",
    )
    .replace(
      /sim\.connected = false;\n(?:    sim\.lastAttachedNose = null;\n)?(?:    sim\.mainGearCenter = null;\n)?/g,
      "sim.connected = false;\n    /* APPROVED_DISCONNECTION_HISTORY_RESET */\n",
    );
}

let normalizedPrepared;
let normalizedTracked;
try {
  normalizedPrepared = normalizeHistoryResets(normalizeAttachment(normalizeApprovedRoute(prepared)));
  normalizedTracked = normalizeHistoryResets(normalizeAttachment(normalizeApprovedRoute(tracked)));
} catch (error) {
  console.error(`RampReady transform-scope verification failed: ${error.message}`);
  process.exit(1);
}

const requiredPreparedMarkers = [
  "sim.mainGearCenter = new THREE.Vector3(",
  "const desiredAircraftYaw = Math.atan2(axleX / axleDistance, axleZ / axleDistance);",
  "nextAircraftYaw = sim.tug.rotation.y + boundedArticulation;",
  "attachedNoseX + Math.sin(nextAircraftYaw) * 11.2",
  "attachedNoseZ + Math.cos(nextAircraftYaw) * 11.2",
];
for (const marker of requiredPreparedMarkers) {
  if (!prepared.includes(marker)) {
    console.error(`RampReady transform-scope verification failed: prepared runtime is missing ${marker}`);
    process.exit(1);
  }
}
if (prepared.includes("const requestedYawStep = lateralNoseTravel / 11.2;")) {
  console.error("RampReady transform-scope verification failed: obsolete direct tug-following yaw implementation remains.");
  process.exit(1);
}

if (normalizedPrepared !== normalizedTracked) {
  let firstDifference = 0;
  const limit = Math.min(normalizedPrepared.length, normalizedTracked.length);
  while (firstDifference < limit && normalizedPrepared[firstDifference] === normalizedTracked[firstDifference]) firstDifference += 1;
  const line = normalizedTracked.slice(0, firstDifference).split("\n").length;
  console.error(`RampReady transform-scope verification failed: prepared runtime differs outside approved route, attachment, and history transformations near line ${line}.`);
  process.exit(1);
}

console.log("RampReady runtime transform scope verified: only approved route values, attachment-history resets, and main-gear articulated towing replace tracked source.");
