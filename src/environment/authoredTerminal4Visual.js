// Source-airport branch authority: the old reconstructed PHX Terminal 4 visual
// pipeline is intentionally replaced by the exact KPHX 1.75.1 WED/OBJ source
// loader. Keep this compatibility module only so the existing trainer runtime
// import does not need a second airport-specific code path during migration.

import {
  SOURCE_KPHX_A1_ORIGIN,
  SOURCE_KPHX_TERMINAL4_OBJECTS,
  installSourceKphxTerminal4Visual,
} from "./sourceKphxTerminal4.js";

export const AUTHORED_TERMINAL4_PROFILE = Object.freeze({
  source: "Google Drive/RampReady/New KPHX/KPHX 1.75.1",
  placementSource: "earth.wed.xml",
  modelName: "KPHX 1.75.1 exact Terminal 4 North + South",
  sourcePlacement: SOURCE_KPHX_A1_ORIGIN,
  placementAuthority: "exact KPHX 1.75.1 WED placements from Gate A1 source origin",
  materialPass: "exact-source-embedded-day-and-lit-textures",
  detailLevel: "exact-user-drive-kphx-1.75.1-terminal4",
  objects: SOURCE_KPHX_TERMINAL4_OBJECTS,
});

export async function installAuthoredTerminal4Visual(THREE, environment) {
  return installSourceKphxTerminal4Visual(THREE, environment);
}
