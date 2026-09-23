import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const gatePoseImport = 'import { KPHX_T4_GATE_POSE_SOURCE, getKphxTerminal4GatePoseByRampWedObjectId } from "../environment/kphxFullAirport/terminal4GatePoseAuthority.js";';
const sourceAuthorityImport = 'import { KPHX_FULL_AIRPORT_SOURCE, kphxXPlaneHeadingToRampReadyYawRadians } from "../environment/kphxFullAirport/sourceAuthority.js";';
const exactMarker = "same-a1-wed-gate-pose-equipment-spawn-v1";

if (!source.includes(gatePoseImport)) {
  if (!source.includes(sourceAuthorityImport)) throw new Error("A1 exact gate-pose source-authority import anchor is missing");
  source = source.replace(sourceAuthorityImport, `${sourceAuthorityImport}\n${gatePoseImport}`);
}

const legacyHeadingBlock = `const NOSE_START_Z = 6.2;
const STOP_Z = 52;
const A1_AIRCRAFT_HEADING_AUTHORITY = "KPHX-1.75.1-earth.wed.xml-WED_RampPosition-27855";
const A1_SOURCE_HEADING_DEGREES = KPHX_FULL_AIRPORT_SOURCE.anchor.headingDegrees;
const A1_AIRCRAFT_YAW_RADIANS = kphxXPlaneHeadingToRampReadyYawRadians(A1_SOURCE_HEADING_DEGREES);`;

const exactPoseBlock = `const A1_GATE_POSE = getKphxTerminal4GatePoseByRampWedObjectId(KPHX_FULL_AIRPORT_SOURCE.anchor.wedObjectId);
if (!A1_GATE_POSE || A1_GATE_POSE.gate !== "A1") throw new Error("Exact KPHX A1 WED ramp-position pose is missing");
const A1_AIRCRAFT_START_X = A1_GATE_POSE.runtimePosition[0];
const NOSE_START_Z = A1_GATE_POSE.runtimePosition[2];
const STOP_Z = 52;
const A1_AIRCRAFT_HEADING_AUTHORITY = "KPHX-1.75.1-earth.wed.xml-WED_RampPosition-27855";
const A1_SOURCE_HEADING_DEGREES = A1_GATE_POSE.sourceHeadingDegrees;
const A1_AIRCRAFT_YAW_RADIANS = A1_GATE_POSE.runtimeYawRadians;
const A1_EQUIPMENT_APPROACH_OFFSET_METERS = 6.2;
const A1_EQUIPMENT_SPAWN_AUTHORITY = "same-a1-wed-gate-pose-equipment-spawn-v1";
const A1_EQUIPMENT_SPAWN = Object.freeze({
  x: A1_AIRCRAFT_START_X - Math.sin(A1_AIRCRAFT_YAW_RADIANS) * A1_EQUIPMENT_APPROACH_OFFSET_METERS,
  z: NOSE_START_Z - Math.cos(A1_AIRCRAFT_YAW_RADIANS) * A1_EQUIPMENT_APPROACH_OFFSET_METERS,
  yaw: A1_AIRCRAFT_YAW_RADIANS,
});
function createA1SpawnPushbackState() {
  return createPushbackState({
    tugX: A1_EQUIPMENT_SPAWN.x,
    tugZ: A1_EQUIPMENT_SPAWN.z,
    tugYaw: A1_EQUIPMENT_SPAWN.yaw,
    aircraftX: A1_AIRCRAFT_START_X,
    aircraftZ: NOSE_START_Z,
    aircraftYaw: A1_AIRCRAFT_YAW_RADIANS,
  });
}`;

