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

const signProjectionMarker = "const taxiwaySigns = (airport.taxiwaySigns ?? []).map((sign) =>";
if (!builder.includes(signProjectionMarker)) {
  const anchor = "align();\nconst binName = \"kphx-ground.bin\";";
  const replacement = `const taxiwaySigns = (airport.taxiwaySigns ?? []).map((sign) => {
  const [x, z] = toScene(sign.longitude, sign.latitude);
  return {
    sourceRecordOffset: sign.sourceRecordOffset,
    sourceRecordSize: sign.sourceRecordSize,
    sourceFormat: sign.sourceFormat,
    x,
    z,
    headingDegrees: sign.headingDegrees,
    size: sign.size,
    justification: sign.justification,
    label: sign.label,
  };
});

align();
const binName = "kphx-ground.bin";`;
  if (!builder.includes(anchor)) throw new Error("KPHX taxiway-sign projection anchor is missing");
  builder = builder.replace(anchor, replacement);
}
if (!builder.includes('detailLevel: "airport-wide-source-runways-taxiways-hold-shorts-signs-v2"')) {
  builder = builder.replace(
    'detailLevel: "airport-wide-source-runways-taxiways-hold-shorts-v1"',
    'detailLevel: "airport-wide-source-runways-taxiways-hold-shorts-signs-v2"',
  );
}
if (!builder.includes("taxiwaySignRecords: airport.taxiwaySignRecordCount ?? 0,")) {
  const anchor = "    centerlineLightSegments,\n";
  const replacement = `${anchor}    taxiwaySignRecords: airport.taxiwaySignRecordCount ?? 0,
    taxiwaySigns: taxiwaySigns.length,
`;
  if (!builder.includes(anchor)) throw new Error("KPHX taxiway-sign count anchor is missing");
  builder = builder.replace(anchor, replacement);
}
if (!builder.includes("  taxiwaySigns,\n  runways: runwayDetails,")) {
  const anchor = "  taxiwayNames: airport.taxiwayNames,\n  runways: runwayDetails,";
  const replacement = "  taxiwayNames: airport.taxiwayNames,\n  taxiwaySigns,\n  runways: runwayDetails,";
  if (!builder.includes(anchor)) throw new Error("KPHX taxiway-sign manifest anchor is missing");
  builder = builder.replace(anchor, replacement);
}
for (const token of [
  signProjectionMarker,
  'detailLevel: "airport-wide-source-runways-taxiways-hold-shorts-signs-v2"',
  "taxiwaySignRecords: airport.taxiwaySignRecordCount ?? 0",
  "taxiwaySigns: taxiwaySigns.length",
  "  taxiwaySigns,\n  runways: runwayDetails,",
]) requireToken(builder, token, "KPHX simulator sign builder");
fs.writeFileSync(builderPath, builder, "utf8");

const materializerPath = "scripts/materialize-kphx-ground.mjs";
let materializer = fs.readFileSync(materializerPath, "utf8");
if (materializer.includes("primitiveCount: 5,")) materializer = materializer.replace("primitiveCount: 5,", "primitiveCount: 6,");
requireToken(materializer, "primitiveCount: 6,", "KPHX materializer primitive contract");

const signDecoderCall = 'run(path.resolve("scripts/decode-kphx-taxiway-signs.mjs"), [bglPath, inspectionPath], "KPHX taxiway sign decoding");';
if (!materializer.includes(signDecoderCall)) {
  const anchor = 'run(path.resolve("scripts/decode-kphx-runways.mjs"), [bglPath, inspectionPath], "KPHX runway decoding");\n';
  if (!materializer.includes(anchor)) throw new Error("KPHX taxiway-sign decoder call anchor is missing");
  materializer = materializer.replace(anchor, `${anchor}${signDecoderCall}\n`);
}
if (!materializer.includes('if (!(inspection.selected.taxiwaySigns?.length > 0))')) {
  const anchor = 'if (inspection.selected.runways?.length !== EXPECTED.runways) throw new Error(`Decoded runway count is ${inspection.selected.runways?.length}`);\n';
  const replacement = `${anchor}if (!(inspection.selected.taxiwaySigns?.length > 0)) throw new Error("Decoded KPHX taxiway sign set is empty");
`;
  if (!materializer.includes(anchor)) throw new Error("KPHX decoded-sign assertion anchor is missing");
  materializer = materializer.replace(anchor, replacement);
}
if (!materializer.includes("taxiwaySignRecords: inspection.selected.taxiwaySignRecordCount,")) {
  const anchor = "    runways: EXPECTED.runways,\n";
  const replacement = `${anchor}    taxiwaySignRecords: inspection.selected.taxiwaySignRecordCount,
    taxiwaySigns: inspection.selected.taxiwaySigns.length,
`;
  if (!materializer.includes(anchor)) throw new Error("KPHX sign count contract anchor is missing");
  materializer = materializer.replace(anchor, replacement);
}
if (!materializer.includes("  taxiwaySigns: groundManifest.taxiwaySigns,")) {
  const anchor = "  taxiwayNames: groundManifest.taxiwayNames,\n  runways: groundManifest.runways,";
  const replacement = "  taxiwayNames: groundManifest.taxiwayNames,\n  taxiwaySigns: groundManifest.taxiwaySigns,\n  runways: groundManifest.runways,";
  if (!materializer.includes(anchor)) throw new Error("KPHX runtime sign manifest anchor is missing");
  materializer = materializer.replace(anchor, replacement);
}
materializer = materializer.replace(
  'remainingSourceLayers: ["taxiway sign object records", "external simulator-library jetway geometry", "missing PHX_TERM400 diffuse maps"],',
  'remainingSourceLayers: ["exact recovered Terminal 4 texture activation", "airport-wide sign visual installation"],',
);
for (const token of [
  signDecoderCall,
  'if (!(inspection.selected.taxiwaySigns?.length > 0))',
  "taxiwaySignRecords: inspection.selected.taxiwaySignRecordCount",
  "taxiwaySigns: inspection.selected.taxiwaySigns.length",
  "taxiwaySigns: groundManifest.taxiwaySigns",
]) requireToken(materializer, token, "KPHX sign materializer");
fs.writeFileSync(materializerPath, materializer, "utf8");

console.log("Prepared KPHX simulator ground builder: all FSX path surfaces remain active and exact source taxiway signs are decoded into the runtime manifest.");
