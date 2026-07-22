import {
  CONNECTION_PHASES,
  beginTow,
  connectionAllowsMotion,
  connectionHasAircraft,
  createConnectionState,
  requestCapture,
  requestLower,
  stepConnection,
} from "../src/simulation/noseGearConnection.js";

const failures = [];
const aligned = { distance: 0.18, lateral: 0.04, heading: 0.01, speed: 0, fromFront: true };
const invalidRear = { ...aligned, fromFront: false };

let state = createConnectionState();
state = stepConnection(state, { metrics: invalidRear, speed: 0 }, 1 / 60);
if (state.phase !== CONNECTION_PHASES.APPROACH) failures.push("rear approach incorrectly became aligned");
state = requestCapture(state, invalidRear);
if (state.phase !== CONNECTION_PHASES.APPROACH) failures.push("rear approach incorrectly entered capture");

state = stepConnection(state, { metrics: aligned, speed: 0 }, 1 / 60);
if (state.phase !== CONNECTION_PHASES.ALIGNED) failures.push("valid alignment was not recognized");
state = requestCapture(state, aligned);
if (state.phase !== CONNECTION_PHASES.CAPTURING) failures.push("capture request did not enter capturing phase");
if (connectionAllowsMotion(state)) failures.push("movement remained enabled during capture");

for (let i = 0; i < 80; i += 1) state = stepConnection(state, { metrics: aligned, speed: 0 }, 1 / 60);
if (state.phase !== CONNECTION_PHASES.SECURED || !state.locked) failures.push("capture did not finish in secured/locked state");
if (!connectionHasAircraft(state)) failures.push("secured state did not report attached aircraft");

const prematureLower = requestLower(state, 0.2, 0);
if (prematureLower.phase === CONNECTION_PHASES.LOWERING) failures.push("lowering allowed while moving");
state = beginTow(state);
if (state.phase !== CONNECTION_PHASES.TOWING) failures.push("secured state did not enter towing");
if (!connectionAllowsMotion(state)) failures.push("towing state did not allow motion");

const crookedLower = requestLower(state, 0, 0.3);
if (crookedLower.phase === CONNECTION_PHASES.LOWERING) failures.push("lowering allowed with excessive articulation");
state = requestLower(state, 0, 0.02);
if (state.phase !== CONNECTION_PHASES.LOWERING) failures.push("safe lowering request was rejected");
if (connectionAllowsMotion(state)) failures.push("movement remained enabled while lowering");

for (let i = 0; i < 70; i += 1) state = stepConnection(state, { speed: 0 }, 1 / 60);
if (state.phase !== CONNECTION_PHASES.RELEASED || state.locked) failures.push("lowering did not finish in released/unlocked state");

// The tug is already several metres from the aircraft nose when the cradle releases.
// That existing separation must become the baseline, not instant proof that the tug drove clear.
state = stepConnection(state, { speed: 0, clearDistance: 3.45 }, 1 / 60);
if (state.phase !== CONNECTION_PHASES.RELEASED) failures.push("release separation incorrectly completed the scenario immediately");
if (state.clearTravel !== 0) failures.push(`release baseline did not start at zero travel: ${state.clearTravel}`);
state = stepConnection(state, { speed: 0.4, clearDistance: 4.65 }, 1 / 60);
if (state.phase !== CONNECTION_PHASES.RELEASED) failures.push("clear state triggered before 2.2 m of post-release tug travel");
if (Math.abs(state.clearTravel - 1.2) > 1e-9) failures.push(`post-release travel measured incorrectly: ${state.clearTravel}`);
state = stepConnection(state, { speed: 0.4, clearDistance: 5.75 }, 1 / 60);
if (state.phase !== CONNECTION_PHASES.CLEAR) failures.push("clear state did not trigger after 2.2 m of actual post-release travel");

let abort = requestCapture(createConnectionState(), aligned);
abort = stepConnection(abort, { metrics: { ...aligned, lateral: 0.5 }, speed: 0 }, 1 / 60);
if (abort.phase !== CONNECTION_PHASES.APPROACH) failures.push("capture did not abort after alignment was lost");

if (failures.length) {
  console.error("RampReady nose-gear connection verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("RampReady nose-gear connection verification passed: front-only approach, timed capture, secure tow interlock, stopped/straight release, post-release travel baseline, and clear gate all enforced.");
