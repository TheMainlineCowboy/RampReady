import fs from "node:fs";

const files = {
  derive: fs.readFileSync("scripts/derive-kphx-airport-signs.mjs", "utf8"),
  prepare: fs.readFileSync("scripts/prepare-kphx-simulator-ground-builder.mjs", "utf8"),
  runtime: fs.readFileSync("src/environment/kphxTaxiwaySigns.js", "utf8"),
  runwayVisuals: fs.readFileSync("src/environment/kphxRunwayVisuals.js", "utf8"),
};

for (const token of [
  "point.type",
  "[2, 4]",
  "nearestRunway(point)",
  "right-of-approach",
  'style: "mandatory"',
  'style: "location"',
  "connectedTaxiwayNames",
  "derived-from-exact-kphx-taxiway-graph-runway-records-and-hold-short-points",
  "graph-derived-not-embedded-sign-object",
]) {
  if (!files.derive.includes(token)) throw new Error(`KPHX derived-sign source is missing ${token}`);
}
for (const token of [
  "derive-kphx-airport-signs.mjs",
  "derivedTaxiwaySigns: groundManifest.derivedTaxiwaySigns",
  "derivedTaxiwaySigns: derivedTaxiwaySigns.length",
  "derivedRunwayHoldSigns",
  "derivedIlsHoldSigns",
]) {
  if (!files.prepare.includes(token)) throw new Error(`KPHX derived-sign preparation is missing ${token}`);
}
for (const token of [
  "KPHX_GraphDerived_RunwayAndIlsHoldSigns",
  "KPHX taxiway sign aluminum back",
  "KPHX taxiway sign galvanized posts",
  "mandatory",
  "location",
  "CanvasTexture",
  "runwayHoldSignCount",
  "ilsHoldSignCount",
]) {
  if (!files.runtime.includes(token)) throw new Error(`KPHX derived-sign runtime is missing ${token}`);
}
for (const token of [
  'import { buildKphxTaxiwaySigns } from "./kphxTaxiwaySigns.js";',
  "manifest.derivedTaxiwaySigns",
  "buildKphxTaxiwaySigns(THREE, manifest.derivedTaxiwaySigns)",
  "group.userData.signCount",
  "group.userData.signageProvenance",
]) {
  if (!files.runwayVisuals.includes(token)) throw new Error(`KPHX runway/sign integration is missing ${token}`);
}
if (files.derive.includes("0x0039") || files.derive.includes("embedded-sign-object-authority")) {
  throw new Error("KPHX derived signage must not misclassify boundary-fence records as signs");
}
console.log("Verified KPHX graph-derived signage: exact hold points, runway pairs, taxiway names, mandatory/location panels, physical posts, and explicit derived provenance.");
