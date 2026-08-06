import fs from "node:fs";

const buildPath = "scripts/build-production-simulator-quality.mjs";
const anchorPath = "scripts/prepare-a1-lifecycle-grounded-pose-anchor-v1.mjs";
const lifecyclePath = "scripts/prepare-a1-inspection-aircraft-pose-lifecycle-v2.mjs";
const build = fs.readFileSync(buildPath, "utf8");
const anchor = fs.readFileSync(anchorPath, "utf8");
const lifecycle = fs.readFileSync(lifecyclePath, "utf8");

const token = (script) => `await runNode("scripts/${script}")`;
const authoredGround = build.indexOf(token("prepare-a1-authored-ground-contact-v1.mjs"));
const poseDeclaration = build.indexOf(token("prepare-a1-inspection-aircraft-pose-declaration-v1.mjs"));
const groundedAnchor = build.indexOf(token("prepare-a1-lifecycle-grounded-pose-anchor-v1.mjs"));
const firstLifecycle = build.indexOf(token("prepare-a1-inspection-aircraft-pose-lifecycle-v2.mjs"));
const closure = build.indexOf(token("prepare-a1-rotunda-vestibule-closure-v1.mjs"));
const finalizer = build.indexOf(token("prepare-a1-final-acceptance-authority-v1.mjs"));
const secondLifecycle = build.indexOf(token("prepare-a1-inspection-aircraft-pose-lifecycle-v2.mjs"), finalizer);
const heading = build.indexOf(token("prepare-a1-inspection-aircraft-cab-heading-v1.mjs"));

const ordered = [
  authoredGround,
  poseDeclaration,
  groundedAnchor,
  firstLifecycle,
  closure,
  finalizer,
  secondLifecycle,
  heading,
];
if (ordered.some((index) => index < 0)) {
  throw new Error(`${buildPath}: grounded A1 lifecycle stage is missing: ${ordered.join(",")}`);
}
for (let index = 1; index < ordered.length; index += 1) {
  if (ordered[index] <= ordered[index - 1]) {
    throw new Error(`${buildPath}: grounded A1 lifecycle order is invalid: ${ordered.join(",")}`);
  }
}

for (const required of [
  "grounded-a1-training-pose-before-inspection-registration-v1",
  "const trainingAircraftPoseBeforeInspectionRegistration =",
  "y: sim.aircraft.position.y",
  "sim.aircraft.position.y += aircraftRelocationY",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
]) {
  if (!anchor.includes(required)) {
    throw new Error(`${anchorPath}: grounded pose anchor is missing ${required}`);
  }
}

for (const required of [
  'const lifecycleAuthority = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2"',
  "trainingAircraftPoseBeforeInspectionRegistration",
  "sim.aircraft.userData.a1InspectionPose = inspectionAircraftPose",
  "sim.aircraft.userData.a1InspectionPoseAuthority",
  'renderer.domElement.dataset.inspectionAircraftPoseStored = "true"',
  "const storedResetAircraftPose = resetUsesInspectionAircraftPose",
  "const storedToggleAircraftPose = next",
  "const liveStoredInspectionAircraftPose = sim.aircraft.userData.a1InspectionPose || null",
  "liveInspectionAircraftPoseApplied",
  "inspectionAircraftPoseErrorMeters",
]) {
  if (!lifecycle.includes(required)) {
    throw new Error(`${lifecyclePath}: pose lifecycle is missing ${required}`);
  }
}

console.log("Verified authored CRJ grounding -> full X/Y/Z pose declaration -> grounded anchor -> first stored-pose lifecycle -> geometry finalization -> final acceptance -> second lifecycle -> Cab heading order.");
