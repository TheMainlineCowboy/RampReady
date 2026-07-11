import { readFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const preparationPath = new URL("./prepare-runtime.mjs", import.meta.url);
const [source, preparation] = await Promise.all([
  readFile(trainerPath, "utf8"),
  readFile(preparationPath, "utf8"),
]);

function numericConstant(text, name) {
  const match = text.match(new RegExp(`const ${name} = (-?\\d+(?:\\.\\d+)?);`));
  if (!match) throw new Error(`Unable to read ${name} from trainer source.`);
  return Number(match[1]);
}

function planeRange(label, geometryPattern, positionPattern) {
  const geometry = source.match(geometryPattern);
  const position = source.match(positionPattern);
  if (!geometry || !position) throw new Error(`Unable to read ${label} geometry from trainer source.`);
  const length = Number(geometry[1]);
  const center = Number(position[1]);
  return { min: center - length / 2, max: center + length / 2, length, center };
}

const noseStartZ = numericConstant(source, "NOSE_START_Z");
const trackedStopZ = numericConstant(source, "STOP_Z");
const preparedStopMatch = preparation.match(/const physicalStopLine = "const STOP_Z = (-?\d+(?:\.\d+)?);";/);
const effectiveStopZ = preparedStopMatch ? Number(preparedStopMatch[1]) : trackedStopZ;
const reverseSelected = source.includes("driveRef.current.direction = -1;");
const trackedPhysicalDirection = source.includes("const signedDirection = drive.direction;");
const preparesPhysicalDirection = preparation.includes('const physicalDirectionLine = "const signedDirection = drive.direction;";');
const usesPositiveForwardAxis = source.includes("sim.tug.position.z += Math.cos(sim.tug.rotation.y) * sim.velocity * dt;");
const effectivePhysicalDirection = trackedPhysicalDirection || preparesPhysicalDirection;

const rampRange = planeRange(
  "ramp",
  /new THREE\.PlaneGeometry\(90,\s*(-?\d+(?:\.\d+)?)\)/,
  /ramp\.position\.z = (-?\d+(?:\.\d+)?);/,
);
const centerlineRange = planeRange(
  "centerline",
  /new THREE\.PlaneGeometry\(0\.16,\s*(-?\d+(?:\.\d+)?)\)/,
  /center\.position\.set\(0,\s*0\.018,\s*(-?\d+(?:\.\d+)?)\);/,
);

const effectiveHudDistance = "stop: NOSE_START_Z - STOP_Z";
const effectiveRemainingDistance = "const stopRemaining = sim.aircraft.position.z - STOP_Z;";
const effectiveCompletionGate = "if (towActive && sim.aircraft.position.z <= STOP_Z + 0.5) {";
const routeIsPrepared = preparedStopMatch !== null;

const failures = [];
if (!reverseSelected) failures.push("Pushback stage does not select REV.");
if (!usesPositiveForwardAxis) failures.push("Unable to confirm tug Z-axis movement convention.");
if (!effectivePhysicalDirection) failures.push("Production runtime does not use the selected physical drive direction.");

// With heading zero, REV produces negative Z travel. Validate the effective production
// target, not only the legacy tracked value that prepare-runtime may replace before build.
if (effectivePhysicalDirection && effectiveStopZ >= noseStartZ) {
  failures.push(`REV pushback travels toward decreasing Z, but effective STOP_Z ${effectiveStopZ} is not below NOSE_START_Z ${noseStartZ}.`);
}

if (routeIsPrepared) {
  if (!preparation.includes(effectiveHudDistance)) failures.push("Production preparation does not reverse the initial HUD stop distance.");
  if (!preparation.includes(effectiveRemainingDistance)) failures.push("Production preparation does not reverse remaining-distance calculation.");
  if (!preparation.includes(effectiveCompletionGate)) failures.push("Production preparation does not reverse the stop completion gate.");
}

const routeDistance = noseStartZ - effectiveStopZ;
if (!Number.isFinite(routeDistance) || routeDistance <= 0) failures.push(`Effective route distance ${routeDistance} is invalid.`);
if (routeDistance < 20 || routeDistance > 80) failures.push(`Effective route distance ${routeDistance.toFixed(1)} m is outside the supported training envelope.`);

const routeMin = Math.min(noseStartZ, effectiveStopZ);
const routeMax = Math.max(noseStartZ, effectiveStopZ);
const routeMargin = 2;
if (rampRange.min > routeMin - routeMargin || rampRange.max < routeMax + routeMargin) {
  failures.push(`Ramp surface covers Z ${rampRange.min.toFixed(1)} to ${rampRange.max.toFixed(1)}, but the effective route requires at least ${
    (routeMin - routeMargin).toFixed(1)
  } to ${(routeMax + routeMargin).toFixed(1)}.`);
}
if (centerlineRange.min > routeMin || centerlineRange.max < routeMax) {
  failures.push(`Centerline covers Z ${centerlineRange.min.toFixed(1)} to ${centerlineRange.max.toFixed(1)}, but the effective route runs from ${routeMin.toFixed(1)} to ${routeMax.toFixed(1)}.`);
}

if (failures.length) {
  console.error("RampReady training-route verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RampReady training-route verification passed: effective REV route runs ${routeDistance.toFixed(1)} m from nose Z ${noseStartZ} toward stop Z ${effectiveStopZ}${routeIsPrepared ? " after production preparation" : " in tracked source"}; ramp and centerline cover the full route.`);
