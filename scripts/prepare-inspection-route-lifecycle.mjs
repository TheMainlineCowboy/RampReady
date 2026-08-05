import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

function replaceRequired(before, after, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${trainerPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

replaceRequired(
  "const NOSE_START_Z = 6.2;",
  `const NOSE_START_Z = 6.2;
// Photo registration moves the complete A1 jetway/aircraft set 17.565 m from
// the original source stop toward the measured terminal corner, retaining a
// 2.4 m fixed vestibule. The aircraft pose uses the identical relocation.
const A1_INSPECTION_NOSE_GEAR_X = 12.353412;
const A1_INSPECTION_NOSE_GEAR_Z = -12.486888;
// Source A1 parking heading is 270.491 degrees. The uploaded CRJ points along
// local -Z, so its Three.js yaw is parking heading minus 270 degrees.
const A1_INSPECTION_AIRCRAFT_YAW = THREE.MathUtils.degToRad(0.491);
const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "photo-registered-a1-terminal-corner-stop-v1";`,
  "A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY",
  "A1 inspection aircraft pose constants",
);

replaceRequired(
  `    sim.rig.setLiftProgress(0);
    sim.aircraft.position.set(0, 0, NOSE_START_Z);
    sim.aircraft.rotation.y = 0;
    const resetJetwayDeployment = inspectionRef.current ? 0 : 1;`,
  `    sim.rig.setLiftProgress(0);
    const resetUsesInspectionAircraftPose = inspectionRef.current;
    sim.aircraft.position.set(
      resetUsesInspectionAircraftPose ? A1_INSPECTION_NOSE_GEAR_X : 0,
      0,
      resetUsesInspectionAircraftPose ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z,
    );
    sim.aircraft.rotation.y = resetUsesInspectionAircraftPose ? A1_INSPECTION_AIRCRAFT_YAW : 0;
    const resetJetwayDeployment = inspectionRef.current ? 0 : 1;`,
  "const resetUsesInspectionAircraftPose = inspectionRef.current",
  "inspection-aware reset aircraft pose",
);

replaceRequired(
  `      sim.rig.setLiftProgress(0);
      sim.aircraft.position.set(0, 0, NOSE_START_Z);
      sim.aircraft.rotation.y = 0;
      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";`,
  `      sim.rig.setLiftProgress(0);
      sim.aircraft.position.set(
        next ? A1_INSPECTION_NOSE_GEAR_X : 0,
        0,
        next ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z,
      );
      sim.aircraft.rotation.y = next ? A1_INSPECTION_AIRCRAFT_YAW : 0;
      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";`,
  "next ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z",
  "free-drive entry aircraft pose",
);

replaceRequired(
  '      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";',
  `      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";
      sim.renderer.domElement.dataset.inspectionPreset = next ? "a1" : "training";
      sim.renderer.domElement.dataset.inspectionPresetLabel = next ? INSPECTION_PRESETS.a1.label : "Training";
      sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;
      sim.renderer.domElement.dataset.inspectionAircraftPoseAuthority = next
        ? A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY
        : "training-approach-start";
      sim.renderer.domElement.dataset.inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(3);
      sim.renderer.domElement.dataset.inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(3);
      sim.renderer.domElement.dataset.inspectionAircraftYaw = sim.aircraft.rotation.y.toFixed(6);`,
  'sim.renderer.domElement.dataset.inspectionAircraftPoseAuthority = next',
  "inspection toggle route and aircraft-pose evidence",
);

replaceRequired(
  '    renderer.domElement.dataset.inspectionMode = inspectionRef.current ? "active" : "training";',
  `    renderer.domElement.dataset.inspectionMode = inspectionRef.current ? "active" : "training";
    renderer.domElement.dataset.inspectionPreset = inspectionRef.current ? inspectionPresetRef.current : "training";
    renderer.domElement.dataset.inspectionPresetLabel = inspectionRef.current
      ? (INSPECTION_PRESETS[inspectionPresetRef.current] || INSPECTION_PRESETS.a1).label
      : "Training";
    renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;
    renderer.domElement.dataset.inspectionAircraftPoseAuthority = inspectionRef.current
      ? A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY
      : "training-approach-start";
    renderer.domElement.dataset.inspectionAircraftNoseGearX = aircraft.position.x.toFixed(3);
    renderer.domElement.dataset.inspectionAircraftNoseGearZ = aircraft.position.z.toFixed(3);
    renderer.domElement.dataset.inspectionAircraftYaw = aircraft.rotation.y.toFixed(6);`,
  "renderer.domElement.dataset.inspectionAircraftPoseAuthority = inspectionRef.current",
  "initial inspection route and aircraft-pose evidence",
);

replaceRequired(
  `      const inspectionActive = inspectionRef.current;
      const jetway = jetwayRef.current;`,
  `      const inspectionActive = inspectionRef.current;
      const liveInspectionPreset = inspectionActive
        ? (INSPECTION_PRESETS[inspectionPresetRef.current] || INSPECTION_PRESETS.a1)
        : null;
      canvas.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;
      canvas.dataset.inspectionPreset = liveInspectionPreset?.id || "training";
      canvas.dataset.inspectionPresetLabel = liveInspectionPreset?.label || "Training";
      canvas.dataset.inspectionAircraftPoseAuthority = inspectionActive
        ? A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY
        : "training-approach-start";
      canvas.dataset.inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(3);
      canvas.dataset.inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(3);
      canvas.dataset.inspectionAircraftYaw = sim.aircraft.rotation.y.toFixed(6);
      const jetway = jetwayRef.current;`,
  "canvas.dataset.inspectionAircraftPoseAuthority = inspectionActive",
  "persistent per-frame inspection route and aircraft-pose evidence",
);

for (const token of [
  "A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY",
  "A1_INSPECTION_NOSE_GEAR_X = 12.353412",
  "A1_INSPECTION_NOSE_GEAR_Z = -12.486888",
  "const resetUsesInspectionAircraftPose = inspectionRef.current",
  "next ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z",
  'sim.renderer.domElement.dataset.inspectionPreset = next ? "a1" : "training"',
  "renderer.domElement.dataset.inspectionPreset = inspectionRef.current ? inspectionPresetRef.current",
  "sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY",
  "renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY",
  "const liveInspectionPreset = inspectionActive",
  "canvas.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY",
  "canvas.dataset.inspectionAircraftPoseAuthority = inspectionActive",
  "canvas.dataset.inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(3)",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: inspection lifecycle is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared persistent inspection route evidence and photo-registered the uploaded CRJ nose gear at the corrected A1 terminal-corner stop and heading while preserving the separate training approach pose.");
