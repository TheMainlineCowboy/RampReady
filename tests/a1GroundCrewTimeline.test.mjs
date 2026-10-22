import test from "node:test";
import assert from "node:assert/strict";
import { A1_CREW_PATH, A1_CREW_TIMING, createA1CrewClock, computeA1CrewSnapshot } from "../src/simulation/a1GroundCrewTimeline.js";

test("loader starts by the cargo service area and tug approach is held", () => {
  const a=computeA1CrewSnapshot(0);
  assert.equal(a.phase,"servicing");
  assert.equal(a.loaderX,A1_CREW_PATH.start.x);
  assert.equal(a.loaderZ,A1_CREW_PATH.start.z);
  assert.equal(a.signal,"hold");
  assert.equal(a.ready,false);
});
test("equipment must lower before driving away and can never cross the tug line", () => {
  const t=A1_CREW_TIMING;
  const lowered=computeA1CrewSnapshot(t.loaderLowered);
  assert.equal(lowered.lowerProgress,1);
  assert.equal(lowered.loaderProgress,0);
  for(let i=0;i<130;i++){
    const s=computeA1CrewSnapshot(i*.1);
    assert.ok(s.loaderX >= A1_CREW_PATH.start.x-1e-7);
    assert.ok(s.loaderX <= A1_CREW_PATH.finish.x+1e-7);
    assert.ok(s.loaderZ>=A1_CREW_PATH.start.z-1e-7);
    assert.equal(s.ready && !s.equipmentClear,false);
  }
});
test("marshaller reaches a protected off-center position after GSE clearance", () => {
  const s=computeA1CrewSnapshot(A1_CREW_TIMING.marshalOnStation);
  assert.equal(s.phase,"ready");
  assert.equal(s.marshalWalkProgress,1);
  assert.equal(s.marshalX,A1_CREW_PATH.marshalFinish.x);
  assert.ok(Math.abs(s.marshalX)>3);
  assert.equal(s.signal,"approach");
});
test("approach/stop signals depend on tug proximity, never override clearance", () => {
  assert.equal(computeA1CrewSnapshot(2,{tugNoseDistance:.5}).signal,"hold");
  assert.equal(computeA1CrewSnapshot(20,{tugNoseDistance:6,pushbackStage:1}).signal,"approach");
  assert.equal(computeA1CrewSnapshot(20,{tugNoseDistance:2,pushbackStage:1}).signal,"stop");
  assert.equal(computeA1CrewSnapshot(20,{tugNoseDistance:2,pushbackStage:3}).signal,"standby");
});
test("reset restarts the sequence, and background frame steps cannot skip the clearance", () => {
  const clock=createA1CrewClock();
  assert.equal(clock.step(300).ready,false);
  for(let i=0;i<600;i++) clock.step(.04);
  assert.equal(clock.snapshot.ready,true);
  const restarted=clock.reset();
  assert.equal(restarted.ready,false);
  assert.equal(restarted.elapsed,0);
});
test("nonfinite times never unlock the tow approach", () => {
  for(const time of [NaN,-1,Infinity,-Infinity]){
    const s=computeA1CrewSnapshot(time);
    assert.equal(s.ready,false);
    assert.equal(s.signal,"hold");
  }
});
