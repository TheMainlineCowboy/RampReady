import { readFile, writeFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const source = await readFile(trainerPath, "utf8");
const oldLine = "sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));";
const newLine = "sim.aircraft.rotation.y += Math.atan2(Math.sin(sim.tug.rotation.y - sim.aircraft.rotation.y), Math.cos(sim.tug.rotation.y - sim.aircraft.rotation.y)) * (1 - Math.exp(-0.7 * dt));";

if (source.includes(newLine)) {
  console.log("RampReady runtime preparation passed: shortest-path aircraft yaw damping already present.");
  process.exit(0);
}

if (!source.includes(oldLine)) {
  console.error("RampReady runtime preparation failed: expected aircraft yaw interpolation was not found.");
  process.exit(1);
}

await writeFile(trainerPath, source.replace(oldLine, newLine));
console.log("RampReady runtime preparation applied shortest-path aircraft yaw damping.");
