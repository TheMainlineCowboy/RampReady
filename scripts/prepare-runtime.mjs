import { readFile, rename, writeFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const tempPath = new URL("../src/components/.RampReadyTrainerStable.jsx.tmp", import.meta.url);
const source = await readFile(trainerPath, "utf8");
const legacyLine = "sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));";
const shortestPathLine = "sim.aircraft.rotation.y += Math.atan2(Math.sin(sim.tug.rotation.y - sim.aircraft.rotation.y), Math.cos(sim.tug.rotation.y - sim.aircraft.rotation.y)) * (1 - Math.exp(-0.7 * dt));";
const constrainedBlock = `const yawError = Math.atan2(Math.sin(sim.tug.rotation.y - sim.aircraft.rotation.y), Math.cos(sim.tug.rotation.y - sim.aircraft.rotation.y));
        const requestedYawStep = yawError * (1 - Math.exp(-0.7 * dt));
        sim.aircraft.rotation.y += clamp(requestedYawStep, -THREE.MathUtils.degToRad(12) * dt, THREE.MathUtils.degToRad(12) * dt);`;

const count = (value, needle) => value.split(needle).length - 1;
const constrainedCount = count(source, constrainedBlock);
const legacyCount = count(source, legacyLine);
const shortestPathCount = count(source, shortestPathLine);

if (constrainedCount === 1 && legacyCount === 0 && shortestPathCount === 0) {
  console.log("RampReady runtime preparation passed: constrained aircraft yaw articulation already present.");
  process.exit(0);
}

if (constrainedCount > 0 || legacyCount + shortestPathCount !== 1) {
  console.error(
    `RampReady runtime preparation failed: expected exactly one yaw implementation, found constrained=${constrainedCount}, shortest=${shortestPathCount}, legacy=${legacyCount}.`,
  );
  process.exit(1);
}

const replaceable = shortestPathCount === 1 ? shortestPathLine : legacyLine;
const prepared = source.replace(replaceable, constrainedBlock);
if (count(prepared, constrainedBlock) !== 1 || prepared.includes(legacyLine) || prepared.includes(shortestPathLine)) {
  console.error("RampReady runtime preparation failed: yaw replacement did not produce one clean constrained implementation.");
  process.exit(1);
}

await writeFile(tempPath, prepared, "utf8");
await rename(tempPath, trainerPath);
const persisted = await readFile(trainerPath, "utf8");
if (persisted !== prepared) {
  console.error("RampReady runtime preparation failed: prepared trainer source did not persist exactly.");
  process.exit(1);
}

console.log("RampReady runtime preparation applied and verified constrained aircraft yaw articulation.");
