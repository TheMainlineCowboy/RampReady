import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-fixed-aircraft-exact-authored-door-runtime-v1";
const doorAuthority = "exact-authored-crj-forward-left-door-component-v1";
const poseAuthority = "fixed-current-a1-aircraft-pose-exact-authored-door-v1";
const fixedPose = Object.freeze({ x: -3.822373, y: -0.002196, z: 10.253820, yaw: 0.008570 });
// Jetway hood contact is measured against the center of the authored passenger-door
// opening. The door component's lower bounds edge (1.802860) is not the hood aim.
const doorLocal = Object.freeze({ x: -1.291842, y: 2.769294, z: 2.240745 });

let source = fs.readFileSync(path, "utf8");
if (!source.includes("a1-service-stair-live-rendered-crj-clearance-v4")) {
  throw new Error(`${path}: fixed-aircraft finalization must run after the live service-stair stage`);
}

source = source
  .replace("const A1_INSPECTION_NOSE_GEAR_X = 12.353412;", `const A1_INSPECTION_NOSE_GEAR_X = ${fixedPose.x};`)
  .replace("const A1_INSPECTION_NOSE_GEAR_Z = -12.486888;", `const A1_INSPECTION_NOSE_GEAR_Z = ${fixedPose.z};`)
  .replace("const A1_INSPECTION_AIRCRAFT_YAW = (0.491 * Math.PI) / 180;", `const A1_INSPECTION_AIRCRAFT_YAW = ${fixedPose.yaw};`)
  .replace(/const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "[^"]+";/, `const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${poseAuthority}";`);

if (!source.includes("const A1_INSPECTION_NOSE_GEAR_Y =")) {
  const zNeedle = `const A1_INSPECTION_NOSE_GEAR_Z = ${fixedPose.z};`;
  if (!source.includes(zNeedle)) throw new Error(`${path}: fixed Z pose anchor is missing`);
  source = source.replace(zNeedle, `${zNeedle}\nconst A1_INSPECTION_NOSE_GEAR_Y = ${fixedPose.y};`);
}
source = source.replaceAll("storedResetAircraftPose?.y ?? 0", "storedResetAircraftPose?.y ?? A1_INSPECTION_NOSE_GEAR_Y");
source = source.replaceAll("storedToggleAircraftPose?.y ?? 0", "storedToggleAircraftPose?.y ?? A1_INSPECTION_NOSE_GEAR_Y");

const oldDoorLocal = `          const authoredDoorLocal = new THREE.Vector3(\n            -1.262,\n            3,\n            3.9,\n          );`;
const newDoorLocal = `          // ${marker}\n          // ${doorAuthority}\n          // Exact committed crj700-user.glb forward-left passenger-door component:\n          // exterior skin X, door-opening contact-center Y, and component longitudinal Z.\n          const authoredDoorLocal = new THREE.Vector3(\n            ${doorLocal.x},\n            ${doorLocal.y},\n            ${doorLocal.z},\n          );\n          // Establish the fixed A1 aircraft pose before any jetway-contact proof.\n          // This pose is not solved from the Cab; the bridge must reach the plane.\n          sim.aircraft.position.set(\n            A1_INSPECTION_NOSE_GEAR_X,\n            A1_INSPECTION_NOSE_GEAR_Y,\n            A1_INSPECTION_NOSE_GEAR_Z,\n          );\n          sim.aircraft.rotation.y = A1_INSPECTION_AIRCRAFT_YAW;\n          sim.aircraft.updateMatrixWorld(true);\n          renderedAircraft.updateMatrixWorld(true);`;
if (!source.includes(marker)) {
  if (!source.includes(oldDoorLocal)) throw new Error(`${path}: stale authored-door local point is missing`);
  source = source.replace(oldDoorLocal, newDoorLocal);
}

