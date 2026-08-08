import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const residualFailure = "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6";
const installationAnchor = "installationAuthority !== UPLOADED_JETWAY_INSTALLATION_CORRECTION_AUTHORITY";

if (!source.includes("const fleetGroundOffset") || !source.includes("const bogieTireCorrection")) {
  throw new Error(`${readinessPath}: final fleet/bogie telemetry declarations are missing`);
}

if (!source.includes(residualFailure)) {
  if (!source.includes(installationAnchor)) {
    throw new Error(`${readinessPath}: installation readiness anchor is missing for final ground-contact guard`);
  }
  source = source.replace(
    installationAnchor,
    `${installationAnchor}\n            || ${residualFailure}`,
  );
  fs.writeFileSync(readinessPath, source, "utf8");
}

console.log("Ensured final exact-model bogie ground-contact residual remains fail-closed before semantic readiness normalization.");
await import(`./normalize-final-jetway-readiness-after-runtime.mjs?ground-contact-guard=${Date.now()}`);
