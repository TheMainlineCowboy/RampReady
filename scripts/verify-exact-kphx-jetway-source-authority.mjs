#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const jetwayLoader = await readFile(new URL("../src/environment/sourceKphxJetways.js", import.meta.url), "utf8");
const wrapper = await readFile(new URL("../src/environment/authoredTerminal4Visual.js", import.meta.url), "utf8");
const exactResource = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";

for (const required of [
  "KPHX-1.75.1-earth.wed.xml",
  exactResource,
  "EXPECTED_PLACEMENT_COUNT = 108",
  "A1_FACADE_OBJECT_ID = 104804",
  "blocked-missing-exact-xplane-Jetway_1_solid.fac",
  'substitutionPolicy: "forbidden"',
  "exact-WED-footprints-anchors-only-visible-geometry-fail-closed-v1",
  "authoredTerminal4UploadedJetwayPlacementCount = EXPECTED_PLACEMENT_COUNT",
  "authoredTerminal4UploadedJetwayVerifiedModelCount = 0",
  "exactKphxJetwaySubstitutionAllowed = false",
]) {
  if (!jetwayLoader.includes(required)) throw new Error(`Exact KPHX jetway source authority is missing: ${required}`);
}
for (const forbidden of [
  "Airport_Jetway.glb",
  "GLTFLoader",
  "createModelSpaceA1Controller",
  "InstancedMesh",
  "exact-user-supplied-Airport_Jetway.glb-plus-KPHX-1.75.1-WED",
  "exact-uploaded-airport-jetway-WED-path-inward-telescope",
]) {
  if (jetwayLoader.includes(forbidden)) throw new Error(`Non-source jetway substitution survived exact KPHX branch: ${forbidden}`);
}
if (!wrapper.includes("installSourceKphxWEDJetways")) throw new Error("Exact WED jetway placement authority is not attached to the source airport frame");
if (!wrapper.includes("authored-airport-objects-and-WED-jetway-placement-authority")) throw new Error("Source airport wrapper falsely claims resolved visible WED jetway geometry");
if (wrapper.includes("authored-airport-objects-and-WED-jetways\"")) throw new Error("Source airport wrapper still claims unresolved WED jetways are visibly installed");

console.log(JSON.stringify({
  authority: "KPHX-1.75.1-WED-jetway-source-fail-closed-v1",
  placementCount: 108,
  visibleGeometryResource: exactResource,
  visibleGeometryResolved: false,
  substitutionsAllowed: false,
  blocker: "Exact stock X-Plane Jetway_1_solid.fac geometry/material definition is not present in the supplied KPHX/MisterX/CDB/support-library source tree currently available in Drive",
}, null, 2));