const measureStartToken = "          const measureVisibleAirframeDoor = () => {";
const measureEndToken = "          const visibleDoorBefore = measureVisibleAirframeDoor();";
const measureStart = source.indexOf(measureStartToken);
const measureEnd = source.indexOf(measureEndToken, measureStart);
if (measureStart < 0 || measureEnd < 0) throw new Error(`${path}: visible-door measurement function boundaries are missing`);
const exactMeasure = `          const measureVisibleAirframeDoor = () => {\n            sim.aircraft.updateMatrixWorld(true);\n            renderedAircraft.updateWorldMatrix(true, true);\n            const exactDoorWorld = renderedAircraft.localToWorld(authoredDoorLocal.clone());\n            const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);\n            if (renderedBounds.isEmpty() || ![exactDoorWorld.x, exactDoorWorld.y, exactDoorWorld.z].every(Number.isFinite)) {\n              throw new Error("A1 exact authored CRJ door component could not be transformed into world space");\n            }\n            const corners = [\n              [renderedBounds.min.x, renderedBounds.min.z],\n              [renderedBounds.min.x, renderedBounds.max.z],\n              [renderedBounds.max.x, renderedBounds.min.z],\n              [renderedBounds.max.x, renderedBounds.max.z],\n            ];\n            const minimumApronClearanceMeters = Math.min(...corners.map(([x, z]) => (\n              (x - measuredWallX) * apronNormalX + (z - measuredWallZ) * apronNormalZ\n            )));\n            return {\n              point: exactDoorWorld,\n              minimumApronClearanceMeters,\n              sampleCount: 1,\n              authority: "${doorAuthority}",\n            };\n          };\n`;
source = source.slice(0, measureStart) + exactMeasure + source.slice(measureEnd);

const firstMoveStartToken = "          const aircraftRelocationWorld = new THREE.Vector3(";
const firstMoveEndToken = "          const visibleDoorAfter = measureVisibleAirframeDoor();";
const firstMoveStart = source.indexOf(firstMoveStartToken);
const firstMoveEnd = source.indexOf(firstMoveEndToken, firstMoveStart);
if (firstMoveStart < 0 || firstMoveEnd < 0) throw new Error(`${path}: first aircraft-to-Cab relocation block is missing`);
const noFirstMove = `          const aircraftRelocationWorld = new THREE.Vector3(\n            exactA1CabContactX - visibleDoorBefore.point.x,\n            0,\n            exactA1CabContactZ - visibleDoorBefore.point.z,\n          );\n          const fixedAircraftDoorHorizontalErrorMeters = Math.hypot(\n            aircraftRelocationWorld.x, aircraftRelocationWorld.z,\n          );\n          if (!Number.isFinite(fixedAircraftDoorHorizontalErrorMeters) || fixedAircraftDoorHorizontalErrorMeters > 0.08) {\n            throw new Error(\`A1 jetway missed the fixed exact authored CRJ door before final contact: \${fixedAircraftDoorHorizontalErrorMeters} m\`);\n          }\n          if (!Number.isFinite(landingGearContactBefore.minimumY) || Math.abs(landingGearContactBefore.minimumY) > 0.02) {\n            throw new Error(\`Fixed A1 aircraft is not grounded at its authored tire footprint: \${landingGearContactBefore.minimumY} m\`);\n          }\n          const aircraftRelocationX = 0;\n          const aircraftRelocationY = 0;\n          const aircraftRelocationZ = 0;\n          // grounded-a1-training-pose-before-inspection-registration-v1\n          const trainingAircraftPoseBeforeInspectionRegistration = {\n            x: sim.aircraft.position.x,\n            y: sim.aircraft.position.y,\n            z: sim.aircraft.position.z,\n            yaw: sim.aircraft.rotation.y,\n          };\n          // The aircraft is intentionally not translated.\n          sim.aircraft.updateMatrixWorld(true);\n          renderedAircraft.updateMatrixWorld(true);\n`;
source = source.slice(0, firstMoveStart) + noFirstMove + source.slice(firstMoveEnd);

