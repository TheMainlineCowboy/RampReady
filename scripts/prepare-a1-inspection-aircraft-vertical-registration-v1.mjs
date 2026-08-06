import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "rendered-a1-door-grounded-from-wheel-contact-v4";
const verticalFitAuthority = "grounded-jetway-door-gap-reported-no-child-lift-v1";
const staleVerticalFitAuthorities = [
  "grounded-aircraft-door-progressive-tunnel-slope-v1",
  "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2",
];

if (source.includes(marker)) {
  for (const stale of staleVerticalFitAuthorities) source = source.replaceAll(stale, verticalFitAuthority);
  if (!source.includes(verticalFitAuthority)) {
    throw new Error(`${trainerPath}: prepared A1 grounding marker exists without the no-lift authority`);
  }
  fs.writeFileSync(trainerPath, source, "utf8");
  console.log("Validated the existing A1 wheel-contact registration with no attached jetway child lift.");
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
  `        const exactA1CabContactX = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldX);\n        const exactA1CabContactY = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldY); // ${marker}\n        const exactA1CabContactZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldZ);`,
  "A1 Cab X/Z declaration",
);

replaceRequired(
  `        if (![exactA1CabContactX, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ].every(Number.isFinite)) {`,
  `        if (![exactA1CabContactX, exactA1CabContactY, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ].every(Number.isFinite)) {`,
  "A1 Cab finite-value validation",
);

replaceRequired(
  `          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;\n          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;\n          sim.aircraft.position.x += aircraftRelocationX;\n          sim.aircraft.position.z += aircraftRelocationZ;`,
  `          // Ground from actual landing-gear wheel meshes. The later authored
          // contact-cluster preparer replaces this exporter-name fallback.
          const landingGearWheelBoundsBefore = new THREE.Box3();
          let landingGearWheelMeshCount = 0;
          renderedAircraft.traverse((object) => {
            if (!object?.isMesh || object.visible === false) return;
            const wheelName = String(object.name || "").toLowerCase();
            if (!/(wheel|tire|tyre)/.test(wheelName)) return;
            landingGearWheelBoundsBefore.expandByObject(object);
            landingGearWheelMeshCount += 1;
          });
          if (landingGearWheelMeshCount < 3 || landingGearWheelBoundsBefore.isEmpty()) {
            throw new Error(\`A1 rendered CRJ exposes only \${landingGearWheelMeshCount} landing-gear wheel meshes; refusing whole-aircraft bounds grounding\`);
          }
          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;
          const aircraftRelocationY = -landingGearWheelBoundsBefore.min.y;
          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;
          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.y += aircraftRelocationY;
          sim.aircraft.position.z += aircraftRelocationZ;`,
  "rendered aircraft X/Z relocation",
);

replaceRequired(
  `          const renderedDoorAfter = renderedAircraft.localToWorld(authoredDoorLocal.clone());`,
  `          const renderedDoorAfter = renderedAircraft.localToWorld(authoredDoorLocal.clone());
          const requestedA1JetwayVerticalFitMeters = renderedDoorAfter.y - exactA1CabContactY;
          if (!(requestedA1JetwayVerticalFitMeters > -6 && requestedA1JetwayVerticalFitMeters < 2)) {
            throw new Error(\`A1 grounded door-height gap is outside the reportable range: \${requestedA1JetwayVerticalFitMeters} m\`);
          }
          // Height matching is intentionally not applied. The prior progressive
          // child translations raised Tunnel B, Tunnel C, Cab and the authored
          // bogie after installation grounding. Keep the exact supplied parent
          // grounded and publish the door gap for a future articulated-height
          // implementation instead of hiding it with floating wheels.
          const appliedA1JetwayVerticalFitMeters = jetwayRef.current.controller?.setAttachedVerticalDrop?.(
            requestedA1JetwayVerticalFitMeters,
          ) ?? 0;
          if (!Number.isFinite(appliedA1JetwayVerticalFitMeters)
            || Math.abs(appliedA1JetwayVerticalFitMeters) > 0.001) {
            throw new Error(\`A1 grounded jetway controller applied a forbidden child lift: requested=\${requestedA1JetwayVerticalFitMeters}, applied=\${appliedA1JetwayVerticalFitMeters}\`);
          }
          exactA1Fleet.userData.uploadedJetwayA1RequestedVerticalFitMeters = requestedA1JetwayVerticalFitMeters;
          exactA1Fleet.userData.uploadedJetwayA1AttachedVerticalFitMeters = 0;
          exactA1Fleet.userData.uploadedJetwayA1AttachedVerticalFitAuthority = "${verticalFitAuthority}";
          exactA1Fleet.userData.uploadedJetwayA1AuthoredBogieGroundPreserved = true;`,
  "rendered aircraft door-after",
);

