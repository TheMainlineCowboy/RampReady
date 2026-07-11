import { readFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const source = await readFile(trainerPath, "utf8");

function numericConstant(name) {
  const match = source.match(new RegExp(`const ${name} = (-?\\d+(?:\\.\\d+)?);`));
  if (!match) throw new Error(`Unable to read ${name} from trainer source.`);
  return Number(match[1]);
}

const noseStartZ = numericConstant("NOSE_START_Z");
const stopZ = numericConstant("STOP_Z");
const reverseSelected = source.includes("driveRef.current.direction = -1;");
const physicalDirection = source.includes("const signedDirection = drive.direction;");
const transformedPhysicalDirection = source.includes("const physicalDirectionLine = \"const signedDirection = drive.direction;\"");
const usesPositiveForwardAxis = source.includes("sim.tug.position.z += Math.cos(sim.tug.rotation.y) * sim.velocity * dt;");

const failures = [];
if (!reverseSelected) failures.push("Pushback stage does not select REV.");
if (!usesPositiveForwardAxis) failures.push("Unable to confirm tug Z-axis movement convention.");

// With heading zero, REV produces negative Z travel. A stop target above the starting
// nose position is therefore unreachable once physical reverse direction is enabled.
if ((physicalDirection || transformedPhysicalDirection) && stopZ >= noseStartZ) {
  failures.push(`REV pushback travels toward decreasing Z, but STOP_Z ${stopZ} is not below NOSE_START_Z ${noseStartZ}.`);
}

if (failures.length) {
  console.error("RampReady training-route verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RampReady training-route verification passed: REV route runs from nose Z ${noseStartZ} toward stop Z ${stopZ}.`);
