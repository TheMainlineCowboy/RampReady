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

  // Install one evidence bridge that delegates to the SAME callback used by the
  // visible Inspection location control. Never duplicate preset coordinates or
  // mutate simulator refs independently: that was allowing screenshots to
  // disagree with the app's real inspection state/camera definitions.
  const staleBridgePattern = /  useEffect\(\(\) => \{\n    window\.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__ = \(presetId\) => \{[\s\S]*?\n    return \(\) => \{ delete window\.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__; \};\n  \}, \[\]\);\n\n/;
  if (staleBridgePattern.test(source)) {
    source = source.replace(staleBridgePattern, "");
  }
  if (!source.includes("visual-evidence-real-inspection-callback-v2")) {
    const anchor = "  const toggleInspectionDrive = useCallback(() => {";
    const callbackAnchor = "  const moveInspectionToPreset = useCallback((presetId) => {";
    const callbackIndex = source.indexOf(callbackAnchor);
    const anchorIndex = source.indexOf(anchor);
    if (callbackIndex < 0 || anchorIndex < 0 || callbackIndex > anchorIndex) {
      throw new Error(`${path}: real inspection preset callback is not available before inspection toggle`);
    }
    const hook = `  // visual-evidence-real-inspection-callback-v2\n  useEffect(() => {\n    window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__ = (presetId) => {\n      if (!Object.prototype.hasOwnProperty.call(INSPECTION_PRESETS, presetId)) return null;\n      moveInspectionToPreset(presetId);\n      return presetId;\n    };\n    return () => { delete window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__; };\n  }, [moveInspectionToPreset]);\n\n${anchor}`;
    source = replaceRequired(source, anchor, hook, path, "real-callback visual evidence preset bridge");
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
    "visual-evidence-real-inspection-callback-v2",
    "window.__RAMPREADY_VISUAL_EVIDENCE_SET_PRESET__",
    "moveInspectionToPreset(presetId)",
    "}, [moveInspectionToPreset]);",
    "const keyboardForward = inspectionActive",
    "const inspectionThrottle = keyboardForward || keyboardReverse ? Math.max(drive.throttle, 1)",
  ]) if (!source.includes(token)) throw new Error(`${path}: completed inspection mode is missing ${token}`);

  if (source.includes('visual-evidence-source-gate-presets-v8')) {
    throw new Error(`${path}: stale hard-coded visual evidence preset map survived`);
  }

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
console.log("Prepared the active Terminal 4 free-drive controls with the real inspection preset callback exposed to bounded visual evidence, full keyboard power, elapsed-motion integration and the measured A1 wall connector.");
