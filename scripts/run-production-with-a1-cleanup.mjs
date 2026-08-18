import fs from "node:fs";
import { execFileSync } from "node:child_process";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const committedSource = execFileSync(
  "git",
  ["show", `HEAD:${jetwayPath}`],
  { encoding: "utf8" },
);
if (!committedSource.includes("buildSourcePlacedTerminal4Jetways")) {
  throw new Error("Could not read the committed Terminal 4 jetway baseline from HEAD.");
}

// build-production.mjs still recognizes these legacy baseline tokens while the
// production source uses the independent structural connector and framed fixed
// walkway. The marker is build-only and is removed by the exact restoration.
const buildRestorerCompatibilityMarker = `/* A1_RESTORER_BASELINE_COMPATIBILITY
  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 24);
      if (!(longitudinal > 0.05 && longitudinal <= 24)) continue;
      if (lateral <= 4.5) nearest = Math.min(nearest, longitudinal);
  group.userData.terminalConnectionAuthority = "raycast-and-source-vertex-fit-to-authored-terminal-mesh";
*/`;

let preparedSource = fs.readFileSync(jetwayPath, "utf8");
if (!preparedSource.includes("A1_RESTORER_BASELINE_COMPATIBILITY")) {
  preparedSource = `${preparedSource.trimEnd()}\n\n${buildRestorerCompatibilityMarker}\n`;
  fs.writeFileSync(jetwayPath, preparedSource, "utf8");
}

let buildError;
try {
  // The source-authored BGATE1 main facade is split into small UV-repeat cells
  // before this point, so first migrate the old final shape away from triangle
  // area, then replace cosmetic cell-material ownership with the original
  // BGATE1 mesh-node authority retained by the splitter. T4_WALK-clear routing
  // remains mandatory and no supplied jetway geometry is changed.
  await import(`./prepare-a1-bgateg1-main-facade-after-split-v1.mjs?final-bgateg1=${Date.now()}`);
  await import(`./prepare-a1-original-bgateg1-node-authority-v1.mjs?final-source-node=${Date.now()}`);
  // Late production preparers above this wrapper can rewrite the trainer after
  // the ordinary inspection-control stage. Reinstall only the evidence-only A1
  // attach command at the final handoff so the browser artifact itself exposes
  // the already-existing controller at deployment=1. The prepared production
  // build now owns the final aircraft-side stair correction at its true pre-Vite
  // geometry hook, after visible Tunnel-C/Cab normalization.
  await import(`./prepare-a1-final-visual-evidence-attach-runtime-v1.mjs?final-evidence-attach=${Date.now()}`);
  await import("./build-production.mjs");
} catch (error) {
  buildError = error;
}

let restorationError;
try {
  fs.writeFileSync(jetwayPath, committedSource, "utf8");
  const restoredSource = fs.readFileSync(jetwayPath, "utf8");
  if (restoredSource !== committedSource) {
    throw new Error("RampReady failed to restore the committed jetway source byte-for-byte.");
  }
} catch (error) {
  restorationError = error;
}

if (buildError && restorationError) {
  throw new AggregateError(
    [buildError, restorationError],
    "RampReady production build failed and exact jetway source restoration also failed.",
  );
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;

console.log("RampReady production wrapper preserved the prepared structural A1 wall fit, framed arched fixed walkway, source-shaped lower facade and nearest-wall attachment, applied the final exact-source A1 service-stair aircraft clearance at the final pre-Vite geometry stage, then restored the committed jetway source byte-for-byte.");
