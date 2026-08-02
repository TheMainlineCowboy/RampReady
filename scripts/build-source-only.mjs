import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const runtimePath = path.resolve("src/components/RampReadyStandupTrainerTerminal4.jsx");
const originalRuntime = await readFile(runtimePath);

function run(command, args, label) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

try {
  run(process.execPath, ["scripts/materialize-authored-aircraft-clean.mjs"], "authored aircraft materialization");
  run(process.execPath, ["scripts/materialize-standup-tug-runtime.mjs"], "stand-up tug materialization");
  run(process.execPath, ["scripts/materialize-terminal4-package-first.mjs"], "Terminal 4 source materialization");
  run(process.execPath, ["scripts/materialize-kphx-ground.mjs"], "KPHX source ground materialization");
  run(process.execPath, ["scripts/prepare-a1-jetway-clocked-motion.mjs"], "A1 wall-clock animation preparation");
  run(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "build"], "Vite production build");
} finally {
  await writeFile(runtimePath, originalRuntime);
}

console.log("Built the source-only RampReady production artifact and restored the tracked runtime byte-for-byte.");
