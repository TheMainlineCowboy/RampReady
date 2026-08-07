import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "measured-cab-normal-aircraft-heading-v1";
const dimensionAuthority = "yaw-neutral-authored-crj-dimensions-v2";
const anchor = `          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());`;
const replacement = `          // Rotate the complete aircraft root before measuring its authored
          // forward-left door. This keeps the CRJ aligned with the measured Cab
          // normal without changing any authored child transform.
          const cabRegisteredAircraftYaw = Math.atan2(
            -exactA1CabDirectionZ,
            exactA1CabDirectionX,
          );
          sim.aircraft.rotation.y = cabRegisteredAircraftYaw;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());
          renderer.domElement.dataset.inspectionAircraftHeadingAuthority = "${authority}";
          renderer.domElement.dataset.inspectionAircraftYaw = cabRegisteredAircraftYaw.toFixed(6);`;

if (source.includes(anchor)) {
  source = source.replace(anchor, replacement);
} else if (!source.includes(`inspectionAircraftHeadingAuthority = "${authority}"`)) {
  throw new Error(`${trainerPath}: authored-door registration anchor is missing`);
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
  "const cabRegisteredAircraftYaw = Math.atan2(",
  "-exactA1CabDirectionZ",
  "exactA1CabDirectionX",
  "sim.aircraft.rotation.y = cabRegisteredAircraftYaw",
  `inspectionAircraftHeadingAuthority = "${authority}"`,
  "inspectionAircraftYaw = cabRegisteredAircraftYaw.toFixed(6)",
  "const renderedYawForDimensionCheck = sim.aircraft.rotation.y",
  "const renderedDimensionBounds = new THREE.Box3().setFromObject(renderedAircraft)",
  "sim.aircraft.rotation.y = renderedYawForDimensionCheck",
  `inspectionAircraftDimensionAuthority = "${dimensionAuthority}"`,
  "const landingGearContactAfter = measureAuthoredLandingGearContact()",
  "renderedGroundClearanceMeters = landingGearContactAfter.minimumY",
  "authored-crj-lowest-geometry-contact-clusters-v2",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: measured Cab-normal aircraft token is missing: ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-final-marker-compat-v1.mjs?final-marker=${Date.now()}`);
await import(`./prepare-current-head-browser-expectations-v1.mjs?current-head=${Date.now()}`);
await import(`./prepare-a1-no-lift-evidence-json-v1.mjs?no-lift-evidence=${Date.now()}`);
await import(`./prepare-a1-post-lifecycle-evidence-v1.mjs?post-lifecycle-evidence=${Date.now()}`);
await import(`./prepare-a1-bogie-centroid-browser-authority-v1.mjs?bogie-centroid=${Date.now()}`);
console.log("Aligned the inspection aircraft to the Cab normal, retained zero-lift signed-gap evidence, required the applied grounded lifecycle pose, and migrated every browser suite to the exact authored bogie-centroid authority.");
