import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);
const originalSource = await readFile(trainerPath, "utf8");
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
  await run(npmCommand, ["run", "prepare:runtime"]);
  await run(process.execPath, ["scripts/verify-rampready.mjs"]);
  await run(process.execPath, ["scripts/verify-prepared-runtime.mjs"]);
  await run(process.execPath, ["scripts/verify-lektro-clearance.mjs"]);
  await run(process.execPath, ["scripts/verify-nose-gear-seating.mjs"]);
  await run(process.execPath, ["scripts/verify-physics.mjs"]);
  await run(process.execPath, ["scripts/verify-partial-throttle.mjs"]);
  await run(process.execPath, ["scripts/verify-tow-kinematics.mjs"]);
  await run(npmCommand, ["exec", "--", "vite", "build"]);
} catch (error) {
  buildError = error;
}

let restorationError;
try {
  await writeFile(trainerPath, originalSource, "utf8");
  const restoredSource = await readFile(trainerPath, "utf8");
  const currentPackage = await readFile(packagePath, "utf8");
  if (restoredSource !== originalSource) {
    throw new Error("RampReady production build failed to restore the tracked trainer source exactly.");
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
console.log("RampReady production build passed and restored the tracked trainer source exactly.");