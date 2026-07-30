import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainer.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

function replaceOnce(oldText, newText, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(oldText)) throw new Error(`Inspection-drive preparation anchor is missing for ${label}`);
  source = source.replace(oldText, newText);
}

replaceOnce(
  '  const cameraRef = useRef("chase");',
  '  const cameraRef = useRef("chase");\n  const inspectionRef = useRef(false);',
  "const inspectionRef = useRef(false)",
  "inspection state ref",
);

replaceOnce(
  '  const [cameraMode, setCameraMode] = useState("chase");',
  '  const [cameraMode, setCameraMode] = useState("chase");\n  const [inspectionMode, setInspectionMode] = useState(false);',
  "const [inspectionMode, setInspectionMode]",
  "inspection React state",
);

replaceOnce(
  '  useEffect(() => { cameraRef.current = cameraMode; }, [cameraMode]);',
  `  useEffect(() => { cameraRef.current = cameraMode; }, [cameraMode]);
  useEffect(() => {
    inspectionRef.current = inspectionMode;
    const canvas = simRef.current?.renderer?.domElement;
    if (canvas) canvas.dataset.inspectionMode = inspectionMode ? "active" : "training";
  }, [inspectionMode]);`,
  "canvas.dataset.inspectionMode = inspectionMode",
  "inspection runtime evidence",
);

replaceOnce(
  `    setDirection("FWD");
    setMessage("Complete the equipment check, then approach at idle speed.");
  }, []);`,
  `    setDirection("FWD");
    setMessage(inspectionRef.current
      ? "Free-drive inspection reset at A1. Use the tug to inspect any part of the airport."
      : "Complete the equipment check, then approach at idle speed.");
  }, []);

  const toggleInspectionDrive = useCallback(() => {
    const next = !inspectionRef.current;
    inspectionRef.current = next;
    setInspectionMode(next);
    const sim = simRef.current;
    if (sim) {
      sim.connection = createConnectionState();
      sim.dynamics = createPushbackState();
      sim.rig.root.position.set(0, 0, 0);
      sim.rig.root.rotation.y = 0;
      sim.rig.setSteering(0);
      sim.rig.setLiftProgress(0);
      sim.aircraft.position.set(0, 0, NOSE_START_Z);
      sim.aircraft.rotation.y = 0;
      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";
    }
    driveRef.current = { throttle: 0, steer: 0, brake: false, direction: 1 };
    orbitRef.current.yaw = -0.64;
    orbitRef.current.pitch = 0.38;
    orbitRef.current.distance = next ? 20 : 16;
    scoreRef.current = 100;
    stageRef.current = 0;
    setStage(0);
    setThrottle(0);
    setDirection("FWD");
    setCameraMode("chase");
    setMessage(next
      ? "Free-drive airport inspection active. Procedure gates are disabled; drive anywhere and use the camera views to inspect scenery."
      : "Training mode restored. Complete the equipment check, then approach at idle speed.");
  }, []);`,
  "const toggleInspectionDrive = useCallback",
  "inspection toggle callback",
);

replaceOnce(
  `  const advance = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;`,
  `  const advance = useCallback(() => {
    const sim = simRef.current;
    if (!sim || inspectionRef.current) return;`,
  "if (!sim || inspectionRef.current) return;",
  "advance inspection guard",
);

replaceOnce(
  `  const capture = useCallback(() => {
    const sim = simRef.current;
    if (!sim || stageRef.current !== 1) return;`,
  `  const capture = useCallback(() => {
    const sim = simRef.current;
    if (!sim || inspectionRef.current || stageRef.current !== 1) return;`,
  "if (!sim || inspectionRef.current || stageRef.current !== 1)",
  "capture inspection guard",
);

replaceOnce(
  `  const lower = useCallback(() => {
    const sim = simRef.current;
    if (!sim || stageRef.current !== 6) return;`,
  `  const lower = useCallback(() => {
    const sim = simRef.current;
    if (!sim || inspectionRef.current || stageRef.current !== 6) return;`,
  "if (!sim || inspectionRef.current || stageRef.current !== 6)",
  "lower inspection guard",
);

replaceOnce(
  '    renderer.domElement.dataset.equipmentId = equipmentId;',
  '    renderer.domElement.dataset.equipmentId = equipmentId;\n    renderer.domElement.dataset.inspectionMode = inspectionRef.current ? "active" : "training";',
  "renderer.domElement.dataset.inspectionMode = inspectionRef.current",
  "initial inspection dataset",
);

replaceOnce(
  `      const before = connectionMetrics(sim);
      const clearDistance = Math.hypot(rig.root.position.x - aircraft.position.x, rig.root.position.z - aircraft.position.z);
      sim.connection = stepConnection(sim.connection, { metrics: before, speed: sim.dynamics.speed, clearDistance }, dt);`,
  `      const inspectionActive = inspectionRef.current;
      const before = connectionMetrics(sim);
      const clearDistance = Math.hypot(rig.root.position.x - aircraft.position.x, rig.root.position.z - aircraft.position.z);
      if (inspectionActive) {
        if (sim.connection.phase !== CONNECTION_PHASES.APPROACH) sim.connection = createConnectionState();
      } else {
        sim.connection = stepConnection(sim.connection, { metrics: before, speed: sim.dynamics.speed, clearDistance }, dt);
      }`,
  "const inspectionActive = inspectionRef.current",
  "inspection connection bypass",
);

