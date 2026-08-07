import fs from "node:fs";

const targets = [
  "src/components/RampReadyStandupTrainerTerminal4.jsx",
];

function replaceRequired(source, anchor, replacement, path, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(anchor)) throw new Error(`${path}: inspection ${label} anchor is missing`);
  return source.replace(anchor, replacement);
}

for (const path of targets) {
  let source = fs.readFileSync(path, "utf8");

  if (!source.includes('className="rr-inspection-toggle"')) {
    const anchor = '<div className="rr-top-tools">';
    source = replaceRequired(
      source,
      anchor,
      `${anchor}\n          <button\n            className="rr-inspection-toggle"\n            type="button"\n            aria-pressed={inspectionMode}\n            onClick={toggleInspectionDrive}\n          >{inspectionMode ? "Return to training" : "Free-drive inspection"}</button>`,
      path,
      "control",
    );
  }

  source = replaceRequired(
    source,
    'return <div className="rr-shell" data-equipment-id={equipmentId}>',
    'return <div className="rr-shell" data-equipment-id={equipmentId} data-inspection-mode={inspectionMode ? "active" : "training"}>',
    path,
    "shell state",
  );

  if (!source.includes("window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__")) {
    // prepare-terminal4-runtime regenerates this trainer immediately before this
    // preparer runs. Therefore the evidence bridge must not depend on callbacks
    // that exist only in a previously prepared/tracked trainer. Install a
    // self-contained bridge after the stable inspection toggle callback, using
    // only refs/state that are declared by the regenerated runtime itself.
    const anchor = "  const advance = useCallback(() => {";
    const toggleAnchor = "  const toggleInspectionDrive = useCallback(() => {";
    const toggleIndex = source.indexOf(toggleAnchor);
    const anchorIndex = source.indexOf(anchor);
    if (toggleIndex < 0 || anchorIndex < 0 || toggleIndex > anchorIndex) {
      throw new Error(`${path}: visual evidence preset bridge cannot be installed after the initialized inspection toggle`);
    }
    const hook = `  useEffect(() => {\n    window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__ = (presetId) => {\n      const presets = {\n        a1Connection: { id: "a1Connection", label: "A1 terminal connection", x: 7.5, z: 8.5, yaw: -0.35, cameraYaw: 0, cameraDistance: 22 },\n        a14: { id: "a14", label: "A concourse midpoint", x: 218.45, z: -86.52, yaw: 2.88, cameraYaw: 2.19, cameraDistance: 32 },\n        b14: { id: "b14", label: "B concourse midpoint", x: 216.4, z: 150.35, yaw: 2.8, cameraYaw: 2.10, cameraDistance: 32 },\n        b15: { id: "b15", label: "B15 ramp", x: -18.5, z: 539.2, yaw: -1.5708, cameraYaw: 1.38, cameraDistance: 25 },\n      };\n      const preset = presets[presetId];\n      const sim = simRef.current;\n      if (!preset || !sim) return null;\n      sim.connection = createConnectionState();\n      sim.dynamics = createPushbackState({\n        tugX: preset.x, tugZ: preset.z, tugYaw: preset.yaw,\n        aircraftX: sim.aircraft.position.x, aircraftZ: sim.aircraft.position.z, aircraftYaw: sim.aircraft.rotation.y,\n      });\n      sim.rig.root.position.set(preset.x, 0, preset.z);\n      sim.rig.root.rotation.y = preset.yaw;\n      sim.rig.setSteering(0);\n      sim.rig.setLiftProgress(0);\n      driveRef.current = { throttle: 0, steer: 0, brake: false, direction: 1 };\n      orbitRef.current.yaw = preset.cameraYaw;\n      orbitRef.current.pitch = 0.38;\n      orbitRef.current.distance = preset.cameraDistance;\n      setThrottle(0);\n      setDirection("FWD");\n      setCameraMode("chase");\n      const canvas = sim.renderer.domElement;\n      canvas.dataset.inspectionPreset = preset.id;\n      canvas.dataset.inspectionPresetLabel = preset.label;\n      canvas.dataset.inspectionRouteAuthority = "visual-evidence-source-gate-presets-v8";\n      canvas.dataset.inspectionTugX = preset.x.toFixed(3);\n      canvas.dataset.inspectionTugZ = preset.z.toFixed(3);\n      canvas.dataset.cameraYaw = preset.cameraYaw.toFixed(4);\n      canvas.dataset.cameraPitch = orbitRef.current.pitch.toFixed(4);\n      canvas.dataset.cameraDistance = orbitRef.current.distance.toFixed(3);\n      canvas.dataset.inspectionCameraAuthority = "free-orbit-follow-tug";\n      setMessage(\`Inspection position: \${preset.label}.\`);\n      return preset.id;\n    };\n    return () => { delete window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__; };\n  }, []);\n\n${anchor}`;
    source = replaceRequired(source, anchor, hook, path, "visual evidence preset bridge");
  }

  if (!source.includes("const keyboardForward = inspectionActive")) {
    const towingAnchor = "      const towing = !inspectionActive && sim.connection.phase === CONNECTION_PHASES.TOWING;";
    source = replaceRequired(
      source,
      towingAnchor,
      `${towingAnchor}\n      const keyboardForward = inspectionActive && (keysRef.current.has("w") || keysRef.current.has("arrowup"));\n      const keyboardReverse = inspectionActive && (keysRef.current.has("s") || keysRef.current.has("arrowdown"));\n      const inspectionDirection = keyboardReverse ? -1 : keyboardForward ? 1 : drive.direction;\n      const inspectionThrottle = keyboardForward || keyboardReverse ? Math.max(drive.throttle, 1) : drive.throttle;`,
      path,
      "keyboard motion",
    );
    source = replaceRequired(
      source,
      "        throttle: motionAllowed && (!towing || drive.direction === 1) ? drive.throttle : 0,\n        direction: drive.direction,",
      "        throttle: motionAllowed && (!towing || inspectionDirection === 1) ? inspectionThrottle : 0,\n        direction: inspectionDirection,",
      path,
      "keyboard throttle",
    );
  }

  source = source.replaceAll(
    "Math.max(drive.throttle, 0.55)",
    "Math.max(drive.throttle, 1)",
  );

  source = source.replaceAll(
    "Free-drive airport inspection active. Procedure gates are disabled; drive anywhere and use the camera views to inspect scenery.",
    "Free-drive airport inspection active. Use W/S or the power slider, A/D to steer, and the camera views to inspect the entire airport.",
  );

  for (const token of [
    'className="rr-inspection-toggle"',
    'data-inspection-mode={inspectionMode ? "active" : "training"}',
    "window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__",
    "const keyboardForward = inspectionActive",
    "const inspectionThrottle = keyboardForward || keyboardReverse ? Math.max(drive.throttle, 1)",
  ]) if (!source.includes(token)) throw new Error(`${path}: completed inspection mode is missing ${token}`);

  fs.writeFileSync(path, source, "utf8");
}

