import { readFile, rename, writeFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const tempPath = new URL("../src/components/.RampReadyTrainerStable.jsx.tmp", import.meta.url);
const source = await readFile(trainerPath, "utf8");
const legacyDirectionLine = "const signedDirection = connectedPushPhase ? 1 : drive.direction;";
const physicalDirectionLine = "const signedDirection = drive.direction;";
const legacyAttachmentBlock = `if (sim.connected) {
        const towOffset = (sim.towOffsetLocal || new THREE.Vector3()).clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);
        sim.aircraft.position.x = cradle.x + towOffset.x;
        sim.aircraft.position.z = cradle.z + towOffset.z;
        sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));
      }`;
const preparedAttachmentBlock = `if (sim.connected) {
        if (sim.towOffsetLocal) {
          sim.towOffsetLocal.multiplyScalar(Math.exp(-6 * dt));
          if (sim.towOffsetLocal.lengthSq() < 0.000004) sim.towOffsetLocal.set(0, 0, 0);
        }
        const towOffset = (sim.towOffsetLocal || new THREE.Vector3()).clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);
        const attachedNoseX = cradle.x + towOffset.x;
        const attachedNoseZ = cradle.z + towOffset.z;
        if (!sim.lastAttachedNose) sim.lastAttachedNose = new THREE.Vector3(attachedNoseX, 0, attachedNoseZ);
        const noseDx = attachedNoseX - sim.lastAttachedNose.x;
        const noseDz = attachedNoseZ - sim.lastAttachedNose.z;
        const aircraftRightX = Math.cos(sim.aircraft.rotation.y);
        const aircraftRightZ = -Math.sin(sim.aircraft.rotation.y);
        const lateralNoseTravel = noseDx * aircraftRightX + noseDz * aircraftRightZ;
        const requestedYawStep = lateralNoseTravel / 11.2;
        sim.aircraft.rotation.y += clamp(requestedYawStep, -THREE.MathUtils.degToRad(12) * dt, THREE.MathUtils.degToRad(12) * dt);
        sim.aircraft.position.x = attachedNoseX;
        sim.aircraft.position.z = attachedNoseZ;
        sim.lastAttachedNose.set(attachedNoseX, 0, attachedNoseZ);
      }`;

const count = (value, needle) => value.split(needle).length - 1;
let prepared = source;

const physicalDirectionCount = count(prepared, physicalDirectionLine);
const legacyDirectionCount = count(prepared, legacyDirectionLine);
if (physicalDirectionCount === 0) {
  if (legacyDirectionCount !== 1) {
    console.error(`RampReady runtime preparation failed: expected one direction implementation, found physical=${physicalDirectionCount}, legacy=${legacyDirectionCount}.`);
    process.exit(1);
  }
  prepared = prepared.replace(legacyDirectionLine, physicalDirectionLine);
} else if (physicalDirectionCount !== 1 || legacyDirectionCount !== 0) {
  console.error(`RampReady runtime preparation failed: ambiguous direction implementation, found physical=${physicalDirectionCount}, legacy=${legacyDirectionCount}.`);
  process.exit(1);
}

const preparedAttachmentCount = count(prepared, preparedAttachmentBlock);
const legacyAttachmentCount = count(prepared, legacyAttachmentBlock);
if (preparedAttachmentCount === 0) {
  if (legacyAttachmentCount !== 1) {
    console.error(`RampReady runtime preparation failed: expected one connected attachment implementation, found prepared=${preparedAttachmentCount}, legacy=${legacyAttachmentCount}.`);
    process.exit(1);
  }
  prepared = prepared.replace(legacyAttachmentBlock, preparedAttachmentBlock);
} else if (preparedAttachmentCount !== 1 || legacyAttachmentCount !== 0) {
  console.error(`RampReady runtime preparation failed: ambiguous attachment implementation, found prepared=${preparedAttachmentCount}, legacy=${legacyAttachmentCount}.`);
  process.exit(1);
}

if (count(prepared, physicalDirectionLine) !== 1 || count(prepared, preparedAttachmentBlock) !== 1 || prepared.includes(legacyDirectionLine) || prepared.includes(legacyAttachmentBlock)) {
  console.error("RampReady runtime preparation failed: runtime transformations did not produce one clean implementation.");
  process.exit(1);
}

if (prepared === source) {
  console.log("RampReady runtime preparation passed: reverse travel and wheelbase-constrained nose-gear towing already present.");
  process.exit(0);
}

await writeFile(tempPath, prepared, "utf8");
await rename(tempPath, trainerPath);
const persisted = await readFile(trainerPath, "utf8");
if (persisted !== prepared) {
  console.error("RampReady runtime preparation failed: prepared trainer source did not persist exactly.");
  process.exit(1);
}

console.log("RampReady runtime preparation applied and verified reverse travel with wheelbase-constrained nose-gear towing.");
