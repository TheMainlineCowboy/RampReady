import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";

// Historical versions of this stage inserted a generated white bulkhead into
// the Rotunda and then took acceptance telemetry before a later migration
// removed it. That made the evidence describe an intermediate scene rather
// than the scene that shipped. Build the final connector first instead.
await import(`./prepare-a1-straight-solid-vestibule-v1.mjs?straight-solid=${Date.now()}`);
await import(`./prepare-a1-readiness-compact-wall-v1.mjs?source-measured-readiness=${Date.now()}`);

// Replace all legacy compact relocation/readiness expressions before deciding
// whether the old photo-distance symbol is truly unused. This finalizer runs
// here for visual acceptance and again at the end of production preparation so
// no later compatibility migration can regain geometry ownership.
await import(`./prepare-a1-real-terminal-final-geometry-v1.mjs?pre-visual-real-wall=${Date.now()}`);

let installation = fs.readFileSync(installationPath, "utf8");

// Two legacy rigid-parent compatibility lines survived the broader finalizer:
// one rebuilt a desired distance from the old 2.4 m constant and one imposed a
// compact-reference ceiling. At this point sourceTerminalDistance is already
// the measured structural Terminal 4 wall-ray distance; terminalDistance is
// deliberately computed only after the parent has been moved and remeasured.
// Use the source measurement here so the Rotunda returns to the source A1 pivot
// without reading a later const in its temporal dead zone.
installation = installation.replace(
  "  const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS;",
  "  const desiredTerminalDistance = sourceTerminalDistance;",
);
installation = installation.replace(
  /  if \(A1_PHOTO_VISIBLE_VESTIBULE_METERS > 3\) \{\n    throw new Error\(`A1 photo vestibule exceeds the compact-reference limit: \$\{A1_PHOTO_VISIBLE_VESTIBULE_METERS\}`\);\n  \}\n/,
  "",
);
installation = installation.replace(
  /^const A1_PHOTO_VISIBLE_VESTIBULE_METERS = [^;]+;\n/m,
  "",
);
if (installation.includes("A1_PHOTO_VISIBLE_VESTIBULE_METERS")) {
  const survivors = installation
    .split("\n")
    .filter((line) => line.includes("A1_PHOTO_VISIBLE_VESTIBULE_METERS"))
    .join(" | ");
  throw new Error(`${installationPath}: executable 2.4 m photo-distance dependency survived final real-wall geometry: ${survivors}`);
}
if (!installation.includes("const desiredTerminalDistance = sourceTerminalDistance;")) {
  throw new Error(`${installationPath}: final rigid-parent desired distance is not sourced from the structural Terminal 4 wall ray`);
}
for (const forbidden of [
  "const desiredTerminalDistance = terminalDistance;",
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "UploadedAirportJetwayA1TerminalSolidBulkhead",
  "same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1",
  "compact-reference limit",
]) {
  if (installation.includes(forbidden)) {
    throw new Error(`${installationPath}: generated/compact or declaration-order-broken Rotunda geometry survived final connector preparation: ${forbidden}`);
  }
}
fs.writeFileSync(installationPath, installation, "utf8");

await import(`./prepare-a1-visual-acceptance-evidence-v1.mjs?visual-acceptance=${Date.now()}`);

console.log("Prepared A1 visual acceptance from the finalized source-measured Terminal 4 wall geometry: no fake Rotunda bulkhead, no executable 2.4 m relocation, exact supplied Rotunda preserved, and the rigid parent uses the already-available structural wall-ray distance before the post-relocation distance is measured.");
