import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "visible-airframe-forward-left-door-registration-v1";
if (source.includes(marker)) {
  console.log("Visible-airframe A1 door registration is already prepared.");
  process.exit(0);
}

const beforeAnchor = "          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());\n          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;\n          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;";
if (!source.includes(beforeAnchor)) {
  throw new Error(`${trainerPath}: authored-door relocation anchor is missing before visible-airframe correction`);
}

const beforeReplacement = `          // ${marker}\n          // Keep the historical authoredDoorLocal measurement as diagnostic compatibility,\n          // but do not use an assumed GLB origin to place the visible aircraft. The supplied\n          // CRJ can retain an exporter-space mesh offset from its Object3D origin. Measure the\n          // actual rendered mesh footprint instead, then derive the forward-left passenger door\n          // from the established CRJ geometry: 7.32 m aft of the visible nose and 1.34 m left\n          // of the visible centerline. This makes the pixels agree with the contact telemetry.\n          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());\n          const measureVisibleAirframeDoor = () => {\n            sim.aircraft.updateMatrixWorld(true);\n            renderedAircraft.updateMatrixWorld(true);\n            const forwardAxis = new THREE.Vector3(0, 0, -1)\n              .applyQuaternion(sim.aircraft.quaternion)\n              .setY(0)\n              .normalize();\n            const leftAxis = new THREE.Vector3(-1, 0, 0)\n              .applyQuaternion(sim.aircraft.quaternion)\n              .setY(0)\n              .normalize();\n            let maximumForwardProjection = Number.NEGATIVE_INFINITY;\n            let minimumLeftProjection = Number.POSITIVE_INFINITY;\n            let maximumLeftProjection = Number.NEGATIVE_INFINITY;\n            let minimumApronClearanceMeters = Number.POSITIVE_INFINITY;\n            let sampleCount = 0;\n            const samplePoint = new THREE.Vector3();\n            renderedAircraft.traverse((child) => {\n              if (!child?.isMesh || !child.geometry) return;\n              if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();\n              const box = child.geometry.boundingBox;\n              if (!box || box.isEmpty()) return;\n              for (const x of [box.min.x, box.max.x]) {\n                for (const y of [box.min.y, box.max.y]) {\n                  for (const z of [box.min.z, box.max.z]) {\n                    samplePoint.set(x, y, z).applyMatrix4(child.matrixWorld);\n                    const forwardProjection = samplePoint.x * forwardAxis.x + samplePoint.z * forwardAxis.z;\n                    const leftProjection = samplePoint.x * leftAxis.x + samplePoint.z * leftAxis.z;\n                    maximumForwardProjection = Math.max(maximumForwardProjection, forwardProjection);\n                    minimumLeftProjection = Math.min(minimumLeftProjection, leftProjection);\n                    maximumLeftProjection = Math.max(maximumLeftProjection, leftProjection);\n                    minimumApronClearanceMeters = Math.min(\n                      minimumApronClearanceMeters,\n                      (samplePoint.x - measuredWallX) * apronNormalX\n                        + (samplePoint.z - measuredWallZ) * apronNormalZ,\n                    );\n                    sampleCount += 1;\n                  }\n                }\n              }\n            });\n            if (sampleCount < 8\n              || ![maximumForwardProjection, minimumLeftProjection, maximumLeftProjection].every(Number.isFinite)) {\n              throw new Error(\"A1 visible-airframe door registration could not measure the rendered CRJ mesh\");\n            }\n            const centerlineLeftProjection = (minimumLeftProjection + maximumLeftProjection) * 0.5;\n            const doorForwardProjection = maximumForwardProjection - 7.32;\n            const doorLeftProjection = centerlineLeftProjection + 1.34;\n            return {\n              point: new THREE.Vector3(\n                forwardAxis.x * doorForwardProjection + leftAxis.x * doorLeftProjection,\n                0,\n                forwardAxis.z * doorForwardProjection + leftAxis.z * doorLeftProjection,\n              ),\n              minimumApronClearanceMeters,\n              sampleCount,\n            };\n          };\n          const visibleDoorBefore = measureVisibleAirframeDoor();\n          const aircraftRelocationX = exactA1CabContactX - visibleDoorBefore.point.x;\n          const aircraftRelocationZ = exactA1CabContactZ - visibleDoorBefore.point.z;`;
source = source.replace(beforeAnchor, beforeReplacement);

const afterAnchor = "          const renderedDoorAfter = renderedAircraft.localToWorld(authoredDoorLocal.clone());\n          const cabContactErrorMeters = Math.hypot(\n            renderedDoorAfter.x - exactA1CabContactX,\n            renderedDoorAfter.z - exactA1CabContactZ,\n          );";
if (!source.includes(afterAnchor)) {
  throw new Error(`${trainerPath}: authored-door post-relocation anchor is missing before visible-airframe correction`);
}

const afterReplacement = `          const visibleDoorAfter = measureVisibleAirframeDoor();\n          const renderedDoorAfter = visibleDoorAfter.point;\n          const cabContactErrorMeters = Math.hypot(\n            renderedDoorAfter.x - exactA1CabContactX,\n            renderedDoorAfter.z - exactA1CabContactZ,\n          );\n          if (visibleDoorAfter.minimumApronClearanceMeters < -0.25) {\n            throw new Error(\n              \`A1 visible CRJ penetrates the measured terminal wall by \${(-visibleDoorAfter.minimumApronClearanceMeters).toFixed(3)} m after door registration\`,\n            );\n          }`;
source = source.replace(afterAnchor, afterReplacement);

const telemetryAnchor = "          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);";
const telemetryReplacement = `          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftVisibleDoorAuthority = \"${marker}\";\n          renderer.domElement.dataset.inspectionAircraftVisibleDoorSampleCount = String(visibleDoorAfter.sampleCount);\n          renderer.domElement.dataset.inspectionAircraftVisibleAirframeMinimumApronClearanceMeters = visibleDoorAfter.minimumApronClearanceMeters.toFixed(6);`;
if (source.includes(telemetryAnchor)) {
  source = source.replace(telemetryAnchor, telemetryReplacement);
} else if (!source.includes(`inspectionAircraftVisibleDoorAuthority = "${marker}"`)) {
  throw new Error(`${trainerPath}: visible-airframe telemetry anchor is missing`);
}

for (const token of [
  marker,
  "const measureVisibleAirframeDoor = () =>",
  "maximumForwardProjection - 7.32",
  "centerlineLeftProjection + 1.34",
  "const visibleDoorBefore = measureVisibleAirframeDoor()",
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
console.log("Registered the visible rendered CRJ forward-left door to A1 from actual mesh bounds, rejected terminal penetration, and retained authored-door telemetry only as compatibility diagnostics.");
