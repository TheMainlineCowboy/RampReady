import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

function replaceOnce(before, after, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${trainerPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

replaceOnce(
  "const clamp = (value, min, max) => Math.max(min, Math.min(max, value));",
  `const INSPECTION_PRESETS = Object.freeze({
  // Each chase camera is placed on the apron side of its tug and looks back
  // toward the actual source jetway/terminal position instead of across an
  // empty taxiway. Positions remain source-gate apron locations.
  a1: Object.freeze({ id: "a1", label: "A1 ramp", x: 0, z: 0, yaw: 0, cameraYaw: 0.92, cameraDistance: 25 }),
  // A true side-on architectural view of the measured A1 rotunda-to-T4_WALK
  // corridor. The tug remains freely drivable and the driver/overhead views
  // remain available, while chase mode starts by looking directly at the joint
  // rather than hiding it behind the rotunda.
  a1Connection: Object.freeze({
    id: "a1Connection",
    label: "A1 terminal connection",
    x: -14,
    z: -4,
    yaw: 0,
    cameraYaw: 0,
    cameraDistance: 22,
    cameraPosition: Object.freeze([-25.59, 7.4, 5.5]),
    cameraTarget: Object.freeze([-25.59, 4.2, -16.15]),
  }),
  a14: Object.freeze({ id: "a14", label: "A concourse midpoint", x: 218.45, z: -86.52, yaw: 2.88, cameraYaw: 2.19, cameraDistance: 32 }),
  b14: Object.freeze({ id: "b14", label: "B concourse midpoint", x: 216.4, z: 150.35, yaw: 2.8, cameraYaw: 2.10, cameraDistance: 32 }),
  // B15 sits on the east face of the north-south pier. The former inspection
  // pose faced south toward the distant main concourse and could not verify the
  // B15L/B15M terminal portals. This pose is on the actual B15 apron, 21.85 m
  // east of the facade, and points the operator view directly west at both gates.
  b15: Object.freeze({ id: "b15", label: "B15 ramp", x: -5.5, z: 539.2, yaw: -1.5708, cameraYaw: 1.38, cameraDistance: 25 }),
});
const INSPECTION_ROUTE_AUTHORITY = "source-gate-apron-presets-with-side-on-a1-connection-a1-a14-b14-b15-v4";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));`,
  "const INSPECTION_PRESETS = Object.freeze",
  "inspection preset constants",
);

replaceOnce(
  "  const inspectionRef = useRef(false);",
  `  const inspectionRef = useRef(false);
  const inspectionPresetRef = useRef("a1");`,
  "const inspectionPresetRef = useRef",
  "inspection preset ref",
);

replaceOnce(
  '  const [inspectionMode, setInspectionMode] = useState(false);',
  `  const [inspectionMode, setInspectionMode] = useState(false);
  const [inspectionPreset, setInspectionPreset] = useState("a1");`,
  "const [inspectionPreset, setInspectionPreset]",
  "inspection preset state",
);

replaceOnce(
  "  useEffect(() => { cameraRef.current = cameraMode; }, [cameraMode]);",
  `  useEffect(() => { cameraRef.current = cameraMode; }, [cameraMode]);
  useEffect(() => { inspectionPresetRef.current = inspectionPreset; }, [inspectionPreset]);`,
  "inspectionPresetRef.current = inspectionPreset",
  "inspection preset state sync",
);

replaceOnce(
  "  const toggleInspectionDrive = useCallback(() => {",
  `  const moveInspectionToPreset = useCallback((presetId) => {
    const preset = INSPECTION_PRESETS[presetId] || INSPECTION_PRESETS.a1;
    inspectionPresetRef.current = preset.id;
    setInspectionPreset(preset.id);
    const sim = simRef.current;
    if (!sim) return;
    sim.connection = createConnectionState();
    sim.dynamics = createPushbackState({
      tugX: preset.x,
      tugZ: preset.z,
      tugYaw: preset.yaw,
      aircraftX: sim.aircraft.position.x,
      aircraftZ: sim.aircraft.position.z,
      aircraftYaw: sim.aircraft.rotation.y,
    });
    sim.rig.root.position.set(preset.x, 0, preset.z);
    sim.rig.root.rotation.y = preset.yaw;
    sim.rig.setSteering(0);
    sim.rig.setLiftProgress(0);
    driveRef.current = { throttle: 0, steer: 0, brake: false, direction: 1 };
    orbitRef.current.yaw = preset.cameraYaw;
    orbitRef.current.pitch = 0.38;
    orbitRef.current.distance = preset.cameraDistance || 30;
    scoreRef.current = 100;
    setThrottle(0);
    setDirection("FWD");
    setCameraMode("chase");
    const canvas = sim.renderer.domElement;
    canvas.dataset.inspectionPreset = preset.id;
    canvas.dataset.inspectionPresetLabel = preset.label;
    canvas.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;
    canvas.dataset.inspectionTugX = preset.x.toFixed(3);
    canvas.dataset.inspectionTugZ = preset.z.toFixed(3);
    canvas.dataset.cameraYaw = preset.cameraYaw.toFixed(4);
    canvas.dataset.cameraPitch = orbitRef.current.pitch.toFixed(4);
    canvas.dataset.cameraDistance = orbitRef.current.distance.toFixed(3);
    canvas.dataset.inspectionCameraAuthority = preset.cameraPosition
      ? "side-on-fixed-a1-terminal-joint-v4"
      : "free-orbit-follow-tug";
    setMessage(\`Inspection position: \${preset.label}. Drive freely with W/S or the power slider and use A/D to steer.\`);
  }, []);

  const toggleInspectionDrive = useCallback(() => {`,
  "const moveInspectionToPreset = useCallback",
  "inspection preset movement callback",
);

replaceOnce(
  `      } else {
        const orbit = orbitRef.current;
        cameraTarget.set(target.x, 1.3, target.z + (connectionHasAircraft(sim.connection) ? 0 : 2.5));
        const horizontal = Math.cos(orbit.pitch) * orbit.distance;
        desiredCamera.set(
          cameraTarget.x + Math.sin(orbit.yaw) * horizontal,
          cameraTarget.y + Math.sin(orbit.pitch) * orbit.distance,
          cameraTarget.z + Math.cos(orbit.yaw) * horizontal,
        );
        camera.position.lerp(desiredCamera, 0.16);
        camera.lookAt(cameraTarget);
      }`,
  `      } else {
        const inspectionPresetConfig = inspectionActive
          ? INSPECTION_PRESETS[inspectionPresetRef.current]
          : null;
        if (inspectionPresetConfig?.cameraPosition && inspectionPresetConfig?.cameraTarget) {
          desiredCamera.fromArray(inspectionPresetConfig.cameraPosition);
          cameraTarget.fromArray(inspectionPresetConfig.cameraTarget);
          camera.position.lerp(desiredCamera, 0.16);
          camera.lookAt(cameraTarget);
        } else {
          const orbit = orbitRef.current;
          cameraTarget.set(target.x, 1.3, target.z + (connectionHasAircraft(sim.connection) ? 0 : 2.5));
          const horizontal = Math.cos(orbit.pitch) * orbit.distance;
          desiredCamera.set(
            cameraTarget.x + Math.sin(orbit.yaw) * horizontal,
            cameraTarget.y + Math.sin(orbit.pitch) * orbit.distance,
            cameraTarget.z + Math.cos(orbit.yaw) * horizontal,
          );
          camera.position.lerp(desiredCamera, 0.16);
          camera.lookAt(cameraTarget);
        }
      }`,
  "side-on-fixed-a1-terminal-joint-v4",
  "side-on A1 connection chase framing",
);

replaceOnce(
  '      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";',
  `      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";
      sim.renderer.domElement.dataset.inspectionPreset = next ? "a1" : "training";
      sim.renderer.domElement.dataset.inspectionPresetLabel = next ? INSPECTION_PRESETS.a1.label : "Training";
      sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;`,
  'sim.renderer.domElement.dataset.inspectionPreset = next ? "a1" : "training"',
  "inspection route runtime evidence",
);

replaceOnce(
  '    setCameraMode("chase");\n    setMessage(next',
  `    setCameraMode("chase");
    inspectionPresetRef.current = "a1";
    setInspectionPreset("a1");
    setMessage(next`,
  'setInspectionPreset("a1")',
  "inspection default preset",
);

replaceOnce(
  '    renderer.domElement.dataset.inspectionMode = inspectionRef.current ? "active" : "training";',
  `    renderer.domElement.dataset.inspectionMode = inspectionRef.current ? "active" : "training";
    renderer.domElement.dataset.inspectionPreset = inspectionRef.current ? inspectionPresetRef.current : "training";
    renderer.domElement.dataset.inspectionPresetLabel = inspectionRef.current
      ? (INSPECTION_PRESETS[inspectionPresetRef.current] || INSPECTION_PRESETS.a1).label
      : "Training";
    renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;`,
  "renderer.domElement.dataset.inspectionPreset = inspectionRef.current ? inspectionPresetRef.current",
  "initial inspection route evidence",
);

replaceOnce(
  `          >{inspectionMode ? "Return to training" : "Free-drive inspection"}</button>
          <select className="rr-view-select"`,
  `          >{inspectionMode ? "Return to training" : "Free-drive inspection"}</button>
          {inspectionMode && <select
            className="rr-view-select rr-inspection-location"
            value={inspectionPreset}
            onChange={(event) => moveInspectionToPreset(event.target.value)}
            aria-label="Inspection location"
          >
            {Object.values(INSPECTION_PRESETS).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>}
          <select className="rr-view-select"`,
  'aria-label="Inspection location"',
  "inspection location selector",
);

replaceOnce(
  'return <div className="rr-shell" data-equipment-id={equipmentId} data-inspection-mode={inspectionMode ? "active" : "training"}>',
  'return <div className="rr-shell" data-equipment-id={equipmentId} data-inspection-mode={inspectionMode ? "active" : "training"} data-inspection-preset={inspectionMode ? inspectionPreset : "training"}>',
  "data-inspection-preset={inspectionMode ? inspectionPreset",
  "inspection shell preset",
);

for (const token of [
  "const INSPECTION_PRESETS = Object.freeze",
  "source-gate-apron-presets-with-side-on-a1-connection-a1-a14-b14-b15-v4",
  'cameraPosition: Object.freeze([-25.59, 7.4, 5.5])',
  'cameraTarget: Object.freeze([-25.59, 4.2, -16.15])',
  "side-on-fixed-a1-terminal-joint-v4",
  "inspectionPresetConfig?.cameraPosition && inspectionPresetConfig?.cameraTarget",
  "const moveInspectionToPreset = useCallback",
  'aria-label="Inspection location"',
  "dataset.inspectionPreset = preset.id",
  'sim.renderer.domElement.dataset.inspectionPreset = next ? "a1" : "training"',
  "renderer.domElement.dataset.inspectionPreset = inspectionRef.current ? inspectionPresetRef.current",
  "sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY",
  "renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY",
  "data-inspection-preset={inspectionMode ? inspectionPreset",
  "x: -5.5, z: 539.2, yaw: -1.5708",
  "orbitRef.current.distance = preset.cameraDistance || 30",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: completed full-airport inspection route is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared full-airport free-drive inspection presets from a side-on A1 terminal-joint view through B15, while keeping every position freely drivable.");
