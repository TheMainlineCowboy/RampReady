import test from "node:test";
import assert from "node:assert/strict";
import {
  A1_TURNAROUND_ASSIGNMENT as assignment,
  advanceA1Turnaround as apply,
  createA1TurnaroundMission,
  getA1TurnaroundProgress,
  getA1TurnaroundResult,
  isA1ReadyForPushback,
} from "../src/simulation/a1TurnaroundMission.js";

function dispatch(state, ...types) {
  return types.reduce((current, type) => apply(current, { type }), state);
}

function preparedMission() {
  let mission = dispatch(createA1TurnaroundMission(), "accept", "secureGate", "placeCones");
  for (let i = 0; i < 3; i += 1) mission = apply(mission, { type: "unload" });
  for (let i = 0; i < 4; i += 1) mission = apply(mission, { type: "load" });
  return dispatch(mission, "clearEquipment", "removeCones", "removeChocks");
}

test("assignment is at A1 with fixed fictional baggage counts", () => {
  assert.equal(assignment.gate, "A1");
  assert.equal(assignment.inboundBags, 12);
  assert.equal(assignment.outboundBags, 16);
  assert.equal(getA1TurnaroundProgress(createA1TurnaroundMission()).completed, 0);
});

test("cannot skip to loading or pushback", () => {
  const initial = createA1TurnaroundMission();
  assert.strictEqual(apply(initial, { type: "load" }), initial);
  assert.strictEqual(apply(initial, { type: "startPushback" }), initial);
  let mission = dispatch(initial, "accept", "secureGate");
  assert.strictEqual(apply(mission, { type: "unload" }), mission);
  mission = apply(mission, { type: "placeCones" });
  assert.strictEqual(apply(mission, { type: "load" }), mission);
});

test("recording baggage counts stops at the assignment totals", () => {
  let mission = dispatch(createA1TurnaroundMission(), "accept", "secureGate", "placeCones");
  for (let i = 0; i < 20; i += 1) mission = apply(mission, { type: "unload" });
  assert.equal(mission.offloaded, 12);
  for (let i = 0; i < 20; i += 1) mission = apply(mission, { type: "load" });
  assert.equal(mission.loaded, 16);
});

test("pushback requires completed baggage and all clearance confirmations", () => {
  let mission = preparedMission();
  assert.equal(isA1ReadyForPushback(mission), true);
  assert.equal(getA1TurnaroundProgress(mission).completed, 8);
  mission = apply(mission, { type: "startPushback" });
  assert.equal(mission.phase, "pushback");
  assert.equal(getA1TurnaroundResult(mission), null);
  assert.equal(mission.pushbackStage, 0);
});

test("only a real stage eight runtime update completes the mission", () => {
  let mission = apply(preparedMission(), { type: "startPushback" });
  assert.strictEqual(apply(mission, { type: "pushbackProgress", stage: 99, score: 100 }), mission);
  mission = apply(mission, { type: "pushbackProgress", stage: 7, score: 95 });
  assert.equal(mission.phase, "pushback");
  mission = apply(mission, { type: "pushbackProgress", stage: 8, score: 87.5 });
  assert.equal(mission.phase, "complete");
  assert.equal(mission.pushbackScore, 88);
  assert.equal(getA1TurnaroundProgress(mission).completed, 9);
  assert.equal(getA1TurnaroundResult(mission).pushbackScore, 88);
  assert.strictEqual(apply(mission, { type: "unload" }), mission);
});

test("restart clears the completed mission without mutating old state", () => {
  const prepared = preparedMission();
  const restarted = apply(prepared, { type: "restart" });
  assert.equal(restarted.phase, "briefing");
  assert.equal(restarted.loaded, 0);
  assert.equal(prepared.loaded, 16);
});
