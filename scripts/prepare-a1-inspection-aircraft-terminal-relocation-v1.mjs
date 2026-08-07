import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "authored-rendered-door-to-final-cab-a1-aircraft-pose-v4";
const markerLiteral = JSON.stringify(marker);
// The relocation, grounding and lifecycle now form one measured persisted pose.
// Publish that final authority everywhere instead of retaining the superseded
// horizontal-relocation-only label.
const poseAuthority = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";
const cabContactAuthority = "authored-rendered-forward-left-door-to-final-cab-v4";
const renderedScaleAuthority = "crj-authored-world-dimensions-preserved-v2";
// Measured directly from the normalized authored CRJ GLB. The model is +Y up,
// -Z forward, and the forward-left passenger door is on the -X fuselage side.
const authoredDoorLocalX = -1.262;
const authoredDoorLocalY = 3.0;
const authoredDoorLocalZ = 3.90;

source = source.replace(
  /const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "[^"]+";/,
  `const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${poseAuthority}";`,
);

// buildCRJ700Aircraft already applies the procedural 1.35 normalization. The
// trainer's legacy 0.82 factor must multiply that scale, not overwrite it. This
// leaves the authored child at an effective world scale of 1.0 and the fallback
// at its verified 32.5 m length.
if (source.includes("aircraft.scale.setScalar(0.82);")) {
  source = source.replace(
    "aircraft.scale.setScalar(0.82);",
    "aircraft.scale.multiplyScalar(0.82);",
  );
} else if (!source.includes("aircraft.scale.multiplyScalar(0.82);")) {
  throw new Error(`${trainerPath}: aircraft world-scale normalization anchor is missing`);
}

const staleBlockPattern = /        \/\/ (?:Keep|Register) the inspection aircraft registered to the supplied Cab after the[\s\S]*?        return terminal;/;
const replacementBlock = `        // Register the actual rendered forward-left door of the loaded authored
        // CRJ directly to the measured final aircraft-facing end of the supplied
        // Cab mesh. Do not infer the door from the aircraft root or from a parking
        // heading: the child GLB scale and authored local door coordinate are part
        // of the rendered transform and are measured here in scene coordinates.
        const exactA1Fleet = environment.userData.authoredTerminal4Jetways;
        const exactA1CabContactX = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldX);
        const exactA1CabContactZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldZ);
        const exactA1CabDirectionX = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabDirectionWorldX);
        const exactA1CabDirectionZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabDirectionWorldZ);
        const exactA1WallRelocationX = Number(exactA1Fleet?.userData?.uploadedJetwayA1TerminalRelocationX) || 0;
        const exactA1WallRelocationZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1TerminalRelocationZ) || 0;
        if (![exactA1CabContactX, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ].every(Number.isFinite)) {
          throw new Error("A1 inspection aircraft is missing the measured final Cab contact");
        }
        const exactA1CabDirectionLength = Math.hypot(exactA1CabDirectionX, exactA1CabDirectionZ);
        if (Math.abs(exactA1CabDirectionLength - 1) > 0.01) {
          throw new Error(\`A1 measured final Cab direction is not normalized: \${exactA1CabDirectionLength}\`);
        }
        if (inspectionRef.current && !sim.aircraft.userData[${markerLiteral}]) {
          const renderedAircraft = sim.aircraft.userData.realAircraftObject;
          if (!renderedAircraft?.isObject3D || sim.aircraft.userData.aircraftAssetState !== "ready") {
            throw new Error("A1 inspection registration requires the loaded authored CRJ model");
          }
          const initialNoseGearX = sim.aircraft.position.x;
          const initialNoseGearZ = sim.aircraft.position.z;
          const authoredDoorLocal = new THREE.Vector3(
            ${authoredDoorLocalX},
            ${authoredDoorLocalY},
            ${authoredDoorLocalZ},
          );
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());
          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;
          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;
          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.z += aircraftRelocationZ;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorAfter = renderedAircraft.localToWorld(authoredDoorLocal.clone());
          const cabContactErrorMeters = Math.hypot(
            renderedDoorAfter.x - exactA1CabContactX,
            renderedDoorAfter.z - exactA1CabContactZ,
          );
          if (cabContactErrorMeters > 0.01) {
            throw new Error(\`A1 rendered authored door missed the measured final Cab by \${cabContactErrorMeters} m\`);
          }
          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);
          const renderedDimensions = renderedBounds.getSize(new THREE.Vector3());
          if (!(renderedDimensions.z > 31 && renderedDimensions.z < 34
            && renderedDimensions.x > 22.5 && renderedDimensions.x < 25)) {
            throw new Error(\`A1 rendered CRJ dimensions are invalid: \${renderedDimensions.z} x \${renderedDimensions.x} m\`);
          }
          sim.aircraft.userData[${markerLiteral}] = true;
          renderer.domElement.dataset.inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftTerminalRelocationX = aircraftRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftTerminalRelocationZ = aircraftRelocationZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftWallRelocationX = exactA1WallRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftWallRelocationZ = exactA1WallRelocationZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabDirectionX = exactA1CabDirectionX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabDirectionZ = exactA1CabDirectionZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAfter.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorLocalX = authoredDoorLocal.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorLocalY = authoredDoorLocal.y.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorLocalZ = authoredDoorLocal.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftRenderedLengthMeters = renderedDimensions.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftRenderedWingspanMeters = renderedDimensions.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftRenderedScaleAuthority = "${renderedScaleAuthority}";
          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactAuthority = "${cabContactAuthority}";
          renderer.domElement.dataset.inspectionAircraftPoseAuthority = A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY;
        }
        return terminal;`;

