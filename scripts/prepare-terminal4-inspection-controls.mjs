import fs from "node:fs";

const targets = [
  "src/components/RampReadyStandupTrainer.jsx",
  "src/components/RampReadyStandupTrainerTerminal4.jsx",
];

for (const path of targets) {
  let source = fs.readFileSync(path, "utf8");

  if (!source.includes('className="rr-inspection-toggle"')) {
    const anchor = '        <div className="rr-top-tools">';
    const replacement = `${anchor}\n          <button className="rr-secondary rr-inspection-toggle" type="button" aria-pressed={inspectionMode} onClick={toggleInspectionDrive}>{inspectionMode ? "Return to training" : "Free-drive inspection"}</button>`;
    if (!source.includes(anchor)) throw new Error(`${path}: inspection control anchor is missing`);
    source = source.replace(anchor, replacement);
  }

  if (!source.includes('data-inspection-mode={inspectionMode ? "active" : "training"}')) {
    const anchor = '  return <div className="rr-shell" data-equipment-id={equipmentId}>';
    const replacement = '  return <div className="rr-shell" data-equipment-id={equipmentId} data-inspection-mode={inspectionMode ? "active" : "training"}>';
    if (!source.includes(anchor)) throw new Error(`${path}: inspection shell anchor is missing`);
    source = source.replace(anchor, replacement);
  }

  if (!source.includes("const keyboardForward = inspectionActive")) {
    const anchor = `      const motionAllowed = inspectionActive || (connectionAllowsMotion(sim.connection) && ![3, 4, 8].includes(stageRef.current));
      const towing = !inspectionActive && sim.connection.phase === CONNECTION_PHASES.TOWING;
      sim.dynamics = stepPushbackDynamics(sim.dynamics, {
        connected: towing,
        throttle: motionAllowed && (!towing || drive.direction === 1) ? drive.throttle : 0,
        direction: drive.direction,`;
    const replacement = `      const motionAllowed = inspectionActive || (connectionAllowsMotion(sim.connection) && ![3, 4, 8].includes(stageRef.current));
      const towing = !inspectionActive && sim.connection.phase === CONNECTION_PHASES.TOWING;
      const keyboardForward = inspectionActive && (keysRef.current.has("w") || keysRef.current.has("arrowup"));
      const keyboardReverse = inspectionActive && (keysRef.current.has("s") || keysRef.current.has("arrowdown"));
      const inspectionDirection = keyboardReverse ? -1 : keyboardForward ? 1 : drive.direction;
      const inspectionThrottle = keyboardForward || keyboardReverse ? Math.max(drive.throttle, 0.55) : drive.throttle;
      sim.dynamics = stepPushbackDynamics(sim.dynamics, {
        connected: towing,
        throttle: motionAllowed && (!towing || inspectionDirection === 1) ? inspectionThrottle : 0,
        direction: inspectionDirection,`;
    if (!source.includes(anchor)) throw new Error(`${path}: inspection keyboard-motion anchor is missing`);
    source = source.replace(anchor, replacement);
  }

  source = source.replaceAll(
    "Free-drive airport inspection active. Procedure gates are disabled; drive anywhere and use the camera views to inspect scenery.",
    "Free-drive airport inspection active. Use W/S or the power slider, A/D to steer, and the camera views to inspect the entire airport.",
  );

  for (const token of [
    'className="rr-inspection-toggle"',
    'data-inspection-mode={inspectionMode ? "active" : "training"}',
    "const keyboardForward = inspectionActive",
    "const inspectionThrottle = keyboardForward || keyboardReverse",
  ]) if (!source.includes(token)) throw new Error(`${path}: completed inspection mode is missing ${token}`);

  fs.writeFileSync(path, source, "utf8");
}

console.log("Prepared always-visible free-drive inspection controls with unrestricted WASD/arrow and touch-slider tug motion in both runtimes.");
