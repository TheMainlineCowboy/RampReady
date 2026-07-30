import fs from "node:fs";

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label} is missing ${token}`);
}

const builderPath = "scripts/build-kphx-simulator-ground.mjs";
let builder = fs.readFileSync(builderPath, "utf8");
const obsoleteCondition = "taxiwayPath.type !== 3 && taxiwayPath.widthMeters > 0.5 && taxiwayPath.drawSurface !== false";
const normalizedCondition = "taxiwayPath.type !== 3 && taxiwayPath.widthMeters > 0.5";
if (builder.includes(obsoleteCondition)) builder = builder.replace(obsoleteCondition, normalizedCondition);
requireToken(builder, normalizedCondition, "KPHX simulator builder path-surface condition");

const signProjectionMarker = "const derivedTaxiwaySigns = (airport.derivedTaxiwaySigns ?? []).map((sign) =>";
if (!builder.includes(signProjectionMarker)) {
  const anchor = "align();\nconst binName = \"kphx-ground.bin\";";
  const replacement = `const derivedTaxiwaySigns = (airport.derivedTaxiwaySigns ?? []).map((sign) => {
  const [x, z] = toScene(sign.longitude, sign.latitude);
  return {
    ...sign,
    x,
    z,
    latitude: undefined,
    longitude: undefined,
  };
});

align();
const binName = "kphx-ground.bin";`;
  if (!builder.includes(anchor)) throw new Error("KPHX derived-sign projection anchor is missing");
  builder = builder.replace(anchor, replacement);
}
if (!builder.includes('detailLevel: "airport-wide-source-runways-taxiways-hold-shorts-derived-signs-v2"')) {
  builder = builder.replace(
    'detailLevel: "airport-wide-source-runways-taxiways-hold-shorts-v1"',
    'detailLevel: "airport-wide-source-runways-taxiways-hold-shorts-derived-signs-v2"',
  );
}
if (!builder.includes("derivedTaxiwaySigns: derivedTaxiwaySigns.length,")) {
  const anchor = "    centerlineLightSegments,\n";
  if (!builder.includes(anchor)) throw new Error("KPHX derived-sign count anchor is missing");
  builder = builder.replace(anchor, `${anchor}    derivedTaxiwaySigns: derivedTaxiwaySigns.length,
    derivedRunwayHoldSigns: derivedTaxiwaySigns.filter((sign) => sign.kind === "runway-hold-position").length,
    derivedIlsHoldSigns: derivedTaxiwaySigns.filter((sign) => sign.kind === "ils-hold-position").length,
`);
}
if (!builder.includes("  derivedTaxiwaySigns,\n  runways: runwayDetails,")) {
  const anchor = "  taxiwayNames: airport.taxiwayNames,\n  runways: runwayDetails,";
  if (!builder.includes(anchor)) throw new Error("KPHX derived-sign manifest anchor is missing");
  builder = builder.replace(anchor, "  taxiwayNames: airport.taxiwayNames,\n  derivedTaxiwaySigns,\n  runways: runwayDetails,");
}
for (const token of [
  signProjectionMarker,
  'detailLevel: "airport-wide-source-runways-taxiways-hold-shorts-derived-signs-v2"',
  "derivedTaxiwaySigns: derivedTaxiwaySigns.length",
  "derivedRunwayHoldSigns:",
  "derivedIlsHoldSigns:",
  "  derivedTaxiwaySigns,\n  runways: runwayDetails,",
]) requireToken(builder, token, "KPHX derived-sign ground builder");
fs.writeFileSync(builderPath, builder, "utf8");

const materializerPath = "scripts/materialize-kphx-ground.mjs";
let materializer = fs.readFileSync(materializerPath, "utf8");
if (materializer.includes("primitiveCount: 5,")) materializer = materializer.replace("primitiveCount: 5,", "primitiveCount: 6,");
requireToken(materializer, "primitiveCount: 6,", "KPHX materializer primitive contract");

const deriveCall = 'run(path.resolve("scripts/derive-kphx-airport-signs.mjs"), [inspectionPath], "KPHX graph-derived signage");';
if (!materializer.includes(deriveCall)) {
  const anchor = 'run(path.resolve("scripts/decode-kphx-runways.mjs"), [bglPath, inspectionPath], "KPHX runway decoding");\n';
  if (!materializer.includes(anchor)) throw new Error("KPHX derived-sign decoder call anchor is missing");
  materializer = materializer.replace(anchor, `${anchor}${deriveCall}\n`);
}
if (!materializer.includes('if (!(inspection.selected.derivedTaxiwaySigns?.length > 0))')) {
  const anchor = 'if (inspection.selected.runways?.length !== EXPECTED.runways) throw new Error(`Decoded runway count is ${inspection.selected.runways?.length}`);\n';
  if (!materializer.includes(anchor)) throw new Error("KPHX derived-sign assertion anchor is missing");
  materializer = materializer.replace(anchor, `${anchor}if (!(inspection.selected.derivedTaxiwaySigns?.length > 0)) throw new Error("KPHX graph-derived sign set is empty");
`);
}
if (!materializer.includes("derivedTaxiwaySigns: groundManifest.derivedTaxiwaySigns,")) {
  const anchor = "  taxiwayNames: groundManifest.taxiwayNames,\n";
  if (!materializer.includes(anchor)) throw new Error("KPHX runtime derived-sign manifest anchor is missing");
  materializer = materializer.replace(anchor, `${anchor}  derivedTaxiwaySigns: groundManifest.derivedTaxiwaySigns,
  signageProvenance: "derived-from-exact-kphx-taxiway-graph-runway-records-and-hold-short-points",
`);
}
materializer = materializer.replace(
  'remainingSourceLayers: ["taxiway sign object records", "external simulator-library jetway geometry", "missing PHX_TERM400 diffuse maps"],',
  'remainingSourceLayers: ["source boundary-fence visualization", "taxiway-junction directional sign expansion"],',
);
materializer = materializer.replace(
  'remainingSourceLayers: ["derived taxiway signage from source graph", "source boundary-fence visualization"],',
  'remainingSourceLayers: ["source boundary-fence visualization", "taxiway-junction directional sign expansion"],',
);
for (const token of [
  deriveCall,
  'if (!(inspection.selected.derivedTaxiwaySigns?.length > 0))',
  "derivedTaxiwaySigns: groundManifest.derivedTaxiwaySigns",
  'signageProvenance: "derived-from-exact-kphx-taxiway-graph-runway-records-and-hold-short-points"',
]) requireToken(materializer, token, "KPHX derived-sign materializer");
fs.writeFileSync(materializerPath, materializer, "utf8");

console.log("Prepared KPHX simulator ground builder: FSX path surfaces remain active and mandatory airport signs are derived from exact taxiway, runway, and hold-short records.");
