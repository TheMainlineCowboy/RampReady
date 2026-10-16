import { readFile } from "node:fs/promises";

const inventoryPath = new URL("../docs/environment/terminal4-source-inventory.json", import.meta.url);
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));

const fail = (message) => {
  throw new Error(`Terminal 4 source inventory verification failed: ${message}`);
};

if (inventory.schemaVersion !== 2) fail("schemaVersion must be 2");
if (inventory.sourceRepository?.repository !== "TheMainlineCowboy/SkyHarborPhx") fail("source repository is not pinned");
if (inventory.sourceRepository?.sourceCommit !== "7422b5bdaa2112db70072bfd01a802dd42e86f6a") fail("source commit is not pinned to the verified SkyHarborPhx revision");
if (inventory.sourceRepository?.runtimeImportAllowed !== false) fail("raw legacy scenery must remain blocked from runtime use");
if (inventory.corridor?.startGate !== "B15" || inventory.corridor?.endGate !== "A1") fail("operational corridor endpoints changed");
if (inventory.corridor?.finalCoordinatesMayBeEyeballed !== false) fail("final gate coordinates must not be eyeballed");

const artifacts = inventory.requiredSourceArtifacts ?? [];
const requiredBlobPins = new Map([
  ["scenery/term4.BGL", "c2c6cefe0fc2e7b2dc222d59386b7e4cfa7e6449"],
  ["scenery/KPHX_ADEX.BGL", "fa185427e154eb92058e755b9fbdb1ad799317ed"],
]);

for (const [path, sourceBlobSha] of requiredBlobPins) {
  const artifact = artifacts.find((candidate) => candidate.path === path);
  if (!artifact) fail(`missing required source artifact ${path}`);
  if (artifact.sourceBlobSha !== sourceBlobSha) fail(`source blob pin changed for ${path}`);
  if (!/^[0-9a-f]{40}$/.test(artifact.sourceBlobSha)) fail(`invalid Git blob SHA for ${path}`);
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
if (!rules.some((rule) => rule.includes("source commit and blob pins"))) fail("source identity verification rule is missing");
if (!rules.some((rule) => rule.includes("do not copy raw BGL"))) fail("raw legacy runtime exclusion is missing");

const gates = inventory.releaseGates ?? [];
if (!gates.some((gate) => gate.includes("blob identities"))) fail("source blob identity release gate is missing");
if (!gates.some((gate) => gate.includes("debug markers"))) fail("developer visualization gate is missing");
if (!gates.some((gate) => gate.includes("GitHub Pages"))) fail("GitHub Pages hosting gate is missing");

console.log("Terminal 4 source inventory contract passed with verified source commit and BGL blob pins.");
