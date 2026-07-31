import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const trackedRuntimeFiles = [
  new URL("../src/components/RampReadyStandupTrainerTerminal4.jsx", import.meta.url),
  new URL("../src/environment/sourcePlacedTerminal4Jetways.js", import.meta.url),
];
const originals = new Map();
for (const file of trackedRuntimeFiles) originals.set(file.href, await readFile(file, "utf8"));

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
  await runNode("scripts/prepare-a1-terminal-connector-v11.mjs");
  await runNode("scripts/prepare-full-airport-inspection-route.mjs");
  await import(`./build-production.mjs?simulator-quality=${Date.now()}`);
} catch (error) {
  buildError = error;
}

let restorationError;
try {
  for (const file of trackedRuntimeFiles) {
    await writeFile(file, originals.get(file.href), "utf8");
  }
  for (const file of trackedRuntimeFiles) {
    const restored = await readFile(file, "utf8");
    if (restored !== originals.get(file.href)) {
      throw new Error(`Simulator-quality production wrapper failed to restore ${file.pathname} exactly.`);
    }
  }
} catch (error) {
  restorationError = error;
}

if (buildError && restorationError) {
  throw new AggregateError(
    [buildError, restorationError],
    "Simulator-quality production build failed and tracked-source restoration also failed.",
  );
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;
console.log("RampReady simulator-quality production build passed with A1 terminal attachment and full-airport inspection routing, then restored tracked source exactly.");
