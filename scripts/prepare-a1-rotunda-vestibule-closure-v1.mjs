import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const PHOTO_VISIBLE_VESTIBULE_METERS = 2.4;

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

// The structural wall ray identifies the real Terminal 4 wall; it is not the
// desired wall-to-Rotunda spacing. Reusing the full source ray as the desired
// parent distance recreated an 18+ metre terminal leg in the rendered runtime.
// Keep that wall point fixed, then move the COMPLETE authored A1 parent so the
// terminal-facing Rotunda collar sits one short photo-matched vestibule away.
// No supplied child is translated or rotated independently.
installation = installation.replace(
  "  const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS;",
  `  const desiredTerminalDistance = rotundaOpening.collarRadius + ${PHOTO_VISIBLE_VESTIBULE_METERS};`,
);
installation = installation.replace(
  "  const desiredTerminalDistance = sourceTerminalDistance;",
  `  const desiredTerminalDistance = rotundaOpening.collarRadius + ${PHOTO_VISIBLE_VESTIBULE_METERS};`,
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
  throw new Error(`${installationPath}: stale photo-distance symbol survived final real-wall geometry: ${survivors}`);
}
const finalDesiredDistance = `const desiredTerminalDistance = rotundaOpening.collarRadius + ${PHOTO_VISIBLE_VESTIBULE_METERS};`;
if (!installation.includes(finalDesiredDistance)) {
  throw new Error(`${installationPath}: final rigid-parent desired distance is not the short photo-matched wall-to-Rotunda spacing`);
}
for (const forbidden of [
  "const desiredTerminalDistance = sourceTerminalDistance;",
  "const desiredTerminalDistance = terminalDistance;",
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "UploadedAirportJetwayA1TerminalSolidBulkhead",
  "same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1",
  "compact-reference limit",
]) {
  if (installation.includes(forbidden)) {
    throw new Error(`${installationPath}: generated/long-corridor or declaration-order-broken Rotunda geometry survived final connector preparation: ${forbidden}`);
  }
}
fs.writeFileSync(installationPath, installation, "utf8");

await import(`./prepare-a1-visual-acceptance-evidence-v1.mjs?visual-acceptance=${Date.now()}`);

console.log(`Prepared A1 visual acceptance with the real structural Terminal 4 wall fixed and the complete authored A1 parent relocated to a ${PHOTO_VISIBLE_VESTIBULE_METERS.toFixed(1)} m solid white wall-to-Rotunda vestibule; no fake Rotunda bulkhead, no long source-ray corridor, and no isolated supplied-node transform.`);
