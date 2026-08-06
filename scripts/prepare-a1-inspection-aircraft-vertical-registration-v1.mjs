import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "rendered-a1-door-grounded-from-wheel-contact-v4";
if (source.includes(marker)) {
  console.log("A1 wheel-contact grounding and progressive jetway height fit are already prepared.");
  process.exit(0);
}

function replaceRequired(before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`${trainerPath}: ${label} anchor is missing`);
  }
  source = source.replace(before, after);
}

replaceRequired(
  `        const exactA1CabContactX = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldX);\n        const exactA1CabContactZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldZ);`,
  `        const exactA1CabContactX = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldX);\n        let exactA1CabContactY = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldY); // ${marker}\n        const exactA1CabContactZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldZ);`,
  "A1 Cab X/Z declaration",
);

replaceRequired(
  `        if (![exactA1CabContactX, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ].every(Number.isFinite)) {`,
  `        if (![exactA1CabContactX, exactA1CabContactY, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ].every(Number.isFinite)) {`,
  "A1 Cab finite-value validation",
);

replaceRequired(
  `          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;\n          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;\n          sim.aircraft.position.x += aircraftRelocationX;\n          sim.aircraft.position.z += aircraftRelocationZ;`,
  `          // Ground from actual landing-gear wheel meshes. Using the complete\n          // aircraft bounds can select antennas, belly geometry, or invisible\n          // helpers and leave the visible tires floating above the ramp.\n          const landingGearWheelBoundsBefore = new THREE.Box3();\n          let landingGearWheelMeshCount = 0;\n          renderedAircraft.traverse((object) => {\n            if (!object?.isMesh || object.visible === false) return;\n            const wheelName = String(object.name || "").toLowerCase();\n            if (!/(wheel|tire|tyre)/.test(wheelName)) return;\n            landingGearWheelBoundsBefore.expandByObject(object);\n            landingGearWheelMeshCount += 1;\n          });\n          if (landingGearWheelMeshCount < 3 || landingGearWheelBoundsBefore.isEmpty()) {\n            throw new Error(\`A1 rendered CRJ exposes only \${landingGearWheelMeshCount} landing-gear wheel meshes; refusing whole-aircraft bounds grounding\`);\n          }\n          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;\n          const aircraftRelocationY = -landingGearWheelBoundsBefore.min.y;\n          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;\n          sim.aircraft.position.x += aircraftRelocationX;\n          sim.aircraft.position.y += aircraftRelocationY;\n          sim.aircraft.position.z += aircraftRelocationZ;`,
  "rendered aircraft X/Z relocation",
);

replaceRequired(
  `          const renderedDoorAfter = renderedAircraft.localToWorld(authoredDoorLocal.clone());`,
  `          const renderedDoorAfter = renderedAircraft.localToWorld(authoredDoorLocal.clone());\n          const requestedA1JetwayVerticalFitMeters = renderedDoorAfter.y - exactA1CabContactY;\n          if (!(requestedA1JetwayVerticalFitMeters > -6 && requestedA1JetwayVerticalFitMeters < 2)) {\n            throw new Error(\`A1 supplied bridge requires an invalid vertical fit: \${requestedA1JetwayVerticalFitMeters} m\`);\n          }\n          const appliedA1JetwayVerticalFitMeters = jetwayRef.current.controller?.setAttachedVerticalDrop?.(\n            requestedA1JetwayVerticalFitMeters,\n          );\n          if (!Number.isFinite(appliedA1JetwayVerticalFitMeters)\n            || Math.abs(appliedA1JetwayVerticalFitMeters - requestedA1JetwayVerticalFitMeters) > 0.001) {\n            throw new Error(\`A1 supplied bridge rejected the grounded-door height fit: requested=\${requestedA1JetwayVerticalFitMeters}, applied=\${appliedA1JetwayVerticalFitMeters}\`);\n          }\n          exactA1CabContactY += appliedA1JetwayVerticalFitMeters;\n          exactA1Fleet.userData.uploadedJetwayA1CabContactWorldY = exactA1CabContactY;\n          exactA1Fleet.userData.uploadedJetwayA1AttachedVerticalFitMeters = appliedA1JetwayVerticalFitMeters;\n          exactA1Fleet.userData.uploadedJetwayA1AttachedVerticalFitAuthority = "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2";`,
  "rendered aircraft door-after",
);

replaceRequired(
  `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);\n          const renderedDimensions = renderedBounds.getSize(new THREE.Vector3());`,
  `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);\n          const renderedDimensions = renderedBounds.getSize(new THREE.Vector3());\n          const landingGearWheelBoundsAfter = new THREE.Box3();\n          renderedAircraft.traverse((object) => {\n            if (!object?.isMesh || object.visible === false) return;\n            const wheelName = String(object.name || "").toLowerCase();\n            if (/(wheel|tire|tyre)/.test(wheelName)) landingGearWheelBoundsAfter.expandByObject(object);\n          });\n          if (landingGearWheelBoundsAfter.isEmpty()) {\n            throw new Error("A1 landing-gear wheel bounds disappeared after aircraft registration");\n          }\n          const renderedGroundClearanceMeters = landingGearWheelBoundsAfter.min.y;\n          const renderedDoorVerticalErrorMeters = Math.abs(renderedDoorAfter.y - exactA1CabContactY);`,
  "rendered aircraft bounds",
);

replaceRequired(
  `          renderer.domElement.dataset.inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6);`,
  `          renderer.domElement.dataset.inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftExactParentRelocationY = aircraftRelocationY.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6);`,
  "rendered aircraft relocation telemetry",
);

replaceRequired(
  `          renderer.domElement.dataset.inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6);`,
  `          renderer.domElement.dataset.inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabContactY = exactA1CabContactY.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6);`,
  "rendered Cab telemetry",
);

replaceRequired(
  `          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAfter.x.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);`,
  `          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAfter.x.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftDoorTargetY = renderedDoorAfter.y.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);`,
  "rendered door telemetry",
);

replaceRequired(
  `          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6);`,
  `          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftDoorVerticalErrorMeters = renderedDoorVerticalErrorMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftGroundClearanceMeters = renderedGroundClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftLandingGearWheelMeshCount = String(landingGearWheelMeshCount);\n          renderer.domElement.dataset.inspectionAircraftGroundingAuthority = "named-landing-gear-wheel-bounds-v1";\n          renderer.domElement.dataset.inspectionAircraftJetwayVerticalFitMeters = appliedA1JetwayVerticalFitMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftJetwayVerticalFitAuthority = "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2";`,
  "rendered Cab error telemetry",
);

for (const token of [
  marker,
  "landingGearWheelBoundsBefore",
  "landingGearWheelMeshCount < 3",
  "refusing whole-aircraft bounds grounding",
  "const aircraftRelocationY = -landingGearWheelBoundsBefore.min.y",
  "landingGearWheelBoundsAfter.min.y",
  "named-landing-gear-wheel-bounds-v1",
  "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2",
  "inspectionAircraftLandingGearWheelMeshCount",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: wheel-contact grounding token is missing: ${token}`);
  }
}

if (source.includes("const aircraftRelocationY = -renderedBoundsBefore.min.y")) {
  throw new Error(`${trainerPath}: obsolete whole-aircraft bounds grounding remains active`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared the A1 CRJ from named landing-gear wheel contact geometry and progressively fitted the supplied bridge to the grounded door without modifying Airport_Jetway.glb.");
