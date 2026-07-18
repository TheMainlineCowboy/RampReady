import { readFile } from "node:fs/promises";

const inventoryPath = new URL("../docs/environment/terminal4-source-inventory.json", import.meta.url);
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));

const fail = (message) => {
  throw new Error(`Terminal 4 source inventory verification failed: ${message}`);
};

if (inventory.schemaVersion !== 1) fail("schemaVersion must be 1");
if (inventory.sourceRepository?.repository !== "TheMainlineCowboy/SkyHarborPhx") fail("source repository is not pinned");
if (inventory.sourceRepository?.runtimeImportAllowed !== false) fail("raw legacy scenery must remain blocked from runtime use");
if (inventory.corridor?.startGate !== "B15" || inventory.corridor?.endGate !== "A1") fail("operational corridor endpoints changed");
if (inventory.corridor?.finalCoordinatesMayBeEyeballed !== false) fail("final gate coordinates must not be eyeballed");

const artifacts = inventory.requiredSourceArtifacts ?? [];
for (const required of ["scenery/term4.BGL", "scenery/KPHX_ADEX.BGL"]) {
  if (!artifacts.some((artifact) => artifact.path === required)) fail(`missing required source artifact ${required}`);
}

const requirements = new Set(inventory.gateManifestRequirements ?? []);
for (const requirement of [
  "gate identifier",
  "source-derived world coordinates",
  "RampReady local coordinates",
  "aircraft nose heading",
  "nose-gear starting location",
  "tug approach and capture spawn",
  "safe pushback start direction",
  "coordinate provenance",
  "manual correction history",
]) {
  if (!requirements.has(requirement)) fail(`missing gate-manifest requirement: ${requirement}`);
}

const rules = inventory.extractionRules ?? [];
if (!rules.some((rule) => rule.includes("B15-to-A1"))) fail("corridor-only extraction rule is missing");
if (!rules.some((rule) => rule.includes("manual correction"))) fail("manual-correction provenance rule is missing");
if (!rules.some((rule) => rule.includes("do not copy raw BGL"))) fail("raw legacy runtime exclusion is missing");

const gates = inventory.releaseGates ?? [];
if (!gates.some((gate) => gate.includes("debug markers"))) fail("developer visualization gate is missing");
if (!gates.some((gate) => gate.includes("GitHub Pages"))) fail("GitHub Pages hosting gate is missing");

console.log("Terminal 4 source inventory contract passed.");
