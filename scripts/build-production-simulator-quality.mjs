import { readFile, writeFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";

const protectedSourcePaths = Object.freeze([
  "src/components/RampReadyStandupTrainerTerminal4.jsx",
  "src/environment/sourcePlacedTerminal4Jetways.js",
  "src/environment/authoredTerminal4Visual.js",
  "src/environment/authoredKphxGround.js",
  "src/environment/terminal4LowerFacadeSkinV9.js",
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
if (!committedSources.get(protectedSourcePaths[3])?.includes("installAuthoredKphxGround")) {
  throw new Error("Could not read the committed authored KPHX ground baseline from HEAD.");
}
if (!committedSources.get(protectedSourcePaths[4])?.includes("buildTerminal4LowerFacadeSkin")) {
  throw new Error("Could not read the committed Terminal 4 lower-facade baseline from HEAD.");
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
  await runNode("scripts/prepare-kphx-nearfield-pavement-v6.mjs");
  await runNode("scripts/prepare-terminal4-a1-legacy-block-filter.mjs");
  await runNode("scripts/prepare-terminal4-floating-roof-filter.mjs");
  await runNode("scripts/prepare-terminal4-jetway-simulator-polish.mjs");
  await runNode("scripts/prepare-a1-terminal-attachment-v14.mjs");
  await runNode("scripts/prepare-b15-terminal-connectors-v16.mjs");
  await runNode("scripts/prepare-terminal4-static-jetway-parking-v15.mjs");
  await runNode("scripts/prepare-terminal4-ramp-facade-v16.mjs");
  await runNode("scripts/prepare-terminal4-attachment-evidence-v14.mjs");
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
console.log("RampReady simulator-quality production build preserved the framed, windowed and grounded A1 terminal attachment, anchored A1 to the exact supplied BGATE1 wall plane, removed the two exact floating black Terminal 4 roof slabs, connected both B15 regional rotundas to the supplied BGATE3 wall with supported fixed walkways, parked all remaining unoccupied Terminal 4 jetways in varied retracted positions, replaced the repeated nearfield grid with a large source-derived pavement field, replaced repeated dark ramp bays with broad supplied wall geometry and sparse doors/vents, surgically removed the three exact authored A1 legacy boxes, applied Terminal 4 jetway simulator polish, added terminal-facing A1-to-B15 inspection routing with synchronous telemetry and balanced rendering, then restored every protected committed source exactly.");