if (staleBlockPattern.test(source)) {
  source = source.replace(staleBlockPattern, replacementBlock);
} else if (!source.includes(marker)) {
  const anchor = "        return terminal;";
  if (!source.includes(anchor)) throw new Error(`${trainerPath}: terminal-load completion anchor is missing`);
  source = source.replace(anchor, replacementBlock);
}

source = source
  .replaceAll(
    "inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(3)",
    "inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(6)",
  )
  .replaceAll(
    "inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(3)",
    "inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(6)",
  );

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${poseAuthority}"`,
  `inspectionAircraftCabContactAuthority = "${cabContactAuthority}"`,
  `inspectionAircraftRenderedScaleAuthority = "${renderedScaleAuthority}"`,
  `userData[${markerLiteral}]`,
  "aircraft.scale.multiplyScalar(0.82)",
  "uploadedJetwayA1CabContactWorldX",
  "uploadedJetwayA1CabContactWorldZ",
  "const renderedAircraft = sim.aircraft.userData.realAircraftObject",
  "const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone())",
  "const renderedDoorAfter = renderedAircraft.localToWorld(authoredDoorLocal.clone())",
  "const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft)",
  "renderedDimensions.z > 31 && renderedDimensions.z < 34",
  "inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6)",
  "inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6)",
  "inspectionAircraftDoorTargetX = renderedDoorAfter.x.toFixed(6)",
  "inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6)",
  "inspectionAircraftRenderedLengthMeters = renderedDimensions.z.toFixed(6)",
  "inspectionAircraftRenderedWingspanMeters = renderedDimensions.x.toFixed(6)",
  "inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6)",
  "inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6)",
  "inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6)",
  "inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(6)",
  "inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(6)",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: rendered authored-door aircraft output is missing ${token}`);
}
if (source.includes("aircraft.scale.setScalar(0.82)")) {
  throw new Error(`${trainerPath}: legacy aircraft scale overwrite remains`);
}
if (source.includes('const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "terminal-relocated-a1-exact-cab-registration-v1";')) {
  throw new Error(`${trainerPath}: superseded horizontal-only aircraft pose authority remains`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared authored-world-scale CRJ rendering and the persisted measured forward-left door registration to the final A1 Cab endpoint.");
