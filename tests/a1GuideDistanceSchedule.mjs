import assert from "node:assert/strict";
import {A1_CAPTURE_STOP_METERS,mapA1CaptureDistanceToMotionDistance} from "../src/simulation/a1GuideDistanceSchedule.js";
import {A1_APPROACH_DISTANCE_METERS,getA1ApproachPose} from "../src/simulation/a1GroundGuideMotion.js";
assert.equal(A1_CAPTURE_STOP_METERS,0.42);
for(const entry of [2.5,3.9,5.2,7]){
  const readings=[];
  for(let physical=entry;physical>=.42;physical-=.05)
    readings.push(mapA1CaptureDistanceToMotionDistance(physical,entry,A1_APPROACH_DISTANCE_METERS));
  assert.ok(Math.abs(readings[0]-7)<1e-10,"Starts with original arms-spread pose");
  for(let i=1;i<readings.length;i++)
    assert.ok(readings[i]<=readings[i-1]+1e-10,"Pose progresses smoothly toward capture");
  assert.equal(mapA1CaptureDistanceToMotionDistance(.42,entry,7),0);
  assert.equal(mapA1CaptureDistanceToMotionDistance(.1,entry,7),0);
  assert.ok(getA1ApproachPose(mapA1CaptureDistanceToMotionDistance(.42,entry,7)).crossed>.9999);
  const before=mapA1CaptureDistanceToMotionDistance(1.15,entry,7);
  if(entry>2)assert.ok(before<7,"Original animation is in progress before final 1.15m");
}
console.log("PASS: unchanged A1 seven-metre marshalling animation is synchronized with the 0.42m capture stop");
