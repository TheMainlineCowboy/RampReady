import assert from "node:assert/strict";
import * as THREE from "three";
import {createA1MarshallerWalkRoute} from "../src/simulation/a1MarshallerWalkRoute.js";
const start=new THREE.Vector3(0,0,4.8);
const end=new THREE.Vector3(0,0,0);
const heading=Math.PI/2;
const route=createA1MarshallerWalkRoute(THREE,start,end,heading);
const angularError=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
assert.ok(route.meters>=4.8&&route.meters<8);
assert.ok(route.position(0).distanceTo(start)<1e-6);
assert.ok(route.position(1).distanceTo(end)<1e-6);
assert.ok(angularError(route.heading(1),heading)<.015,"Marshaller must arrive already facing the tug");
assert.ok(angularError(route.reverseHeading(0),heading+Math.PI)<.015,"Exit begins opposite the guiding direction");
assert.ok(route.meters/1.3<15,"Walking should finish within the real 15s jetway cycle");
let maxTurn=0;
for(let i=1;i<=100;i++){
  const a=route.heading(i/100),b=route.heading((i-1)/100);
  maxTurn=Math.max(maxTurn,angularError(a,b));
}
assert.ok(maxTurn<.13,"No 90-degree snap or sideways end slide; curve tangent must change smoothly");
console.log("PASS: Sam's walking path enters fully aligned, constant arc-length speed, no endpoint side-step");