const cssPath = "src/components/RampReadyTrainer.css";
let css = fs.readFileSync(cssPath, "utf8");
const cssMarker = "/* RampReady free-drive inspection control */";
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.rr-top-tools {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.rr-inspection-toggle {\n  min-height: 40px;\n  padding: 9px 14px;\n  border-radius: 999px;\n  cursor: pointer;\n  color: #fff;\n  background: rgba(13, 15, 21, 0.82);\n  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18), 0 10px 30px rgba(0,0,0,0.28);\n  backdrop-filter: blur(14px);\n  font-weight: 900;\n}\n\n.rr-inspection-toggle[aria-pressed=\"true\"] {\n  color: #151515;\n  background: #9cffb2;\n}\n\n.rr-shell[data-inspection-mode=\"active\"] .rr-hud {\n  box-shadow: inset 0 0 0 1px rgba(156,255,178,0.44), 0 18px 60px rgba(0,0,0,0.32);\n}\n\n@media (max-width: 820px) {\n  .rr-top-tools {\n    gap: 5px;\n  }\n\n  .rr-inspection-toggle {\n    min-height: 34px;\n    padding: 7px 10px;\n    font-size: 12px;\n  }\n}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

await import("./prepare-a1-terminal-connector-v11.mjs");
await import("./prepare-inspection-elapsed-motion.mjs");
console.log("Prepared the active Terminal 4 free-drive controls with a regeneration-safe temporary visual-evidence preset bridge, full keyboard power, elapsed-motion integration and the measured A1 wall connector. The final camera stage replaces the temporary bridge with the real inspection callback.");
