import { readFile } from "node:fs/promises";

const dependencies = JSON.parse(await readFile(new URL("../docs/environment/terminal4-term4-dependencies.json", import.meta.url), "utf8"));
const resolution = JSON.parse(await readFile(new URL("../docs/environment/terminal4-texture-resolution.json", import.meta.url), "utf8"));

const fail = (message) => {
  throw new Error(`Terminal 4 texture resolution verification failed: ${message}`);
};

if (resolution.schemaVersion !== 1) fail("schemaVersion must be 1");
if (resolution.sourceRepository !== dependencies.sourceRepository) fail("source repository does not match dependency contract");
if (!/^[0-9a-f]{40}$/.test(resolution.sourceCommit ?? "")) fail("source commit is not pinned");

const embedded = dependencies.embeddedTextureReferences ?? [];
const resolved = resolution.resolved ?? [];
const missing = resolution.missing ?? [];
const mappedReferences = [...resolved.map((item) => item.reference), ...missing.map((item) => item.reference)];

if (resolution.embeddedReferenceCount !== embedded.length) fail("embedded reference count does not match dependency contract");
if (resolution.resolvedCount !== resolved.length) fail("resolved count is incorrect");
if (resolution.missingCount !== missing.length) fail("missing count is incorrect");
if (resolved.length !== 24 || missing.length !== 9) fail("expected 24 resolved and 9 missing source textures");
if (new Set(mappedReferences).size !== mappedReferences.length) fail("a dependency is classified more than once");
if (mappedReferences.length !== embedded.length) fail("not every embedded dependency is classified");

for (const reference of embedded) {
  if (!mappedReferences.includes(reference)) fail(`unclassified embedded dependency ${reference}`);
}

for (const item of resolved) {
  if (!item.sourcePath || item.reference.toLowerCase() !== item.sourcePath.toLowerCase()) {
    fail(`resolved path for ${item.reference} is not a case-insensitive exact match`);
  }
}

for (const requiredMissing of [
  "PHX_TERM400_0.DDS",
  "PHX_TERM400_0_LM.DDS",
  "PHX_TERM400_1.DDS",
  "PHX_TERM400_1_LM.DDS",
  "PHXRAMPLIGHT.BMP",
  "PHXRAMPLIGHT_LM.BMP",
]) {
  if (!missing.some((item) => item.reference === requiredMissing)) fail(`${requiredMissing} must remain recorded as missing`);
}

const gate = resolution.conversionGate ?? {};
if (gate.status !== "blocked-missing-source-dependencies") fail("conversion must remain blocked while dependencies are missing");
if (gate.runtimeExportAllowed !== false) fail("runtime export cannot be allowed");
if (gate.rawLegacyAssetsAllowedInPublic !== false) fail("raw legacy assets must remain outside public");
if (gate.gateCoordinatesMayBePopulated !== false) fail("gate coordinates must remain blocked before ADEX decode");

console.log(`Terminal 4 texture resolution passed (${resolved.length} resolved, ${missing.length} missing; conversion blocked).`);
