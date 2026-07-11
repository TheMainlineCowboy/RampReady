import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const before = await readFile(trainerPath, "utf8");

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/prepare-runtime.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`Runtime preparation repeat failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
  });
});

const after = await readFile(trainerPath, "utf8");
if (after !== before) {
  console.error("RampReady runtime idempotence failed: a second preparation pass changed the already-prepared trainer source.");
  process.exit(1);
}

console.log("RampReady runtime idempotence passed: repeated preparation produced no source changes.");
