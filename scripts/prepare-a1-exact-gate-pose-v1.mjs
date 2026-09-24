import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const sourceAuthorityImport =
  'import { KPHX_FULL_AIRPORT_SOURCE, kphxXPlaneHeadingToRampReadyYawRadians } from "../environment/kphxFullAirport/sourceAuthority.js";';
const gatePoseImport =
  'import { KPHX_T4_GATE_POSE_SOURCE } from "../environment/kphxFullAirport/terminal4GatePoseAuthority.js";';
const dockingImport =
  'import { createA1AircraftDockingScenarioPose } from "../environment/kphxFullAirport/a1AircraftDockingAuthority.js";';
const exactMarker = "a1-wed-104804-node-104811-plus-xplane-crj-acf-autogate-door-v1";

if (!source.includes(sourceAuthorityImport)) {
  throw new Error("A1 exact source-authority import anchor is missing");
}

for (const oldImport of [
  'import { KPHX_T4_GATE_POSE_SOURCE, createKphxTerminal4GateScenarioPose } from "../environment/kphxFullAirport/terminal4GatePoseAuthority.js";',
  'import { KPHX_T4_GATE_POSE_SOURCE, getKphxTerminal4GatePoseByRampWedObjectId } from "../environment/kphxFullAirport/terminal4GatePoseAuthority.js";',
]) {
  if (source.includes(oldImport)) source = source.replace(oldImport, gatePoseImport);
}
if (!source.includes(gatePoseImport)) {
  source = source.replace(sourceAuthorityImport, `${sourceAuthorityImport}\n${gatePoseImport}`);
}
if (!source.includes(dockingImport)) {
  source = source.replace(gatePoseImport, `${gatePoseImport}\n${dockingImport}`);
}

const exactScenarioBlock = `const A1_AIRCRAFT_TYPE = "CRJ900";
const A1_SCENARIO_POSE = createA1AircraftDockingScenarioPose(
  A1_AIRCRAFT_TYPE,
  { equipmentApproachOffsetMeters: 6.2 },
);
if (A1_SCENARIO_POSE.gate !== "A1") throw new Error("Exact KPHX A1 ACF/WED docking scenario pose is missing");
const A1_AIRCRAFT_START_X = A1_SCENARIO_POSE.aircraft.x;
const NOSE_START_Z = A1_SCENARIO_POSE.aircraft.z;
const STOP_Z = 52;
const A1_AIRCRAFT_HEADING_AUTHORITY = "KPHX-1.75.1-earth.wed.xml-WED_RampPosition-27855";
const A1_SOURCE_HEADING_DEGREES = A1_SCENARIO_POSE.sourceHeadingDegrees;
const A1_AIRCRAFT_YAW_RADIANS = A1_SCENARIO_POSE.aircraft.yaw;
const A1_EQUIPMENT_APPROACH_OFFSET_METERS = A1_SCENARIO_POSE.equipmentApproachOffsetMeters;
const A1_EQUIPMENT_SPAWN_AUTHORITY = A1_SCENARIO_POSE.authority;
const A1_EQUIPMENT_SPAWN = A1_SCENARIO_POSE.equipment;
`;

const scenarioEnd = source.indexOf("function createA1SpawnPushbackState()");
if (scenarioEnd < 0) throw new Error("A1 spawn-state function is missing");
const starts = [
  source.indexOf("const A1_AIRCRAFT_TYPE ="),
  source.indexOf("const A1_SCENARIO_POSE ="),
  source.indexOf("const A1_GATE_POSE ="),
  source.indexOf("const NOSE_START_Z = 6.2;"),
].filter((value) => value >= 0 && value < scenarioEnd);
if (!starts.length) throw new Error("A1 scenario source block is missing before exact docking enforcement");
const scenarioStart = Math.min(...starts);
source = source.slice(0, scenarioStart) + exactScenarioBlock + source.slice(scenarioEnd);

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

source = source.replace(
  'const profile = getRampReadyAircraftDoorProfile("CRJ700");',
  "const profile = getRampReadyAircraftDoorProfile(A1_AIRCRAFT_TYPE);",
);
source = source.replace(
  `const contact = a1JetwayController.registerAircraftDoorContact({
            targetWorld,
            outwardWorldDirection,
          });`,
  `const contact = a1JetwayController.registerAircraftDoorContact({
            targetWorld,
            outwardWorldDirection,
            aircraftType: A1_AIRCRAFT_TYPE,
          });`,
);

const canvasAnchor = '    canvas.dataset.a1AircraftModelForwardAxis = "-Z";';
if (source.includes(canvasAnchor) && !source.includes("dataset.a1AircraftDockingAuthority")) {
  source = source.replace(
    canvasAnchor,
    `${canvasAnchor}
    canvas.dataset.a1AircraftType = A1_AIRCRAFT_TYPE;
    canvas.dataset.a1AircraftDockingAuthority = A1_SCENARIO_POSE.authority;
    canvas.dataset.a1AircraftSourceAcf = A1_SCENARIO_POSE.sourceAcf;
    canvas.dataset.a1JetwayCabinEndWedNodeId = String(A1_SCENARIO_POSE.aircraftSideCabinEndWedNodeId);
    canvas.dataset.a1DoorTargetWorld =
      [A1_SCENARIO_POSE.doorTarget.x, A1_SCENARIO_POSE.doorTarget.y, A1_SCENARIO_POSE.doorTarget.z]
        .map((value) => value.toFixed(6)).join(",");
    canvas.dataset.a1SourceRampToDockedShiftMeters =
      A1_SCENARIO_POSE.sourceRampToDockedShift.distance.toFixed(6);
    canvas.dataset.a1XPlaneAutoGateLatMeters = A1_SCENARIO_POSE.autoGateLatMeters.toFixed(6);
    canvas.dataset.a1XPlaneAutoGateVertMeters = A1_SCENARIO_POSE.autoGateVertMeters.toFixed(6);
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
  dockingImport,
  exactMarker,
  'const A1_AIRCRAFT_TYPE = "CRJ900"',
  "const A1_SCENARIO_POSE = createA1AircraftDockingScenarioPose",
  "const A1_SOURCE_HEADING_DEGREES = A1_SCENARIO_POSE.sourceHeadingDegrees",
  "const A1_AIRCRAFT_YAW_RADIANS = A1_SCENARIO_POSE.aircraft.yaw",
  "createA1SpawnPushbackState()",
  "sim.rig.root.position.set(A1_EQUIPMENT_SPAWN.x, 0, A1_EQUIPMENT_SPAWN.z);",
  "sim.rig.root.rotation.y = A1_EQUIPMENT_SPAWN.yaw;",
  "sim.aircraft.position.set(A1_AIRCRAFT_START_X, 0, NOSE_START_Z);",
  "aircraft.position.set(A1_AIRCRAFT_START_X, 0, NOSE_START_Z);",
  "dynamics: createA1SpawnPushbackState()",
  "getRampReadyAircraftDoorProfile(A1_AIRCRAFT_TYPE)",
]) {
  if (!source.includes(required)) throw new Error(`A1 exact ACF/WED docking enforcement missing: ${required}`);
}

for (const forbidden of [
  "sim.rig.root.position.set(0, 0, 0);",
  "sim.rig.root.rotation.y = 0;",
  "sim.aircraft.position.set(0, 0, NOSE_START_Z);",
  "createKphxTerminal4GateScenarioPose(",
]) {
  if (source.includes(forbidden)) throw new Error(`Stale A1 generic/zero-pose logic survived: ${forbidden}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Enforced exact KPHX A1 WED cabin-end + X-Plane CRJ ACF dock-port pose for aircraft and equipment.");
