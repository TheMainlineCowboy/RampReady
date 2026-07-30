import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const terminal4TrainerPath = new URL("../src/components/RampReadyStandupTrainerTerminal4.jsx", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);
const originalSource = await readFile(trainerPath, "utf8");
const generatedMobileImport = 'import "./mobile-hud-v9.css";';
const preparedTerminal4Source = await readFile(terminal4TrainerPath, "utf8");
const originalTerminal4Source = preparedTerminal4Source
  .replace(`${generatedMobileImport}\n`, "")
  .replace(`\n${generatedMobileImport}`, "");
const originalPackage = await readFile(packagePath, "utf8");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

let buildError;
try {
  await run(process.execPath, ["scripts/prepare-crj700-model.mjs"]);
  await run(process.execPath, ["scripts/report-source-architecture.mjs"]);
  await run(npmCommand, ["run", "prepare:runtime"]);
  await run(process.execPath, ["scripts/verify-runtime-transform-scope.mjs"]);
  await run(process.execPath, ["scripts/verify-runtime-idempotence.mjs"]);
  await run(process.execPath, ["scripts/verify-current-architecture.mjs"]);
  await run(process.execPath, ["scripts/verify-prepared-runtime.mjs"]);
  await run(process.execPath, ["scripts/verify-lektro-scan-conversion-contract.mjs"]);
  await run(process.execPath, ["scripts/verify-terminal4-source-inventory.mjs"]);
  await run(process.execPath, ["scripts/verify-terminal4-gate-manifest.mjs"]);
  await run(process.execPath, ["scripts/verify-lektro-clearance.mjs"]);
  await run(process.execPath, ["scripts/verify-lektro-proportions.mjs"]);
  await run(process.execPath, ["scripts/verify-nose-gear-seating.mjs"]);
  await run(process.execPath, ["scripts/verify-capture-settling.mjs"]);
  await run(process.execPath, ["scripts/verify-training-route.mjs"]);
  await run(process.execPath, ["scripts/verify-physics.mjs"]);
  await run(process.execPath, ["scripts/verify-partial-throttle.mjs"]);
  await run(process.execPath, ["scripts/verify-tow-kinematics.mjs"]);
  await run(process.execPath, ["scripts/verify-tow-kinematics-module.mjs"]);
  await run(process.execPath, ["scripts/verify-runtime-kinematics-parity.mjs"]);
  await run(npmCommand, ["exec", "--", "vite", "build"]);
} catch (error) {
  buildError = error;
}

let restorationError;
try {
  await writeFile(trainerPath, originalSource, "utf8");
  await writeFile(terminal4TrainerPath, originalTerminal4Source, "utf8");
  const restoredSource = await readFile(trainerPath, "utf8");
  const restoredTerminal4Source = await readFile(terminal4TrainerPath, "utf8");
  const currentPackage = await readFile(packagePath, "utf8");
  if (restoredSource !== originalSource) {
    throw new Error("RampReady production build failed to restore the tracked trainer source exactly.");
  }
  if (restoredTerminal4Source !== originalTerminal4Source || restoredTerminal4Source.includes(generatedMobileImport)) {
    throw new Error("RampReady production build failed to restore the committed Terminal 4 trainer baseline exactly.");
  }
  if (currentPackage !== originalPackage) {
    throw new Error("RampReady production build unexpectedly modified package.json.");
  }
} catch (error) {
  restorationError = error;
}

if (buildError && restorationError) {
  throw new AggregateError(
    [buildError, restorationError],
    "RampReady production build failed and source restoration also failed.",
  );
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;
console.log("RampReady production build passed and restored both tracked trainer sources exactly.");
