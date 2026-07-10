import { readFile, writeFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const source = await readFile(trainerPath, "utf8");
const legacyLine = "sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));";
const shortestPathLine = "sim.aircraft.rotation.y += Math.atan2(Math.sin(sim.tug.rotation.y - sim.aircraft.rotation.y), Math.cos(sim.tug.rotation.y - sim.aircraft.rotation.y)) * (1 - Math.exp(-0.7 * dt));";
const constrainedBlock = `const yawError = Math.atan2(Math.sin(sim.tug.rotation.y - sim.aircraft.rotation.y), Math.cos(sim.tug.rotation.y - sim.aircraft.rotation.y));
        const requestedYawStep = yawError * (1 - Math.exp(-0.7 * dt));
        sim.aircraft.rotation.y += clamp(requestedYawStep, -THREE.MathUtils.degToRad(12) * dt, THREE.MathUtils.degToRad(12) * dt);`;

if (source.includes(constrainedBlock)) {
  console.log("RampReady runtime preparation passed: constrained aircraft yaw articulation already present.");
  process.exit(0);
}

const replaceable = source.includes(shortestPathLine) ? shortestPathLine : source.includes(legacyLine) ? legacyLine : null;
if (!replaceable) {
  console.error("RampReady runtime preparation failed: expected aircraft yaw interpolation was not found.");
  process.exit(1);
}

await writeFile(trainerPath, source.replace(replaceable, constrainedBlock));
console.log("RampReady runtime preparation applied constrained aircraft yaw articulation.");