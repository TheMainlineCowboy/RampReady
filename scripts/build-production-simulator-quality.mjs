import { readFile, writeFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";

const terminalTrainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const terminalTrainer = new URL(`../${terminalTrainerPath}`, import.meta.url);
const committedTerminalTrainer = execFileSync(
  "git",
  ["show", `HEAD:${terminalTrainerPath}`],
  { encoding: "utf8" },
);
if (!committedTerminalTrainer.includes("export default function RampReadyStandupTrainer")) {
  throw new Error("Could not read the committed Terminal 4 trainer baseline from HEAD.");
}

function runNode(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

let buildError;
try {
  await runNode("scripts/prepare-full-airport-inspection-route.mjs");
  await runNode("scripts/prepare-inspection-route-lifecycle.mjs");
  await runNode("scripts/prepare-inspection-preset-telemetry.mjs");
  await runNode("scripts/prepare-terminal4-a1-legacy-block-filter.mjs");
  await import(`./run-production-with-a1-authored-filter-cleanup.mjs?simulator-quality=${Date.now()}`);
} catch (error) {
  buildError = error;
}

let restorationError;
try {
  await writeFile(terminalTrainer, committedTerminalTrainer, "utf8");
  const restored = await readFile(terminalTrainer, "utf8");
  if (restored !== committedTerminalTrainer) {
    throw new Error("Simulator-quality production wrapper failed to restore the committed Terminal 4 trainer exactly.");
  }
} catch (error) {
  restorationError = error;
}

if (buildError && restorationError) {
  throw new AggregateError(
    [buildError, restorationError],
    "Simulator-quality production build failed and Terminal 4 trainer restoration also failed.",
  );
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;
console.log("RampReady simulator-quality production build preserved the framed A1 terminal attachment, surgically removed the three exact authored A1 legacy boxes, retained the source-shaped facade pass, added full-airport A1-to-B15 inspection routing with synchronous preset telemetry, then restored the exact committed trainer and authored-terminal baselines.");
