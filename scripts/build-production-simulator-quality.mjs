import { readFile, writeFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";

const protectedSourcePaths = Object.freeze([
  "src/components/RampReadyStandupTrainerTerminal4.jsx",
  "src/environment/sourcePlacedTerminal4Jetways.js",
  "src/environment/authoredTerminal4Visual.js",
]);
const committedSources = new Map(protectedSourcePaths.map((sourcePath) => [
  sourcePath,
  execFileSync("git", ["show", `HEAD:${sourcePath}`], { encoding: "utf8" }),
]));
if (!committedSources.get(protectedSourcePaths[0])?.includes("export default function RampReadyStandupTrainer")) {
  throw new Error("Could not read the committed Terminal 4 trainer baseline from HEAD.");
}
if (!committedSources.get(protectedSourcePaths[1])?.includes("buildSourcePlacedTerminal4Jetways")) {
  throw new Error("Could not read the committed Terminal 4 jetway baseline from HEAD.");
}
if (!committedSources.get(protectedSourcePaths[2])?.includes("installAuthoredTerminal4Visual")) {
  throw new Error("Could not read the committed authored Terminal 4 baseline from HEAD.");
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
  await runNode("scripts/prepare-simulator-render-quality.mjs");
  await runNode("scripts/prepare-terminal4-a1-legacy-block-filter.mjs");
  await runNode("scripts/prepare-terminal4-jetway-simulator-polish.mjs");
  await runNode("scripts/prepare-a1-terminal-attachment-v14.mjs");
  await import(`./run-production-with-a1-authored-filter-cleanup.mjs?simulator-quality=${Date.now()}`);
} catch (error) {
  buildError = error;
}

let restorationError;
try {
  for (const [sourcePath, committedSource] of committedSources) {
    await writeFile(new URL(`../${sourcePath}`, import.meta.url), committedSource, "utf8");
  }
  for (const [sourcePath, committedSource] of committedSources) {
    const restored = await readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8");
    if (restored !== committedSource) {
      throw new Error(`Simulator-quality production wrapper failed to restore ${sourcePath} exactly.`);
    }
  }
} catch (error) {
  restorationError = error;
}

if (buildError && restorationError) {
  throw new AggregateError(
    [buildError, restorationError],
    "Simulator-quality production build failed and protected source restoration also failed.",
  );
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;
console.log("RampReady simulator-quality production build preserved the framed A1 terminal attachment, anchored A1 to the nearest real vertical Terminal 4 wall surface, surgically removed the three exact authored A1 legacy boxes, retained the source-shaped facade pass, applied the Terminal 4 jetway simulator polish, added full-airport A1-to-B15 inspection routing with synchronous preset telemetry and balanced rendering, then restored the exact committed trainer, jetway and authored-terminal baselines.");