replaceRequired(
  `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);\n          const renderedDimensions = renderedBounds.getSize(new THREE.Vector3());`,
  `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);
          const renderedDimensions = renderedBounds.getSize(new THREE.Vector3());
          const landingGearWheelBoundsAfter = new THREE.Box3();
          renderedAircraft.traverse((object) => {
            if (!object?.isMesh || object.visible === false) return;
            const wheelName = String(object.name || "").toLowerCase();
            if (/(wheel|tire|tyre)/.test(wheelName)) landingGearWheelBoundsAfter.expandByObject(object);
          });
          if (landingGearWheelBoundsAfter.isEmpty()) {
            throw new Error("A1 landing-gear wheel bounds disappeared after aircraft registration");
          }
          const renderedGroundClearanceMeters = landingGearWheelBoundsAfter.min.y;
          const renderedDoorSignedVerticalGapMeters = renderedDoorAfter.y - exactA1CabContactY;
          const renderedDoorVerticalErrorMeters = Math.abs(renderedDoorSignedVerticalGapMeters);`,
  "rendered aircraft bounds",
);

replaceRequired(
  `          renderer.domElement.dataset.inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6);`,
  `          renderer.domElement.dataset.inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationY = aircraftRelocationY.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6);`,
  "rendered aircraft relocation telemetry",
);

replaceRequired(
  `          renderer.domElement.dataset.inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6);`,
  `          renderer.domElement.dataset.inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactY = exactA1CabContactY.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6);`,
  "rendered Cab telemetry",
);

replaceRequired(
  `          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAfter.x.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);`,
  `          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAfter.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetY = renderedDoorAfter.y.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);`,
  "rendered door telemetry",
);

replaceRequired(
  `          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6);`,
  `          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorVerticalErrorMeters = renderedDoorVerticalErrorMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorSignedVerticalGapMeters = renderedDoorSignedVerticalGapMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftGroundClearanceMeters = renderedGroundClearanceMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftLandingGearWheelMeshCount = String(landingGearWheelMeshCount);
          renderer.domElement.dataset.inspectionAircraftGroundingAuthority = "named-landing-gear-wheel-bounds-v1";
          renderer.domElement.dataset.inspectionAircraftJetwayRequestedVerticalFitMeters = requestedA1JetwayVerticalFitMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftJetwayVerticalFitMeters = appliedA1JetwayVerticalFitMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftJetwayVerticalFitAuthority = "${verticalFitAuthority}";
          renderer.domElement.dataset.inspectionAircraftJetwayAuthoredBogieGroundPreserved = "true";`,
  "rendered Cab error telemetry",
);

for (const token of [
  marker,
  "landingGearWheelBoundsBefore",
  "landingGearWheelMeshCount < 3",
  "const aircraftRelocationY = -landingGearWheelBoundsBefore.min.y",
  "landingGearWheelBoundsAfter.min.y",
  "named-landing-gear-wheel-bounds-v1",
  verticalFitAuthority,
  "appliedA1JetwayVerticalFitMeters) > 0.001",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: grounded no-lift A1 token is missing: ${token}`);
  }
}
for (const stale of staleVerticalFitAuthorities) {
  if (source.includes(stale)) {
    throw new Error(`${trainerPath}: stale A1 child-lift authority remains: ${stale}`);
  }
}
if (source.includes("exactA1CabContactY += appliedA1JetwayVerticalFitMeters")) {
  throw new Error(`${trainerPath}: Cab telemetry is still being moved to conceal the door-height gap`);
}
if (source.includes("const aircraftRelocationY = -renderedBoundsBefore.min.y")) {
  throw new Error(`${trainerPath}: obsolete whole-aircraft bounds grounding remains active`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Grounded the CRJ, preserved the authored A1 bogie at zero child lift, and published the signed door-height gap instead of floating Tunnel B, Tunnel C and Cab to the aircraft.");