const secondMoveStartToken = "          const requiredWorldDoorDelta = new THREE.Vector3(";
const secondMoveEndToken = "          const renderedDoorAtSourceGate = measureVisibleAirframeDoor().point;";
const secondMoveStart = source.indexOf(secondMoveStartToken);
const secondMoveEnd = source.indexOf(secondMoveEndToken, secondMoveStart);
if (secondMoveStart < 0 || secondMoveEnd < 0) throw new Error(`${path}: final live-Cab aircraft relocation block is missing`);
const noSecondMove = `          const requiredWorldDoorDelta = new THREE.Vector3(\n            sourceGateDoorTargetWorldX - renderedDoorBeforeSourceGate.x,\n            0,\n            sourceGateDoorTargetWorldZ - renderedDoorBeforeSourceGate.z,\n          );\n          const fixedFinalDoorHorizontalErrorMeters = Math.hypot(\n            requiredWorldDoorDelta.x, requiredWorldDoorDelta.z,\n          );\n          if (!Number.isFinite(fixedFinalDoorHorizontalErrorMeters) || fixedFinalDoorHorizontalErrorMeters > 0.08) {\n            throw new Error(\`A1 FINAL live Cab missed the fixed exact authored CRJ door by \${fixedFinalDoorHorizontalErrorMeters} m\`);\n          }\n          const requiredParentLocalDelta = new THREE.Vector3(0, 0, 0);\n          // Do not move the aircraft to the Cab. The supplied bridge owns the fit.\n          sim.aircraft.updateMatrixWorld(true);\n          renderedAircraft.updateWorldMatrix(true, true);\n\n`;
source = source.slice(0, secondMoveStart) + noSecondMove + source.slice(secondMoveEnd);

source = source
  .replaceAll('"final-live-cab-mesh-visible-door-registration-v7"', `"${poseAuthority}"`)
  .replaceAll('"a1-fixed-aircraft-calibrated-to-attached-live-cab-v1"', '"a1-fixed-aircraft-exact-door-jetway-fit-v1"')
  .replaceAll('"visible-airframe-forward-left-door-registration-v1"', `"${doorAuthority}"`);

// The old labels implied that a Cab calibration was allowed to move the plane.
source = source.replaceAll(
  "Register the actual rendered forward-left door of the loaded authored\n        // CRJ directly to the measured final aircraft-facing end of the supplied\n        // Cab mesh.",
  "Measure the actual rendered forward-left door of the loaded authored\n        // CRJ at its fixed A1 pose and require the supplied Cab mesh to reach it.",
);

for (const required of [
  marker,
  doorAuthority,
  poseAuthority,
  `const A1_INSPECTION_NOSE_GEAR_X = ${fixedPose.x};`,
  `const A1_INSPECTION_NOSE_GEAR_Y = ${fixedPose.y};`,
  `const A1_INSPECTION_NOSE_GEAR_Z = ${fixedPose.z};`,
  `const A1_INSPECTION_AIRCRAFT_YAW = ${fixedPose.yaw};`,
  `${doorLocal.x}`,
  `${doorLocal.y}`,
  `${doorLocal.z}`,
  "fixedAircraftDoorHorizontalErrorMeters > 0.08",
  "fixedFinalDoorHorizontalErrorMeters > 0.08",
  "const aircraftRelocationX = 0;",
  "const requiredParentLocalDelta = new THREE.Vector3(0, 0, 0);",
]) {
  if (!source.includes(required)) throw new Error(`${path}: fixed-aircraft exact-door runtime is missing ${required}`);
}
for (const forbidden of [
  "maximumForwardProjection - 7.32",
  "centerlineLeftProjection + 1.34",
  "sim.aircraft.position.x += aircraftRelocationX",
  "sim.aircraft.position.y += aircraftRelocationY",
  "sim.aircraft.position.z += aircraftRelocationZ",
  "sim.aircraft.position.x += requiredParentLocalDelta.x",
  "sim.aircraft.position.z += requiredParentLocalDelta.z",
  "const authoredDoorLocal = new THREE.Vector3(\n            -1.262,\n            3,\n            3.9,",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: aircraft-to-jetway cheating survived finalization: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: CRJ stays fixed at [${fixedPose.x}, ${fixedPose.y}, ${fixedPose.z}] yaw=${fixedPose.yaw}; runtime measures the exact authored forward-left door contact center at local [${doorLocal.x}, ${doorLocal.y}, ${doorLocal.z}] and fails unless the supplied jetway reaches it.`);