if (!source.includes("const A1_GATE_POSE = getKphxTerminal4GatePoseByRampWedObjectId")) {
  if (!source.includes(legacyHeadingBlock)) throw new Error("A1 heading block is missing before exact gate-pose enforcement");
  source = source.replace(legacyHeadingBlock, exactPoseBlock);
} else if (!source.includes(`A1_EQUIPMENT_SPAWN_AUTHORITY = "${exactMarker}"`)) {
  source = source.replace(
    "const A1_EQUIPMENT_APPROACH_OFFSET_METERS = 6.2;",
    `const A1_EQUIPMENT_APPROACH_OFFSET_METERS = 6.2;\nconst A1_EQUIPMENT_SPAWN_AUTHORITY = "${exactMarker}";`,
  );
}

source = source.replace(
  'a1: Object.freeze({ id: "a1", label: "A1 ramp", x: 0, z: 0, yaw: 0, cameraYaw: 0.92, cameraDistance: 25 }),',
  'a1: Object.freeze({ id: "a1", label: "A1 ramp", x: A1_EQUIPMENT_SPAWN.x, z: A1_EQUIPMENT_SPAWN.z, yaw: A1_EQUIPMENT_SPAWN.yaw, cameraYaw: 0.92, cameraDistance: 25 }),',
);

const resetLegacy = `    sim.connection = createConnectionState();
    sim.dynamics = createPushbackState();
    sim.rig.root.position.set(0, 0, 0);
    sim.rig.root.rotation.y = 0;
    sim.rig.setSteering(0);
    sim.rig.setLiftProgress(0);
    sim.aircraft.position.set(0, 0, NOSE_START_Z);
    sim.aircraft.rotation.y = A1_AIRCRAFT_YAW_RADIANS;`;
const resetExact = `    sim.connection = createConnectionState();
    sim.dynamics = createA1SpawnPushbackState();
    sim.rig.root.position.set(A1_EQUIPMENT_SPAWN.x, 0, A1_EQUIPMENT_SPAWN.z);
    sim.rig.root.rotation.y = A1_EQUIPMENT_SPAWN.yaw;
    sim.rig.setSteering(0);
    sim.rig.setLiftProgress(0);
    sim.aircraft.position.set(A1_AIRCRAFT_START_X, 0, NOSE_START_Z);
    sim.aircraft.rotation.y = A1_AIRCRAFT_YAW_RADIANS;`;
if (source.includes(resetLegacy)) source = source.replace(resetLegacy, resetExact);

const toggleLegacy = `      sim.connection = createConnectionState();
      sim.dynamics = createPushbackState();
      sim.rig.root.position.set(0, 0, 0);
      sim.rig.root.rotation.y = 0;
      sim.rig.setSteering(0);
      sim.rig.setLiftProgress(0);
      sim.aircraft.position.set(0, 0, NOSE_START_Z);
      sim.aircraft.rotation.y = A1_AIRCRAFT_YAW_RADIANS;`;
const toggleExact = `      sim.connection = createConnectionState();
      sim.dynamics = createA1SpawnPushbackState();
      sim.rig.root.position.set(A1_EQUIPMENT_SPAWN.x, 0, A1_EQUIPMENT_SPAWN.z);
      sim.rig.root.rotation.y = A1_EQUIPMENT_SPAWN.yaw;
      sim.rig.setSteering(0);
      sim.rig.setLiftProgress(0);
      sim.aircraft.position.set(A1_AIRCRAFT_START_X, 0, NOSE_START_Z);
      sim.aircraft.rotation.y = A1_AIRCRAFT_YAW_RADIANS;`;
if (source.includes(toggleLegacy)) source = source.replace(toggleLegacy, toggleExact);

source = source.replace(
  `    const rig = createProceduralLektroRig(THREE, equipmentId);
    rig.root.userData.equipmentId = equipmentId;`,
  `    const rig = createProceduralLektroRig(THREE, equipmentId);
    rig.root.position.set(A1_EQUIPMENT_SPAWN.x, 0, A1_EQUIPMENT_SPAWN.z);
    rig.root.rotation.y = A1_EQUIPMENT_SPAWN.yaw;
    rig.root.userData.equipmentId = equipmentId;`,
);

