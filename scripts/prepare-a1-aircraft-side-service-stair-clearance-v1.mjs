import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-service-stair-live-rendered-crj-clearance-v4";
const authority = "exact-supplied-tunnel-c-service-stair-live-rendered-crj-clearance-v4";
const finalVisibleMarker = "a1-final-visible-grounded-door-and-integrated-tunnel-c-v1";
const runtimeSupportMarker = "a1-runtime-tunnel-c-separable-support-meshes-v1";
const importLine = 'import { articulateA1ServiceStairClearOfAircraft } from "../environment/a1ServiceStairClearanceV1.js";';

const doorFit = fs.readFileSync(doorFitPath, "utf8");
if (!doorFit.includes(finalVisibleMarker)) {
  throw new Error(`${doorFitPath}: live service-stair clearance must run after final visible door normalization`);
}
if (!doorFit.includes(runtimeSupportMarker)) {
  throw new Error(`${doorFitPath}: live service-stair clearance requires final Tunnel-C support normalization`);
}
// V1-V3 attempted to solve against the environment group before the final CRJ
// object was calibrated. They are intentionally forbidden in the shipping fitter.
for (const stale of [
  "a1-service-stair-cab-side-swing-clearance-v1",
  "a1-service-stair-rendered-crj-envelope-clearance-v2",
  "a1-service-stair-exact-crj-envelope-clearance-v3",
  "const serviceStairClearance = articulateA1ServiceStairClearOfAircraft(",
]) {
  if (doorFit.includes(stale)) {
    throw new Error(`${doorFitPath}: stale pre-aircraft service-stair solve survived: ${stale}`);
  }
}

let trainer = fs.readFileSync(trainerPath, "utf8");
if (!trainer.includes(marker)) {
  const importAnchor = 'import { buildCRJ700Aircraft } from "./aircraft/crj700Model.js";';
  if (!trainer.includes(importAnchor)) {
    throw new Error(`${trainerPath}: CRJ import anchor is missing for live service-stair solver`);
  }
  if (!trainer.includes(importLine)) {
    trainer = trainer.replace(importAnchor, `${importAnchor}\n${importLine}`);
  }

  const browserTruthAnchor = `          // Browser-time visual truth. Several older readiness layers still`;
  if (!trainer.includes(browserTruthAnchor)) {
    throw new Error(`${trainerPath}: final live-Cab browser-truth anchor is missing`);
  }
  const liveSolve = `          // ${marker}\n          // This is deliberately after the final live Cab has calibrated the real\n          // rendered CRJ pose. The earlier fitter owns Cab contact; only now do we\n          // have both actual object hierarchies needed to prove the exact supplied\n          // Tunnel-C service stair clears the fuselage. A vertical-axis swing keeps\n          // the upper attachment and ramp height intact and cannot move the Cab,\n          // Rotunda, terminal, aircraft or bogie.\n          const finalA1ServiceStairClearance = articulateA1ServiceStairClearOfAircraft(\n            THREE, sim.aircraft, finalA1Model,\n          );\n          if (\n            finalA1ServiceStairClearance.authority !== "${authority}"\n            || finalA1ServiceStairClearance.stairTriangleCount !== 2352\n            || !Number.isFinite(finalA1ServiceStairClearance.swingDegrees)\n            || Math.abs(finalA1ServiceStairClearance.swingDegrees) > 88\n            || !Number.isFinite(finalA1ServiceStairClearance.afterFuselageEnvelopePenetrationMeters)\n            || finalA1ServiceStairClearance.afterFuselageEnvelopePenetrationMeters > 0.001\n          ) {\n            throw new Error(\`A1 live service-stair clearance failed: \${JSON.stringify(finalA1ServiceStairClearance)}\`);\n          }\n          exactA1Fleet.updateWorldMatrix(true, true);\n          finalA1Model.updateWorldMatrix(true, true);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairClearanceAuthority = finalA1ServiceStairClearance.authority;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairTriangleCount = String(finalA1ServiceStairClearance.stairTriangleCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairSwingDegrees = finalA1ServiceStairClearance.swingDegrees.toFixed(3);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairBeforeFuselagePenetrationMeters = finalA1ServiceStairClearance.beforeFuselageEnvelopePenetrationMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters = finalA1ServiceStairClearance.afterFuselageEnvelopePenetrationMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairOutboardClearanceMeters = finalA1ServiceStairClearance.minimumOutboardClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairBoxSeparationMeters = finalA1ServiceStairClearance.minimumFuselageBoxSeparationMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairMeasuredFuselageBandPointCount = String(finalA1ServiceStairClearance.measuredFuselageBandPointCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairFuselageMeshName = finalA1ServiceStairClearance.fuselageMeshName;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1ServiceStairServiceSideSign = String(finalA1ServiceStairClearance.serviceSideSign);\n\n`;
  trainer = trainer.replace(browserTruthAnchor, `${liveSolve}${browserTruthAnchor}`);
}

for (const required of [
  marker,
  importLine,
  authority,
  "finalA1ServiceStairClearance",
  "sim.aircraft, finalA1Model",
  "stairTriangleCount !== 2352",
  "afterFuselageEnvelopePenetrationMeters > 0.001",
  "terminal4UploadedJetwayA1ServiceStairClearanceAuthority",
  "terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters",
  "terminal4UploadedJetwayA1ServiceStairMeasuredFuselageBandPointCount",
]) {
  if (!trainer.includes(required)) {
    throw new Error(`${trainerPath}: final live A1 service-stair clearance is missing ${required}`);
  }
}

const solver = fs.readFileSync("src/environment/a1ServiceStairClearanceV1.js", "utf8");
for (const required of [
  authority,
  "findLiveRenderedCrjFuselageBounds",
  "EXPECTED_SERVICE_STAIR_TRIANGLE_COUNT = 2352",
  "aircraftRoot.updateWorldMatrix(true, true)",
]) {
  if (!solver.includes(required)) {
    throw new Error(`A1 live service-stair runtime solver is missing ${required}`);
  }
}

fs.writeFileSync(trainerPath, trainer, "utf8");
console.log(`Prepared ${marker}: A1 now evaluates and, only if necessary, swings the exact 2352-triangle supplied Tunnel-C service stair after the final rendered CRJ pose exists; the browser publishes fail-closed live fuselage-clearance evidence before capture.`);
