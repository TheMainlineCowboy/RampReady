import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "source-a1-parking-heading-authored-door-registration-v2";
const dimensionAuthority = "yaw-neutral-authored-crj-dimensions-v2";
const sourceHeadingDegrees = 270.491;
const sourceModelYawDegrees = sourceHeadingDegrees - 270;
const anchor = `          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());`;
const replacement = `          // Keep the aircraft on the actual A1 stand heading. The CRJ model
          // points along local -Z, so the source 270.491-degree parking heading
          // is represented by the existing A1_INSPECTION_AIRCRAFT_YAW constant
          // (0.491 degrees). Register the authored forward-left door to the Cab
          // by translating the complete aircraft after this rotation; do not
          // rotate the fuselage to the jetway Cab normal.
          const sourceStandAircraftYaw = A1_INSPECTION_AIRCRAFT_YAW;
          sim.aircraft.rotation.y = sourceStandAircraftYaw;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());
          renderer.domElement.dataset.inspectionAircraftHeadingAuthority = "${authority}";
          renderer.domElement.dataset.inspectionAircraftSourceParkingHeadingDegrees = "${sourceHeadingDegrees.toFixed(3)}";
          renderer.domElement.dataset.inspectionAircraftSourceModelYawDegrees = "${sourceModelYawDegrees.toFixed(3)}";
          renderer.domElement.dataset.inspectionAircraftYaw = sourceStandAircraftYaw.toFixed(6);`;

const oldCabRegisteredBlockPattern = /          \/\/ Rotate the complete aircraft root before measuring its authored[\s\S]*?          renderer\.domElement\.dataset\.inspectionAircraftYaw = cabRegisteredAircraftYaw\.toFixed\(6\);/;
if (oldCabRegisteredBlockPattern.test(source)) {
  source = source.replace(oldCabRegisteredBlockPattern, replacement.trimEnd());
} else if (source.includes(anchor)) {
  source = source.replace(anchor, replacement);
} else if (!source.includes(`inspectionAircraftHeadingAuthority = "${authority}"`)) {
  throw new Error(`${trainerPath}: authored-door source-heading registration anchor is missing`);
}

const boundsAnchor = `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);
          const renderedDimensions = renderedBounds.getSize(new THREE.Vector3());`;
const yawNeutralBounds = `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);
          const renderedYawForDimensionCheck = sim.aircraft.rotation.y;
          sim.aircraft.rotation.y = 0;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDimensionBounds = new THREE.Box3().setFromObject(renderedAircraft);
          const renderedDimensions = renderedDimensionBounds.getSize(new THREE.Vector3());
          sim.aircraft.rotation.y = renderedYawForDimensionCheck;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          renderer.domElement.dataset.inspectionAircraftDimensionAuthority = "${dimensionAuthority}";`;
if (source.includes(boundsAnchor)) {
  source = source.replace(boundsAnchor, yawNeutralBounds);
} else if (!source.includes(`inspectionAircraftDimensionAuthority = "${dimensionAuthority}"`)) {
  throw new Error(`${trainerPath}: rendered-aircraft dimension anchor is missing after authored contact grounding`);
}

for (const token of [
  "const sourceStandAircraftYaw = A1_INSPECTION_AIRCRAFT_YAW",
  "sim.aircraft.rotation.y = sourceStandAircraftYaw",
  `inspectionAircraftHeadingAuthority = "${authority}"`,
  `inspectionAircraftSourceParkingHeadingDegrees = "${sourceHeadingDegrees.toFixed(3)}"`,
  `inspectionAircraftSourceModelYawDegrees = "${sourceModelYawDegrees.toFixed(3)}"`,
  "inspectionAircraftYaw = sourceStandAircraftYaw.toFixed(6)",
  "const renderedYawForDimensionCheck = sim.aircraft.rotation.y",
  "const renderedDimensionBounds = new THREE.Box3().setFromObject(renderedAircraft)",
  "sim.aircraft.rotation.y = renderedYawForDimensionCheck",
  `inspectionAircraftDimensionAuthority = "${dimensionAuthority}"`,
  "const landingGearContactAfter = measureAuthoredLandingGearContact()",
  "renderedGroundClearanceMeters = landingGearContactAfter.minimumY",
  "authored-crj-three-tire-contact-patches-v3",
  "inspectionAircraftNoseTireContact",
  "inspectionAircraftLeftMainTireContact",
  "inspectionAircraftRightMainTireContact",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: source A1 parking-heading token is missing: ${token}`);
  }
}
for (const forbidden of [
  "authored-crj-lowest-geometry-contact-clusters-v2",
  "const cabRegisteredAircraftYaw = Math.atan2(",
  "sim.aircraft.rotation.y = cabRegisteredAircraftYaw",
  'inspectionAircraftHeadingAuthority = "measured-cab-normal-aircraft-heading-v1"',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: obsolete Cab/grounding authority remains: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-aircraft-terminal-half-plane-v1.mjs?terminal-half-plane=${Date.now()}`);
await import(`./prepare-a1-visible-airframe-door-registration-v1.mjs?visible-airframe-door=${Date.now()}`);
await import(`./prepare-a1-final-marker-compat-v1.mjs?final-marker=${Date.now()}`);
await import(`./prepare-current-head-browser-expectations-v1.mjs?current-head=${Date.now()}`);
await import(`./prepare-a1-no-lift-evidence-json-v1.mjs?no-lift-evidence=${Date.now()}`);
await import(`./prepare-a1-post-lifecycle-evidence-v1.mjs?post-lifecycle-evidence=${Date.now()}`);
await import(`./prepare-a1-bogie-centroid-browser-authority-v1.mjs?bogie-centroid=${Date.now()}`);
await import(`./prepare-source-locked-a1-elbow-finalizer-v1.mjs?final-a1-geometry=${Date.now()}`);
console.log("Restored the authored A1 parking heading, retained the grounded aircraft and browser evidence contracts, then made the exact source-locked Rotunda elbow the final A1 geometry authority immediately before production bundling.");
