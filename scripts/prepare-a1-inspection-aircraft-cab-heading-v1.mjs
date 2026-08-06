import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "measured-cab-normal-aircraft-heading-v1";
const dimensionAuthority = "yaw-neutral-authored-crj-dimensions-v1";
const anchor = `          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());`;
const replacement = `          // The prior registration translated the authored door onto the Cab but
          // preserved the training-start heading. That can produce a mathematically
          // zero door error while the aircraft is visibly parked across the terminal
          // walkway and disconnected from the bridge. Rotate the complete aircraft
          // root first so its authored left side faces back toward the Cab, then
          // measure and translate the real rendered door.
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

// A world-axis bounding box changes its X/Z footprint when the complete aircraft
// is correctly yawed to the Cab normal. The previous 31-34 m Z and 22.5-25 m X
// assertion therefore rejected a valid diagonally parked CRJ as roughly 27 x 27 m.
// Measure canonical authored dimensions with the root yaw temporarily neutral,
// then restore the exact Cab-registered heading before any rendered evidence.
const boundsAnchor = `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);
          const renderedDimensions = renderedBounds.getSize(new THREE.Vector3());
          const renderedGroundClearanceMeters = renderedBounds.min.y;`;
const yawNeutralBounds = `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);
          const renderedGroundClearanceMeters = renderedBounds.min.y;
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
  throw new Error(`${trainerPath}: rendered-aircraft dimension anchor is missing`);
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
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: measured Cab-normal aircraft token is missing: ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-current-head-browser-expectations-v1.mjs?current-head=${Date.now()}`);
console.log("Aligned the complete inspection aircraft root to the measured A1 Cab normal, made CRJ dimension validation independent of rendered yaw, and synchronized current-head browser expectations with that authoritative pose.");
