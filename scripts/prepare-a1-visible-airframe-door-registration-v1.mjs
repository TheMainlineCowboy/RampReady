import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "visible-airframe-forward-left-door-registration-v1";
const alreadyPrepared = source.includes(marker);

if (!alreadyPrepared) {
  // The terminal-half-plane step intentionally expands the code immediately after
  // renderedDoorBefore, while the grounding step inserts the Y relocation between
  // the stable X/Z equations. Match that grounded X/Y/Z block so visible-airframe
  // registration cannot accidentally discard wheel-contact grounding.
  const relocationAnchor = `          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;
          const aircraftRelocationY = -landingGearWheelBoundsBefore.min.y;
          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;`;
  if (!source.includes(relocationAnchor)) {
    throw new Error(`${trainerPath}: grounded authored-door X/Y/Z relocation equations are missing before visible-airframe correction`);
  }

  const relocationReplacement = `          // ${marker}
          // Keep renderedDoorBefore as compatibility telemetry, but place the aircraft
          // from the pixels that are actually rendered. Exporter-space offsets can make
          // an Object3D-local point numerically correct while the visible fuselage is far
          // away. Measure the rendered mesh footprint and derive the CRJ forward-left
          // passenger door from the established geometry: 7.32 m aft of the visible nose
          // and 1.34 m left of the visible centerline. Preserve the independently measured
          // wheel-contact Y relocation exactly.
          const measureVisibleAirframeDoor = () => {
            sim.aircraft.updateMatrixWorld(true);
            renderedAircraft.updateMatrixWorld(true);
            const forwardAxis = new THREE.Vector3(0, 0, -1)
              .applyQuaternion(sim.aircraft.quaternion)
              .setY(0)
              .normalize();
            const leftAxis = new THREE.Vector3(-1, 0, 0)
              .applyQuaternion(sim.aircraft.quaternion)
              .setY(0)
              .normalize();
            let maximumForwardProjection = Number.NEGATIVE_INFINITY;
            let minimumLeftProjection = Number.POSITIVE_INFINITY;
            let maximumLeftProjection = Number.NEGATIVE_INFINITY;
            let minimumApronClearanceMeters = Number.POSITIVE_INFINITY;
            let sampleCount = 0;
            const samplePoint = new THREE.Vector3();
            renderedAircraft.traverse((child) => {
              if (!child?.isMesh || !child.geometry) return;
              if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
              const box = child.geometry.boundingBox;
              if (!box || box.isEmpty()) return;
              for (const x of [box.min.x, box.max.x]) {
                for (const y of [box.min.y, box.max.y]) {
                  for (const z of [box.min.z, box.max.z]) {
                    samplePoint.set(x, y, z).applyMatrix4(child.matrixWorld);
                    const forwardProjection = samplePoint.x * forwardAxis.x + samplePoint.z * forwardAxis.z;
                    const leftProjection = samplePoint.x * leftAxis.x + samplePoint.z * leftAxis.z;
                    maximumForwardProjection = Math.max(maximumForwardProjection, forwardProjection);
                    minimumLeftProjection = Math.min(minimumLeftProjection, leftProjection);
                    maximumLeftProjection = Math.max(maximumLeftProjection, leftProjection);
                    minimumApronClearanceMeters = Math.min(
                      minimumApronClearanceMeters,
                      (samplePoint.x - measuredWallX) * apronNormalX
                        + (samplePoint.z - measuredWallZ) * apronNormalZ,
                    );
                    sampleCount += 1;
                  }
                }
              }
            });
            if (sampleCount < 8
              || ![
                maximumForwardProjection,
                minimumLeftProjection,
                maximumLeftProjection,
                minimumApronClearanceMeters,
              ].every(Number.isFinite)) {
              throw new Error("A1 visible-airframe door registration could not measure the rendered CRJ mesh");
            }
            const centerlineLeftProjection = (minimumLeftProjection + maximumLeftProjection) * 0.5;
            const doorForwardProjection = maximumForwardProjection - 7.32;
            const doorLeftProjection = centerlineLeftProjection + 1.34;
            return {
              point: new THREE.Vector3(
                forwardAxis.x * doorForwardProjection + leftAxis.x * doorLeftProjection,
                0,
                forwardAxis.z * doorForwardProjection + leftAxis.z * doorLeftProjection,
              ),
              minimumApronClearanceMeters,
              sampleCount,
            };
          };
          const visibleDoorBefore = measureVisibleAirframeDoor();
          const aircraftRelocationX = exactA1CabContactX - visibleDoorBefore.point.x;
          const aircraftRelocationY = -landingGearWheelBoundsBefore.min.y;
          const aircraftRelocationZ = exactA1CabContactZ - visibleDoorBefore.point.z;`;
  source = source.replace(relocationAnchor, relocationReplacement);

  const renderedDoorAfterAnchor = "          const renderedDoorAfter = renderedAircraft.localToWorld(authoredDoorLocal.clone());";
  if (!source.includes(renderedDoorAfterAnchor)) {
    throw new Error(`${trainerPath}: authored-door post-relocation measurement is missing before visible-airframe correction`);
  }
  source = source.replace(
    renderedDoorAfterAnchor,
    `          const visibleDoorAfter = measureVisibleAirframeDoor();
          const renderedDoorAfter = visibleDoorAfter.point;`,
  );

  const cabErrorGuardAnchor = `          if (cabContactErrorMeters > 0.01) {
            throw new Error(\`A1 rendered authored door missed the measured final Cab by \${cabContactErrorMeters} m\`);
          }`;
  if (!source.includes(cabErrorGuardAnchor)) {
    throw new Error(`${trainerPath}: Cab-contact error guard is missing before visible-airframe correction`);
  }
  source = source.replace(
    cabErrorGuardAnchor,
    `          if (visibleDoorAfter.minimumApronClearanceMeters < -0.25) {
            throw new Error(
              \`A1 visible CRJ penetrates the measured terminal wall by \${(-visibleDoorAfter.minimumApronClearanceMeters).toFixed(3)} m after visible-door registration\`,
            );
          }
          if (cabContactErrorMeters > 0.01) {
            throw new Error(\`A1 visible rendered forward-left door missed the measured final Cab by \${cabContactErrorMeters} m\`);
          }`,
  );

  const telemetryAnchor = "          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);";
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${trainerPath}: visible-airframe telemetry anchor is missing`);
  }
  source = source.replace(
    telemetryAnchor,
    `          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftVisibleDoorAuthority = "${marker}";
          renderer.domElement.dataset.inspectionAircraftVisibleDoorSampleCount = String(visibleDoorAfter.sampleCount);
          renderer.domElement.dataset.inspectionAircraftVisibleAirframeMinimumApronClearanceMeters = visibleDoorAfter.minimumApronClearanceMeters.toFixed(6);`,
  );
}

for (const token of [
  marker,
  "const measureVisibleAirframeDoor = () =>",
  "maximumForwardProjection - 7.32",
  "centerlineLeftProjection + 1.34",
  "const visibleDoorBefore = measureVisibleAirframeDoor()",
  "const aircraftRelocationY = -landingGearWheelBoundsBefore.min.y",
  "const visibleDoorAfter = measureVisibleAirframeDoor()",
  "A1 visible CRJ penetrates the measured terminal wall",
  `inspectionAircraftVisibleDoorAuthority = "${marker}"`,
  "inspectionAircraftVisibleAirframeMinimumApronClearanceMeters",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: visible-airframe A1 registration token is missing: ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(alreadyPrepared
  ? "Visible-airframe A1 door registration was already present and remains valid."
  : "Registered the visible rendered CRJ forward-left door to A1 from actual mesh bounds, preserved wheel-contact grounding, rejected terminal penetration, and retained the old Object3D-local door only as compatibility telemetry.");
