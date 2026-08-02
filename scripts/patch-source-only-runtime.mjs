import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const targetPath = path.resolve("src/components/RampReadyStandupTrainerTerminal4.jsx");
const source = await readFile(targetPath, "utf8");
const wallClockToken = "jetway.lastAnimationTime = now;";
if (source.includes(wallClockToken)) {
  console.log("Source-only runtime patch already applied: jetway motion uses wall-clock time.");
  process.exit(0);
}

const before = `      const jetway = jetwayRef.current;
      const difference = jetway.targetDeployment - jetway.deployment;
      if (Math.abs(difference) > 0.0001) {
        const step = Math.min(Math.abs(difference), dt * 0.34);
        jetway.deployment = clamp(jetway.deployment + Math.sign(difference) * step, 0, 1);
        if (Math.abs(jetway.targetDeployment - jetway.deployment) <= 0.001) {
          jetway.deployment = jetway.targetDeployment;
        }
      }
      const jetwayController = environment.userData.authoredTerminal4A1JetwayController;`;

const after = `      const jetway = jetwayRef.current;
      const jetwayElapsedSeconds = Math.min(
        1,
        Math.max(0.001, (now - (jetway.lastAnimationTime || now - 16)) / 1000),
      );
      jetway.lastAnimationTime = now;
      const difference = jetway.targetDeployment - jetway.deployment;
      if (Math.abs(difference) > 0.0001) {
        const step = Math.min(Math.abs(difference), jetwayElapsedSeconds * 0.34);
        jetway.deployment = clamp(jetway.deployment + Math.sign(difference) * step, 0, 1);
        if (Math.abs(jetway.targetDeployment - jetway.deployment) <= 0.001) {
          jetway.deployment = jetway.targetDeployment;
        }
      }
      const jetwayController = environment.userData.authoredTerminal4A1JetwayController;`;

if (!source.includes(before)) {
  throw new Error("The source-only runtime could not find the expected jetway animation block");
}
await writeFile(targetPath, source.replace(before, after), "utf8");
console.log("Source-only runtime patch applied: supplied A1 jetway motion now follows real elapsed time instead of clamped physics-frame time.");
