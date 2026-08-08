import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";

// Historical versions of this stage inserted a generated white bulkhead into
// the Rotunda and then took acceptance telemetry before a later migration
// removed it. That made the evidence describe an intermediate scene rather
// than the scene that shipped. Build the final connector first instead.
await import(`./prepare-a1-straight-solid-vestibule-v1.mjs?straight-solid=${Date.now()}`);

let installation = fs.readFileSync(installationPath, "utf8");

// By this point all legacy compatibility migrations that referenced the 2.4 m
// photo constant have already executed. The real-wall connector/finalizer no
// longer uses it. Remove the stale declaration and fail if any executable use
// remains so a compact relocation cannot silently survive into acceptance.
installation = installation.replace(
  /^const A1_PHOTO_VISIBLE_VESTIBULE_METERS = [^;]+;\n/m,
  "",
);
if (installation.includes("A1_PHOTO_VISIBLE_VESTIBULE_METERS")) {
  throw new Error(`${installationPath}: executable 2.4 m photo-distance dependency survived the real-wall connector migration`);
}
for (const forbidden of [
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "UploadedAirportJetwayA1TerminalSolidBulkhead",
  "same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1",
]) {
  if (installation.includes(forbidden)) {
    throw new Error(`${installationPath}: generated Rotunda masking geometry survived final connector preparation: ${forbidden}`);
  }
}
fs.writeFileSync(installationPath, installation, "utf8");

await import(`./prepare-a1-readiness-compact-wall-v1.mjs?source-measured-readiness=${Date.now()}`);
await import(`./prepare-a1-real-terminal-final-geometry-v1.mjs?pre-visual-real-wall=${Date.now()}`);
await import(`./prepare-a1-visual-acceptance-evidence-v1.mjs?visual-acceptance=${Date.now()}`);

console.log("Prepared A1 visual acceptance from the final source-measured Terminal 4 wall geometry: no fake Rotunda bulkhead, no executable 2.4 m relocation, exact supplied Rotunda preserved, and only the real connector seam is accepted.");
