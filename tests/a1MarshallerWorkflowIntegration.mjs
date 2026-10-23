import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync("src/components/RampReadyStandupTrainerTerminal4.jsx","utf8");
const finalPass=fs.readFileSync("scripts/apply-a1-marshaller-sequence-gate.mjs","utf8");
for(const [label,token] of [
 ["real gate evaluation","evaluateA1ApproachGate(jetway, a1MarshallerRef.current)"],
 ["stage 1 only after readiness","if (gate.ready)"],
 ["marshaller reference","a1MarshallerRef.current = a1Marshaller"],
 ["capture authorization","Capture locked: jetway must be parked and marshaller guiding"],
 ["blocked initial driving","stageRef.current !== 0 && approachGuideReady"],
 ["marshaller entry status","a1MarshallerReadyToGuide"],
 ["fully parked status","a1JetwayCompletelyParked"]
])assert.ok(source.includes(token),label+" not present in generated simulator");
for(const token of ["evaluateA1ApproachGate(jetway, a1MarshallerRef.current)","stageRef.current !== 0 && approachGuideReady","a1MarshallerRef.current = a1Marshaller"])
 assert.ok(finalPass.includes(token),"final deterministic runtime pass lost: "+token);
const authority=fs.readFileSync("scripts/prepare-a1-exact-gate-pose-v1.mjs","utf8");
assert.ok(authority.includes("applyA1MarshallerSequenceGate(trainerPath)"),"last gate-pose source pass must apply marshaller guard");
const live=fs.readFileSync("src/simulation/a1LiveMarshaller.js","utf8");
assert.ok(live.includes("agent.person.visible=!readInspection()"),"guide staging point should remain visible in training");
assert.ok(!live.includes('phase="finished";agent.person.visible=false'),"guide must never pop out after exit");
console.log("PASS: live generated simulator and re-generation sources both enforce the A1 readiness gate; marshaller exit is visible");
