import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const residualFailure = "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6";
const installationAnchor = "installationAuthority !== UPLOADED_JETWAY_INSTALLATION_CORRECTION_AUTHORITY";
const terminalConnectionAnchor = "a1TerminalConnectionAuthority !== UPLOADED_JETWAY_A1_TERMINAL_CONNECTION_AUTHORITY";
const legacyBogieGuard = "!(bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1)";

if (!source.includes("const fleetGroundOffset") || !source.includes("const bogieTireCorrection")) {
  throw new Error(`${readinessPath}: final fleet/bogie telemetry declarations are missing`);
}

if (!source.includes(residualFailure)) {
  const candidates = [installationAnchor, legacyBogieGuard, terminalConnectionAnchor];
  const anchor = candidates.find((candidate) => source.includes(candidate));
  if (!anchor) {
    throw new Error(`${readinessPath}: no semantic readiness anchor is available for the final ground-contact guard`);
  }
  source = source.replace(
    anchor,
    `${residualFailure}\n            || ${anchor}`,
  );
  fs.writeFileSync(readinessPath, source, "utf8");
}

console.log("Ensured final exact-model bogie ground-contact residual remains fail-closed before semantic readiness normalization.");
await import(`./normalize-final-jetway-readiness-after-runtime.mjs?ground-contact-guard=${Date.now()}`);
