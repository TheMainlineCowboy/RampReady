import assert from "node:assert/strict";
import {evaluateA1ApproachGate,isA1JetwayParked} from "../src/simulation/a1MarshallerWorkflowGate.js";
const parked={retractionRequested:true,target:0,deployment:0,controller:{getState:()=>"parked"}};
const marshaller={status:"ready",readyToGuide:true};
assert.equal(evaluateA1ApproachGate(parked,marshaller).ready,true);
const deployed={...parked,controller:{getState:()=>"parked-clear-of-aircraft"}};
assert.equal(isA1JetwayParked(deployed.controller),true,"actual PHX terminal parked state");
assert.equal(evaluateA1ApproachGate(deployed,marshaller).ready,true,
  "Do not deadlock A1 at parked-clear-of-aircraft");
for(const [name,jetway,guide] of [
 ["not yet requested",{...parked,retractionRequested:false},marshaller],
 ["attached",{...parked,deployment:1,controller:{getState:()=>"attached"}},marshaller],
 ["moving",{...parked,deployment:.35,controller:{getState:()=>"telescoping"}},marshaller],
 ["almost but not fully parked",{...parked,deployment:.003},marshaller],
 ["visual not parked",{...parked,controller:{getState:()=>"rotating-to-park"}},marshaller],
 ["no controller",{...parked,controller:null},marshaller],
 ["human still loading",parked,{status:"loading",readyToGuide:false}],
 ["human still entering",parked,{status:"ready",readyToGuide:false}],
 ["human load error",parked,{status:"error",readyToGuide:false}],
 ])assert.equal(evaluateA1ApproachGate(jetway,guide).ready,false,name);
console.log("PASS: A1 approach is locked until the actual jetway is fully parked and the rigged marshaller has walked into position");
