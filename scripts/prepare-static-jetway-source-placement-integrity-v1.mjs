import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const baseFleetImport = 'import { installUploadedAirportJetwayFleet as installUploadedAirportJetwayFleetBase } from "./uploadedAirportJetwayFleet.js";';
const legacyRegistrationImport = 'import { registerStaticJetwayFleetToFacade } from "./registerStaticJetwayFleetToFacadeV1.js";';
const registrationImport = `import {
  registerStaticJetwayFleetToFacade,
  STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY,
  STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY,
  STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY,
} from "./registerStaticJetwayFleetToFacadeV1.js";`;
const installationCall = "          const installationCorrection = correctUploadedJetwayInstallation(THREE, group, fleet, placements);";
const registrationCall = "          const staticFleetRegistration = registerStaticJetwayFleetToFacade(THREE, group, fleet, placements);";

// The exact replacement GLB has a different authored root/Rotunda convention
// from the stock AIR_Jetway01 object in the KPHX BGL. Preserving raw BGL x/z/yaw
// for the replacement root visibly leaves terminal ends floating in front of the
// concourses. Preserve the BGL-derived gate evidence, but register each complete
// supplied static parent from its measured facade wall point to its gate target.
if (source.includes(legacyRegistrationImport)) {
  source = source.replace(legacyRegistrationImport, registrationImport);
}
if (!source.includes(registrationImport)) {
  if (!source.includes(baseFleetImport)) {
    throw new Error(`${readinessPath}: base fleet import anchor is missing`);
  }
  source = source.replace(baseFleetImport, `${baseFleetImport}\n${registrationImport}`);
}

// Remove the historical override if an older preparation pass left it in the
// working tree, then restore the physical facade-registration call.
const obsoleteStart = "          // Static jetways are already authored at the exact KPHX BGL gate coordinates.";
const obsoleteEnd = "          group.userData.uploadedJetwayStaticFacadeRelocationApplied = false;";
if (source.includes(obsoleteStart)) {
  const start = source.indexOf(obsoleteStart);
  const endStart = source.indexOf(obsoleteEnd, start);
  if (endStart < 0) throw new Error(`${readinessPath}: obsolete static-placement override is incomplete`);
  const end = endStart + obsoleteEnd.length;
  source = `${source.slice(0, start)}${registrationCall}${source.slice(end)}`;
}
if (!source.includes(registrationCall)) {
  if (!source.includes(installationCall)) {
    throw new Error(`${readinessPath}: installation-correction anchor is missing`);
  }
  source = source.replace(installationCall, `${installationCall}\n${registrationCall}`);
}

for (const forbidden of [
  "57-static-exact-bgl-source-placement-no-facade-relocation-v1",
  "uploadedJetwayStaticFacadeRelocationApplied = false",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: obsolete detached-static-jetway override is still active: ${forbidden}`);
  }
}
for (const required of [
  registrationImport,
  "STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY",
  "STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY",
  "STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY",
  registrationCall,
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: measured static terminal-wall registration is missing ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Enforced measured terminal-wall/Rotunda registration for all 57 static supplied jetways with one complete registration-authority import block; raw BGL evidence remains input data but is no longer misused as the replacement GLB model-root pose.");
