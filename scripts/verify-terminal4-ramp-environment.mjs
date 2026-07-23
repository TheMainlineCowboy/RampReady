import assert from "node:assert/strict";
import * as THREE from "three";
import {
  TERMINAL4_RAMP_PROFILE,
  buildTerminal4RampEnvironment,
} from "../src/environment/terminal4RampEnvironment.js";

const profile = TERMINAL4_RAMP_PROFILE;
assert.equal(profile.id, "phx-terminal4-b15-a1");
assert.equal(profile.coordinateUnits, "meters");
assert.deepEqual(profile.corridor, { startGate: "B15", endGate: "A1" });
assert.equal(profile.gateAuthority, "scenery/KPHX_ADEX.BGL");
assert.equal(profile.runtimeGateSelectionAllowed, false, "runtime gate selection must remain blocked until ADEX-derived coordinates exist");
assert.ok(profile.dimensions.width >= 160, "ramp sector must provide a wide operating envelope");
assert.ok(profile.dimensions.depth >= 240, "ramp sector must provide enough pushback depth");
assert.ok(profile.markings.serviceRoadWidth >= 6.5, "service road must support two-way GSE clearance");
assert.ok(profile.lighting.poleHeight >= 12, "ramp lighting must clear aircraft and GSE sightlines");

const environment = buildTerminal4RampEnvironment(THREE);
assert.equal(environment.name, "Terminal4RampEnvironment");
assert.equal(environment.userData.environmentId, profile.id);
assert.equal(environment.userData.gateAuthority, profile.gateAuthority);
assert.equal(environment.userData.runtimeGateSelectionAllowed, false);
assert.equal(environment.userData.calibrationOnly, true);

const counts = new Map();
environment.traverse((node) => {
  counts.set(node.name, (counts.get(node.name) ?? 0) + 1);
});

assert.equal(counts.get("Terminal4RampSurface"), 1);
assert.ok((counts.get("RampExpansionJointX") ?? 0) >= 15);
assert.ok((counts.get("RampExpansionJointZ") ?? 0) >= 20);
assert.equal(counts.get("CalibrationCenterline"), 1);
assert.equal(counts.get("TrainingStopBar"), 1);
assert.equal(counts.get("ServiceRoadSurface"), 1);
assert.ok((counts.get("ServiceRoadDash") ?? 0) >= 20);
assert.equal(counts.get("UnassignedGateLeadIn"), 4);
assert.ok((counts.get("TerminalFacadeModule") ?? 0) >= 8);
assert.equal(counts.get("TerminalFacadeModule"), counts.get("TerminalFacadeGlass"));
assert.ok((counts.get("RampLightPole") ?? 0) >= 8);
assert.equal(counts.get("RampLightPole"), counts.get("RampLight"));

const namedGateGeometry = [];
environment.traverse((node) => {
  if (/\b(?:A|B)\d+\b/.test(node.name)) namedGateGeometry.push(node.name);
});
assert.deepEqual(namedGateGeometry, [], "environment must not invent gate-specific geometry before ADEX extraction");

const surface = environment.getObjectByName("Terminal4RampSurface");
assert.ok(surface.geometry.parameters.width === profile.dimensions.width);
assert.ok(surface.geometry.parameters.height === profile.dimensions.depth);
assert.equal(surface.receiveShadow, true);

console.log(`Terminal 4 ramp environment contract passed: ${environment.children.length} top-level objects, ${counts.get("TerminalFacadeModule")} facade modules, ${counts.get("RampLightPole")} ramp lights, runtime gate selection safely blocked.`);
