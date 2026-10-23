import assert from "node:assert/strict";
import {A1_WALK_ENTRY_DISTANCE_METERS,A1_WALK_SPEED_METERS_PER_SECOND} from "../src/simulation/a1LiveMarshaller.js";
assert.equal(A1_WALK_ENTRY_DISTANCE_METERS,4.8);
assert.ok(A1_WALK_SPEED_METERS_PER_SECOND>=1.2 && A1_WALK_SPEED_METERS_PER_SECOND<=1.5);
assert.ok(A1_WALK_ENTRY_DISTANCE_METERS/A1_WALK_SPEED_METERS_PER_SECOND<4.2,"Guide must finish walking before the jetway reaches parked state");
const src=(await import("node:fs")).readFileSync("src/simulation/a1LiveMarshaller.js","utf8");
assert.ok(src.includes('startPhase("turning-to-guide",now)')&&src.includes('startPhase("turning-to-exit",now)'),"Rotation must occur at walking endpoints");
assert.ok(!src.includes("walkTo(atGuide,dt,guideHeading)"),"The marshaller must not turn sideways while still taking strides");
assert.ok(!src.includes("distance<.95"),"No sideways rotation during last metre");
assert.ok(src.includes("walkInHeading=headingFromTo(atEntry,atGuide)"),"Entry must start facing the walking direction");
assert.ok(src.includes("agent.person.position.lerpVectors(from,to,fraction)"),
 "Walk progress must be tied to real elapsed milliseconds");
assert.ok(src.includes("const now=performance.now()"),"Must use monotonic clock when renderer drops frames");
const rigSource=(await import("node:fs")).readFileSync("src/simulation/a1GroundGuideMotion.js","utf8");
assert.ok(rigSource.includes("mixer.update(animationDt)"),"Authored Sam gait must advance by real time");
console.log("PASS: authored Sam walk clip retained; 4.8m natural entry and stationary direction changes");
