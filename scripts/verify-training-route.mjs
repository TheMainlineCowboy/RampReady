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

function preparedConstant(name, fallback) {
  const match = preparation.match(new RegExp(`const physical${name}Line = "const ${name.replace(/([A-Z])/g, "_$1").toUpperCase()} = (-?\\d+(?:\\.\\d+)?);";`));
  return match ? Number(match[1]) : fallback;
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

if (failures.length) {
  console.error("RampReady training-route verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RampReady training-route verification passed: effective REV route runs ${routeDistance.toFixed(1)} m from nose Z ${noseStartZ} toward stop Z ${effectiveStopZ}${routeIsPrepared ? " after production preparation" : " in tracked source"}.`);