source = source.replace(
  `    const aircraft = buildCRJ700Aircraft(THREE, material, cylinder);
    aircraft.position.set(0, 0, NOSE_START_Z);
    aircraft.rotation.y = A1_AIRCRAFT_YAW_RADIANS;`,
  `    const aircraft = buildCRJ700Aircraft(THREE, material, cylinder);
    aircraft.position.set(A1_AIRCRAFT_START_X, 0, NOSE_START_Z);
    aircraft.rotation.y = A1_AIRCRAFT_YAW_RADIANS;`,
);

source = source.replace(
  "const sim = { renderer, scene, camera, environment, rig, aircraft, connection: createConnectionState(), dynamics: createPushbackState(), last: performance.now(), lastHud: 0 };",
  "const sim = { renderer, scene, camera, environment, rig, aircraft, connection: createConnectionState(), dynamics: createA1SpawnPushbackState(), last: performance.now(), lastHud: 0 };",
);

const canvasAnchor = '    canvas.dataset.a1AircraftModelForwardAxis = "-Z";';
if (source.includes(canvasAnchor) && !source.includes("dataset.a1EquipmentSpawnAuthority")) {
  source = source.replace(
    canvasAnchor,
    `${canvasAnchor}
    canvas.dataset.kphxT4SupportedRampPositionCount = String(KPHX_T4_GATE_POSE_SOURCE.supportedRampPositionCount);
    canvas.dataset.kphxT4SupportedGateNameCount = String(KPHX_T4_GATE_POSE_SOURCE.supportedGateNameCount);
    canvas.dataset.a1EquipmentSpawnAuthority = A1_EQUIPMENT_SPAWN_AUTHORITY;
    canvas.dataset.a1EquipmentSpawnX = A1_EQUIPMENT_SPAWN.x.toFixed(6);
    canvas.dataset.a1EquipmentSpawnZ = A1_EQUIPMENT_SPAWN.z.toFixed(6);
    canvas.dataset.a1EquipmentSpawnYawDegrees = THREE.MathUtils.radToDeg(A1_EQUIPMENT_SPAWN.yaw).toFixed(2);
    canvas.dataset.a1EquipmentApproachOffsetMeters = A1_EQUIPMENT_APPROACH_OFFSET_METERS.toFixed(3);`,
  );
}

for (const required of [
  gatePoseImport,
  exactMarker,
  "const A1_GATE_POSE = getKphxTerminal4GatePoseByRampWedObjectId",
  "const A1_SOURCE_HEADING_DEGREES = A1_GATE_POSE.sourceHeadingDegrees",
  "const A1_AIRCRAFT_YAW_RADIANS = A1_GATE_POSE.runtimeYawRadians",
  "createA1SpawnPushbackState()",
  "sim.rig.root.position.set(A1_EQUIPMENT_SPAWN.x, 0, A1_EQUIPMENT_SPAWN.z);",
  "sim.rig.root.rotation.y = A1_EQUIPMENT_SPAWN.yaw;",
  "sim.aircraft.position.set(A1_AIRCRAFT_START_X, 0, NOSE_START_Z);",
  "aircraft.position.set(A1_AIRCRAFT_START_X, 0, NOSE_START_Z);",
  "dynamics: createA1SpawnPushbackState()",
]) {
  if (!source.includes(required)) throw new Error(`A1 exact gate-pose enforcement missing: ${required}`);
}

for (const forbidden of [
  "sim.rig.root.position.set(0, 0, 0);",
  "sim.rig.root.rotation.y = 0;",
  "sim.aircraft.position.set(0, 0, NOSE_START_Z);",
]) {
  if (source.includes(forbidden)) throw new Error(`Stale A1 zero-pose reset survived: ${forbidden}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Enforced exact KPHX A1 WED gate pose for aircraft and all equipment spawn/reset paths.");
