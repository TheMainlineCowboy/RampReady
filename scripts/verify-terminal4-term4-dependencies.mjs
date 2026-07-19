import { readFile } from "node:fs/promises";

const manifestPath = new URL("../docs/environment/terminal4-term4-dependencies.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const fail = (message) => {
  throw new Error(`Terminal 4 term4 dependency verification failed: ${message}`);
};

if (manifest.schemaVersion !== 1) fail("schemaVersion must be 1");
if (manifest.sourceRepository !== "TheMainlineCowboy/SkyHarborPhx") fail("source repository is not pinned");
if (manifest.sourceArtifact?.path !== "scenery/term4.BGL") fail("term4 source path changed");
if (!/^[0-9a-f]{40}$/.test(manifest.sourceArtifact?.gitBlobSha ?? "")) fail("source blob SHA is invalid");
if (manifest.sourceArtifact?.runtimeImportAllowed !== false) fail("raw BGL must remain blocked from runtime");
if (manifest.nextExtractionStage?.gateCoordinatesMayBePopulated !== false) fail("gate coordinates must remain blocked before ADEX decode");

const refs = manifest.embeddedTextureReferences ?? [];
if (refs.length < 30) fail("embedded texture reference inventory is incomplete");
if (new Set(refs).size !== refs.length) fail("embedded texture references contain duplicates");

for (const required of [
  "PHX_TERM400_0.DDS",
  "PHX_TERM400_0_LM.DDS",
  "PHX_TERM400_1.DDS",
  "PHX_TERM400_1_LM.DDS",
  "PHXRAMPLIGHT.BMP",
  "T4_WALK.BMP",
  "T4_WALK2.BMP",
  "SUPPORTS.BMP",
]) {
  if (!refs.includes(required)) fail(`missing embedded reference ${required}`);
}

for (const ref of refs.filter((name) => name.includes("_LM."))) {
  const base = ref.replace("_LM.", ".");
  if (!refs.includes(base)) fail(`light map ${ref} has no base texture ${base}`);
}

const rules = manifest.dependencyRules ?? {};
if (rules.caseInsensitiveLookupRequired !== true) fail("case-insensitive source lookup is required");
if (rules.lightMapsRemainPaired !== true) fail("light-map pairing rule is required");
if (rules.missingReferencesBlockConversion !== true) fail("missing references must block conversion");
if (rules.corridorFilterRequiredBeforeRuntimeExport !== true) fail("corridor filtering must precede runtime export");
if (rules.rawLegacyAssetsAllowedInPublic !== false) fail("raw legacy assets must remain outside public");

console.log(`Terminal 4 term4 dependency contract passed (${refs.length} embedded texture references).`);
