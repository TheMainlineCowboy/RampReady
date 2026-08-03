import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleet.js";
let source = fs.readFileSync(path, "utf8");

const axisMarker = "uploaded-source-model-longitudinal-axis-aligned-to-terminal4-heading-v8";
const legacyMarker = "uploaded-source-model-exclusive-bridge-geometry-v8";

const oldHide = `// Replace only the movable fallback jetway. The source-positioned fixed walkway
// and wall collar are the physical terminal connection and must remain visible.
const HIDE_REPLACED = /^(?:AIR_Jetway01_(?!WallCollars)|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;`;
const newHide = `// ${legacyMarker}: the supplied Tunnel_A/Tunnel_B/Tunnel_C/Rotunda/Cab model
// and its measured connector are the only visible bridge assembly. Retaining the
// old AIR_Jetway01 collars, walkways or polish groups creates doubled corridors,
// detached-looking stairs and the false rectangular opening seen at A1.
const HIDE_REPLACED = /^(?:AIR_Jetway01_|Terminal4_(?:FixedWalkway|A1_.*(?:Portal|Walkway|Connector)|LowerFacadeInfillPanels|ClosedServiceDoors|FacadeVentGrilles))/i;`;
if (!source.includes(legacyMarker)) {
  if (!source.includes(oldHide)) throw new Error(`${path}: legacy bridge visibility anchor missing`);
  source = source.replace(oldHide, newHide);
}

const oldAlignment = `  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_AlignedPrototype";
  model.position.set(0.651626, 0.23, 15.12);
  aligned.add(model);`;
const newAlignment = `  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_AlignedPrototype";
  // ${axisMarker}: the supplied FBX model is authored longitudinally on +Z,
  // while the decoded PHX jetway headings place the original AIR_Jetway01 on +X.
  // Rotate only the parent coordinate frame. No supplied mesh, proportion,
  // stair, bogie, cab, rotunda or tunnel transform is changed or rebuilt.
  aligned.rotation.y = Math.PI / 2;
  aligned.userData.authoringAxisCorrectionRadians = Math.PI / 2;
  aligned.userData.authoringAxisAuthority = "${axisMarker}";
  model.position.set(0.651626, 0.23, 15.12);
  aligned.add(model);`;
if (!source.includes(axisMarker)) {
  if (!source.includes(oldAlignment)) throw new Error(`${path}: uploaded model alignment anchor missing`);
  source = source.replace(oldAlignment, newAlignment);
}

const oldEvidence = `      group.userData.uploadedJetwayHiddenGeneratedObjectCount = hiddenGeneratedObjectCount;
      group.userData.uploadedJetwayTerminalConnectorPreserved = true;`;
const newEvidence = `      group.userData.uploadedJetwayHiddenGeneratedObjectCount = hiddenGeneratedObjectCount;
      group.userData.uploadedJetwayTerminalConnectorPreserved = true;
      group.userData.uploadedJetwayExactSourceGeometryPreserved = true;
      group.userData.uploadedJetwayAuthoringAxisAuthority = "${axisMarker}";
      group.userData.uploadedJetwayLegacyBridgeGeometryAuthority = "${legacyMarker}";`;
if (!source.includes("uploadedJetwayExactSourceGeometryPreserved")) {
  if (!source.includes(oldEvidence)) throw new Error(`${path}: uploaded model evidence anchor missing`);
  source = source.replace(oldEvidence, newEvidence);
}

for (const token of [
  axisMarker,
  legacyMarker,
  "aligned.rotation.y = Math.PI / 2",
  "uploadedJetwayExactSourceGeometryPreserved = true",
  "const HIDE_REPLACED = /^(?:AIR_Jetway01_",
]) {
  if (!source.includes(token)) throw new Error(`${path}: exact uploaded jetway integration missing ${token}`);
}
if (source.includes("AIR_Jetway01_(?!WallCollars)")) {
  throw new Error(`${path}: legacy wall-collar exception still permits duplicate bridge geometry`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared the exact supplied airport jetway model with a parent-only +90 degree authoring-axis correction and exclusive replacement of all legacy bridge geometry. Supplied meshes and internal transforms remain untouched.");
