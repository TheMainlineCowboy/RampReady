import fs from "node:fs";

const photoPath = "src/environment/authoredKphxPhotoGround.js";
let source = fs.readFileSync(photoPath, "utf8");
const authority = "supplied-PARKRAMPS-cutout-underlay-v43";

function replaceRequired(before, after, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${photoPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

replaceRequired(
  "function buildAirportBaseUnderlay(THREE, environment) {\n  const authoredGround = environment.userData.authoredGround;\n  if (!authoredGround) throw new Error(\"KPHX ADEX ground must load before its aerial underlay\");",
  `async function buildAirportBaseUnderlay(THREE, environment) {\n  const authoredGround = environment.userData.authoredGround;\n  if (!authoredGround) throw new Error(\"KPHX ADEX ground must load before its aerial underlay\");\n\n  // ${authority}\n  // Fill transparent source-aerial pixels with pavement cropped from the exact\n  // supplied PARKRAMPS atlas instead of exposing a flat neutral gray mesh.\n  const pavementAtlas = await new THREE.TextureLoader().loadAsync(\n    \`${'${import.meta.env.BASE_URL}'}models/phx-terminal4/textures/PARKRAMPS.png\`,\n  );\n  const atlasImage = pavementAtlas.image;\n  if (!atlasImage?.width || !atlasImage?.height) {\n    throw new Error(\"Supplied PARKRAMPS pavement atlas did not decode for the KPHX underlay\");\n  }\n  const pavementCanvas = document.createElement(\"canvas\");\n  pavementCanvas.width = 512;\n  pavementCanvas.height = 512;\n  const pavementContext = pavementCanvas.getContext(\"2d\");\n  if (!pavementContext) throw new Error(\"KPHX source-pavement underlay canvas is unavailable\");\n  pavementContext.imageSmoothingEnabled = true;\n  const cropWidth = Math.min(192, atlasImage.width);\n  const cropHeight = Math.min(34, atlasImage.height);\n  for (let y = 0; y < pavementCanvas.height; y += 32) {\n    pavementContext.drawImage(\n      atlasImage, 0, 1, cropWidth, cropHeight,\n      0, y, pavementCanvas.width, 32,\n    );\n  }\n  pavementAtlas.dispose?.();\n  const sourcePavementUnderlayTexture = new THREE.CanvasTexture(pavementCanvas);\n  sourcePavementUnderlayTexture.name = \"PHX supplied PARKRAMPS aerial-cutout underlay\";\n  sourcePavementUnderlayTexture.colorSpace = THREE.SRGBColorSpace;\n  sourcePavementUnderlayTexture.wrapS = THREE.RepeatWrapping;\n  sourcePavementUnderlayTexture.wrapT = THREE.RepeatWrapping;\n  sourcePavementUnderlayTexture.repeat.set(18, 18);\n  sourcePavementUnderlayTexture.minFilter = THREE.LinearMipmapLinearFilter;\n  sourcePavementUnderlayTexture.magFilter = THREE.LinearFilter;\n  sourcePavementUnderlayTexture.anisotropy = 16;\n  sourcePavementUnderlayTexture.generateMipmaps = true;\n  sourcePavementUnderlayTexture.needsUpdate = true;`,
  authority,
  "airport-base underlay source texture setup",
);

replaceRequired(
  `    const material = new THREE.MeshBasicMaterial({\n      name: "PHX source-aerial transparent-cutout pavement underlay",\n      color: 0x737779,`,
  `    const material = new THREE.MeshBasicMaterial({\n      name: "PHX supplied PARKRAMPS transparent-cutout pavement underlay",\n      map: sourcePavementUnderlayTexture,\n      color: 0xffffff,`,
  "map: sourcePavementUnderlayTexture",
  "flat gray ADEX underlay material",
);

replaceRequired(
  `    underlay.userData.underlayAuthority = AUTHORED_KPHX_PHOTO_PROFILE.underlayMode;`,
  `    underlay.userData.underlayAuthority = AUTHORED_KPHX_PHOTO_PROFILE.underlayMode;\n    underlay.userData.sourcePavementAuthority = "${authority}";`,
  "underlay.userData.sourcePavementAuthority",
  "source pavement underlay evidence",
);

replaceRequired(
  "  const underlayMaterialCount = buildAirportBaseUnderlay(THREE, environment);",
  "  const underlayMaterialCount = await buildAirportBaseUnderlay(THREE, environment);",
  "await buildAirportBaseUnderlay(THREE, environment)",
  "async underlay installation",
);

replaceRequired(
  "  environment.userData.authoredPhotoUnderlayMaterialCount = underlayMaterialCount;",
  `  environment.userData.authoredPhotoUnderlayMaterialCount = underlayMaterialCount;\n  environment.userData.authoredPhotoSourcePavementUnderlayAuthority = "${authority}";`,
  "authoredPhotoSourcePavementUnderlayAuthority",
  "environment underlay authority",
);

for (const token of [
  authority,
  "async function buildAirportBaseUnderlay",
  "map: sourcePavementUnderlayTexture",
  "sourcePavementUnderlayTexture.repeat.set(18, 18)",
  "await buildAirportBaseUnderlay(THREE, environment)",
  "authoredPhotoSourcePavementUnderlayAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${photoPath}: missing source-pavement underlay token ${token}`);
}

fs.writeFileSync(photoPath, source, "utf8");
console.log("Prepared KPHX source pavement underlay v43: transparent aerial pixels now reveal a repeatable crop from the supplied PARKRAMPS atlas instead of flat gray fallback pavement.");
