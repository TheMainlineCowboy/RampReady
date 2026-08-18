import { readFile, writeFile } from "node:fs/promises";

const buildPath = new URL("./build-production.mjs", import.meta.url);
const originalBuildSource = await readFile(buildPath, "utf8");
const runtimeAnchor = '  await run(npmCommand, ["run", "prepare:runtime"]);\n';
const clearanceCall = '  await run(process.execPath, ["scripts/prepare-a1-aircraft-side-service-stair-clearance-v1.mjs"]);\n';

if (!originalBuildSource.includes(runtimeAnchor)) {
  throw new Error("RampReady final production build no longer exposes the prepare:runtime hook required for A1 service-stair clearance");
}
if (originalBuildSource.includes("prepare-a1-aircraft-side-service-stair-clearance-v1.mjs")) {
  throw new Error("RampReady build already contains the A1 service-stair clearance hook; remove the temporary wrapper instead of duplicating it");
}

const preparedBuildSource = originalBuildSource.replace(runtimeAnchor, `${runtimeAnchor}${clearanceCall}`);
if (!preparedBuildSource.includes(clearanceCall.trim())) {
  throw new Error("RampReady failed to install the final A1 service-stair clearance hook");
}

let buildError;
let restorationError;
try {
  await writeFile(buildPath, preparedBuildSource, "utf8");
  await import(`./build-production.mjs?a1-service-stair-clearance=${Date.now()}`);
} catch (error) {
  buildError = error;
} finally {
  try {
    await writeFile(buildPath, originalBuildSource, "utf8");
    const restored = await readFile(buildPath, "utf8");
    if (restored !== originalBuildSource) {
      throw new Error("RampReady failed to restore build-production.mjs byte-for-byte after A1 service-stair build");
    }
  } catch (error) {
    restorationError = error;
  }
}

if (buildError && restorationError) {
  throw new AggregateError(
    [buildError, restorationError],
    "RampReady A1 service-stair production build failed and build wrapper restoration also failed",
  );
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;

console.log("RampReady production artifact applied the measured exact-GLB A1 service-stair clearance after all runtime generation, then restored build-production.mjs byte-for-byte.");