for (const [oldText, newText, marker, label] of [
  [
    "      if (stageRef.current === 2 && sim.connection.phase === CONNECTION_PHASES.SECURED) {",
    "      if (!inspectionActive && stageRef.current === 2 && sim.connection.phase === CONNECTION_PHASES.SECURED) {",
    "if (!inspectionActive && stageRef.current === 2",
    "secured stage guard",
  ],
  [
    "      if (stageRef.current === 6 && sim.connection.phase === CONNECTION_PHASES.RELEASED) {",
    "      if (!inspectionActive && stageRef.current === 6 && sim.connection.phase === CONNECTION_PHASES.RELEASED) {",
    "if (!inspectionActive && stageRef.current === 6",
    "released stage guard",
  ],
  [
    "      if (stageRef.current === 7 && sim.connection.phase === CONNECTION_PHASES.CLEAR) {",
    "      if (!inspectionActive && stageRef.current === 7 && sim.connection.phase === CONNECTION_PHASES.CLEAR) {",
    "if (!inspectionActive && stageRef.current === 7",
    "clear stage guard",
  ],
  [
    "      const motionAllowed = connectionAllowsMotion(sim.connection) && ![3, 4, 8].includes(stageRef.current);",
    "      const motionAllowed = inspectionActive || (connectionAllowsMotion(sim.connection) && ![3, 4, 8].includes(stageRef.current));",
    "const motionAllowed = inspectionActive ||",
    "inspection motion bypass",
  ],
  [
    "      const towing = sim.connection.phase === CONNECTION_PHASES.TOWING;",
    "      const towing = !inspectionActive && sim.connection.phase === CONNECTION_PHASES.TOWING;",
    "const towing = !inspectionActive",
    "inspection towing isolation",
  ],
  [
    "      const target = connectionHasAircraft(sim.connection) ? aircraft.position : rig.root.position;",
    "      const target = inspectionActive ? rig.root.position : connectionHasAircraft(sim.connection) ? aircraft.position : rig.root.position;",
    "const target = inspectionActive ? rig.root.position",
    "inspection camera target",
  ],
  [
    "          phase: sim.connection.phase,",
    '          phase: inspectionActive ? "inspection" : sim.connection.phase,',
    'phase: inspectionActive ? "inspection"',
    "inspection HUD phase",
  ],
]) replaceOnce(oldText, newText, marker, label);

replaceOnce(
  `          <div className="rr-kicker">Step {stage + 1} / {STAGES.length}</div>
          <h1>{STAGES[stage]}</h1>`,
  `          <div className="rr-kicker">{inspectionMode ? "Free drive" : \`Step \${stage + 1} / \${STAGES.length}\`}</div>
          <h1>{inspectionMode ? "Airport inspection mode" : STAGES[stage]}</h1>`,
  'inspectionMode ? "Airport inspection mode"',
  "inspection header",
);

replaceOnce(
  `            <div className="rr-session-menu-popover">
              <button type="button" onClick={onChangeEquipment}>Change equipment</button>`,
  `            <div className="rr-session-menu-popover">
              <button type="button" aria-pressed={inspectionMode} onClick={toggleInspectionDrive}>{inspectionMode ? "Return to training" : "Free-drive inspection"}</button>
              <button type="button" onClick={onChangeEquipment}>Change equipment</button>`,
  "Free-drive inspection",
  "inspection menu action",
);

for (const [oldText, newText, marker, label] of [
  [
    "        {[0, 3, 4].includes(stage) && <button className=\"rr-primary\" onClick={advance}",
    "        {!inspectionMode && [0, 3, 4].includes(stage) && <button className=\"rr-primary\" onClick={advance}",
    "!inspectionMode && [0, 3, 4].includes(stage)",
    "inspection primary action suppression",
  ],
  [
    "        {stage === 1 && <button className={hud.ready ? \"rr-primary\" : \"rr-primary rr-disabled\"}",
    "        {!inspectionMode && stage === 1 && <button className={hud.ready ? \"rr-primary\" : \"rr-primary rr-disabled\"}",
    "!inspectionMode && stage === 1",
    "inspection capture action suppression",
  ],
  [
    "        {stage === 6 && <button className=\"rr-primary\" onClick={lower}",
    "        {!inspectionMode && stage === 6 && <button className=\"rr-primary\" onClick={lower}",
    "!inspectionMode && stage === 6",
    "inspection lower action suppression",
  ],
]) replaceOnce(oldText, newText, marker, label);

replaceOnce(
  '    <aside className="rr-score-float">Score <b>{hud.score}</b><span>{hud.warning ? "JACKKNIFE" : "Stable"}</span></aside>',
  '    <aside className="rr-score-float">{inspectionMode ? <>Inspection <b>FREE</b><span>Airport drive</span></> : <>Score <b>{hud.score}</b><span>{hud.warning ? "JACKKNIFE" : "Stable"}</span></>}</aside>',
  "Inspection <b>FREE</b>",
  "inspection score panel",
);

for (const token of [
  "const inspectionRef = useRef(false)",
  "const [inspectionMode, setInspectionMode]",
  "const toggleInspectionDrive = useCallback",
  "const inspectionActive = inspectionRef.current",
  "const motionAllowed = inspectionActive ||",
  "Free-drive airport inspection active",
  "Free-drive inspection",
  'phase: inspectionActive ? "inspection"',
  "Inspection <b>FREE</b>",
]) {
  if (!source.includes(token)) throw new Error(`Prepared inspection drive is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared RampReady free-drive airport inspection mode with unrestricted tug motion and isolated training state.");
