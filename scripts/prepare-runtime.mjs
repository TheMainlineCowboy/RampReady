import { readFile, rename, writeFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const tempPath = new URL("../src/components/.RampReadyTrainerStable.jsx.tmp", import.meta.url);
const source = await readFile(trainerPath, "utf8");
const legacyLine = "sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));";
const shortestPathLine = "sim.aircraft.rotation.y += Math.atan2(Math.sin(sim.tug.rotation.y - sim.aircraft.rotation.y), Math.cos(sim.tug.rotation.y - sim.aircraft.rotation.y)) * (1 - Math.exp(-0.7 * dt));";
const constrainedBlock = `const yawError = Math.atan2(Math.sin(sim.tug.rotation.y - sim.aircraft.rotation.y), Math.cos(sim.tug.rotation.y - sim.aircraft.rotation.y));
        const requestedYawStep = yawError * (1 - Math.exp(-0.7 * dt));
        sim.aircraft.rotation.y += clamp(requestedYawStep, -THREE.MathUtils.degToRad(12) * dt, THREE.MathUtils.degToRad(12) * dt);`;
const legacyTowBlock = `const towOffset = (sim.towOffsetLocal || new THREE.Vector3()).clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);
        sim.aircraft.position.x = cradle.x + towOffset.x;
        sim.aircraft.position.z = cradle.z + towOffset.z;`;
const centeredTowBlock = `if (sim.towOffsetLocal) {
          sim.towOffsetLocal.multiplyScalar(Math.exp(-6 * dt));
          if (sim.towOffsetLocal.lengthSq() < 0.000004) sim.towOffsetLocal.set(0, 0, 0);
        }
        const towOffset = (sim.towOffsetLocal || new THREE.Vector3()).clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);
        sim.aircraft.position.x = cradle.x + towOffset.x;
        sim.aircraft.position.z = cradle.z + towOffset.z;`;
const forcedPushDirectionLine = "const signedDirection = connectedPushPhase ? 1 : drive.direction;";
const physicalDirectionLine = "const signedDirection = drive.direction;";

const count = (value, needle) => value.split(needle).length - 1;
let prepared = source;
const constrainedCount = count(prepared, constrainedBlock);
const legacyCount = count(prepared, legacyLine);
const shortestPathCount = count(prepared, shortestPathLine);

if (constrainedCount === 0) {
  if (legacyCount + shortestPathCount !== 1) {
    console.error(`RampReady runtime preparation failed: expected exactly one yaw implementation, found constrained=${constrainedCount}, shortest=${shortestPathCount}, legacy=${legacyCount}.`);
    process.exit(1);
  }
  prepared = prepared.replace(shortestPathCount === 1 ? shortestPathLine : legacyLine, constrainedBlock);
} else if (constrainedCount !== 1 || legacyCount !== 0 || shortestPathCount !== 0) {
  console.error(`RampReady runtime preparation failed: ambiguous yaw implementation, found constrained=${constrainedCount}, shortest=${shortestPathCount}, legacy=${legacyCount}.`);
  process.exit(1);
}

const centeredTowCount = count(prepared, centeredTowBlock);
const legacyTowCount = count(prepared, legacyTowBlock);
if (centeredTowCount === 0) {
  if (legacyTowCount !== 1) {
    console.error(`RampReady runtime preparation failed: expected exactly one tow attachment block, found centered=${centeredTowCount}, legacy=${legacyTowCount}.`);
    process.exit(1);
  }
  prepared = prepared.replace(legacyTowBlock, centeredTowBlock);
} else if (centeredTowCount !== 1 || legacyTowCount !== 0) {
  console.error(`RampReady runtime preparation failed: ambiguous tow attachment block, found centered=${centeredTowCount}, legacy=${legacyTowCount}.`);
  process.exit(1);
}

const physicalDirectionCount = count(prepared, physicalDirectionLine);
const forcedDirectionCount = count(prepared, forcedPushDirectionLine);
if (physicalDirectionCount === 0) {
  if (forcedDirectionCount !== 1) {
    console.error(`RampReady runtime preparation failed: expected exactly one connected direction implementation, found physical=${physicalDirectionCount}, forced=${forcedDirectionCount}.`);
    process.exit(1);
  }
  prepared = prepared.replace(forcedPushDirectionLine, physicalDirectionLine);
} else if (physicalDirectionCount !== 1 || forcedDirectionCount !== 0) {
  console.error(`RampReady runtime preparation failed: ambiguous connected direction implementation, found physical=${physicalDirectionCount}, forced=${forcedDirectionCount}.`);
  process.exit(1);
}

if (count(prepared, constrainedBlock) !== 1 || count(prepared, centeredTowBlock) !== 1 || count(prepared, physicalDirectionLine) !== 1 || prepared.includes(legacyLine) || prepared.includes(shortestPathLine) || prepared.includes(legacyTowBlock) || prepared.includes(forcedPushDirectionLine)) {
  console.error("RampReady runtime preparation failed: runtime transformations did not produce one clean implementation.");
  process.exit(1);
}

if (prepared === source) {
  console.log("RampReady runtime preparation passed: articulation, capture centering, and physical reverse travel already present.");
  process.exit(0);
}

await writeFile(tempPath, prepared, "utf8");
await rename(tempPath, trainerPath);
const persisted = await readFile(trainerPath, "utf8");
if (persisted !== prepared) {
  console.error("RampReady runtime preparation failed: prepared trainer source did not persist exactly.");
  process.exit(1);
}

console.log("RampReady runtime preparation applied and verified articulation, capture centering, and physical reverse travel.");