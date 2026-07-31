import fs from "node:fs";

const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(runtimePath, "utf8");

function replaceRequired(before, after, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${runtimePath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

replaceRequired(
  `      const dt = Math.min(0.04, Math.max(0.001, (now - sim.last) / 1000));
      sim.last = now;`,
  `      const rawFrameDt = Math.max(0.001, (now - sim.last) / 1000);
      const dt = Math.min(0.04, rawFrameDt);
      sim.last = now;`,
  "const rawFrameDt = Math.max(0.001",
  "raw frame time",
);

replaceRequired(
  `      sim.dynamics = stepPushbackDynamics(sim.dynamics, {
        connected: towing,
        throttle: motionAllowed && (!towing || inspectionDirection === 1) ? inspectionThrottle : 0,
        direction: inspectionDirection,
        steer: clamp(steer, -1, 1),
        brake: drive.brake || keysRef.current.has(" ") || !motionAllowed,
        cradleOffset: rig.profile.cradleOffset,
        steeringMode: rig.profile.steeringMode,
        wheelbase: rig.profile.wheelbase,
      }, dt);`,
  `      const dynamicsCommand = {
        connected: towing,
        throttle: motionAllowed && (!towing || inspectionDirection === 1) ? inspectionThrottle : 0,
        direction: inspectionDirection,
        steer: clamp(steer, -1, 1),
        brake: drive.brake || keysRef.current.has(" ") || !motionAllowed,
        cradleOffset: rig.profile.cradleOffset,
        steeringMode: rig.profile.steeringMode,
        wheelbase: rig.profile.wheelbase,
      };
      if (inspectionActive) {
        let remainingInspectionDt = Math.min(0.5, rawFrameDt);
        while (remainingInspectionDt > 0.000001) {
          const inspectionStepDt = Math.min(0.04, remainingInspectionDt);
          sim.dynamics = stepPushbackDynamics(sim.dynamics, dynamicsCommand, inspectionStepDt);
          remainingInspectionDt -= inspectionStepDt;
        }
      } else {
        sim.dynamics = stepPushbackDynamics(sim.dynamics, dynamicsCommand, dt);
      }`,
  "let remainingInspectionDt = Math.min(0.5, rawFrameDt)",
  "elapsed-time inspection physics",
);

replaceRequired(
  `      rig.setSteering(state.steerAngle || 0);
      rig.rotateWheels(state.speed * dt);`,
  `      rig.setSteering(state.steerAngle || 0);
      const visualMotionDt = inspectionActive ? Math.min(0.5, rawFrameDt) : dt;
      rig.rotateWheels(state.speed * visualMotionDt);`,
  "const visualMotionDt = inspectionActive",
  "inspection wheel animation timing",
);

replaceRequired(
  `      canvas.dataset.inspectionSpeed = Math.abs(state.speed).toFixed(3);`,
  `      canvas.dataset.inspectionSpeed = Math.abs(state.speed).toFixed(3);
      canvas.dataset.inspectionTimeIntegration = inspectionActive ? "elapsed-substep-40ms" : "training-frame-capped";`,
  "dataset.inspectionTimeIntegration",
  "inspection timing evidence",
);

for (const token of [
  "const rawFrameDt = Math.max(0.001",
  "let remainingInspectionDt = Math.min(0.5, rawFrameDt)",
  "const inspectionStepDt = Math.min(0.04, remainingInspectionDt)",
  "const visualMotionDt = inspectionActive",
  'inspectionTimeIntegration = inspectionActive ? "elapsed-substep-40ms"',
]) {
  if (!source.includes(token)) throw new Error(`${runtimePath}: elapsed inspection motion is missing ${token}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Prepared elapsed-time free-drive motion using stable 40 ms physics substeps with a 0.5 s per-frame catch-up cap; training and towing timing remain unchanged.");
