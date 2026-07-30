import fs from "node:fs";

function replaceOnce(path, oldText, newText, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(oldText)) throw new Error(`${path}: source-alpha anchor is missing for ${label}`);
  source = source.replace(oldText, newText);
  fs.writeFileSync(path, source, "utf8");
}

const materializerPath = "scripts/materialize-phx-terminal4.mjs";
replaceOnce(
  materializerPath,
  'const CRC_TABLE = (() => {',
  `function inspectAlpha(rgba) {
  let transparentPixelCount = 0;
  let partialAlphaPixelCount = 0;
  for (let index = 3; index < rgba.length; index += 4) {
    const alpha = rgba[index];
    if (alpha < 255) transparentPixelCount += 1;
    if (alpha > 0 && alpha < 255) partialAlphaPixelCount += 1;
  }
  return {
    hasAlpha: transparentPixelCount > 0,
    transparentPixelCount,
    partialAlphaPixelCount,
    alphaCoverage: rgba.length ? transparentPixelCount / (rgba.length / 4) : 0,
  };
}

const CRC_TABLE = (() => {`,
  "function inspectAlpha(rgba)",
  "terminal texture alpha inspection",
);
replaceOnce(
  materializerPath,
  `  const decoded = decodeSourceTexture(sourceBytes);
  const png = encodePng(decoded.width, decoded.height, decoded.rgba);`,
  `  const decoded = decodeSourceTexture(sourceBytes);
  const alpha = inspectAlpha(decoded.rgba);
  const png = encodePng(decoded.width, decoded.height, decoded.rgba);`,
  "const alpha = inspectAlpha(decoded.rgba)",
  "per-texture alpha evidence",
);
replaceOnce(
  materializerPath,
  `    sourceCompression: decoded.compression,
    fidelity: mapping.fidelity,`,
  `    sourceCompression: decoded.compression,
    hasAlpha: alpha.hasAlpha,
    transparentPixelCount: alpha.transparentPixelCount,
    partialAlphaPixelCount: alpha.partialAlphaPixelCount,
    alphaCoverage: alpha.alphaCoverage,
    fidelity: mapping.fidelity,`,
  "transparentPixelCount: alpha.transparentPixelCount",
  "texture manifest alpha fields",
);

const runtimePath = "src/environment/authoredTerminal4Visual.js";
replaceOnce(
  runtimePath,
  `    textures.set(
      reference.toUpperCase(),
      configureRuntimeTexture(THREE, diffuse, \`PHX source ${"${reference}"}\`, wrapping),
    );`,
  `    const configuredDiffuse = configureRuntimeTexture(THREE, diffuse, \`PHX source ${"${reference}"}\`, wrapping);
    configuredDiffuse.userData = {
      ...(configuredDiffuse.userData || {}),
      sourceHasAlpha: entry.hasAlpha === true,
      sourceAlphaCoverage: Number(entry.alphaCoverage || 0),
      sourceTransparentPixelCount: Number(entry.transparentPixelCount || 0),
    };
    textures.set(reference.toUpperCase(), configuredDiffuse);`,
  "sourceHasAlpha: entry.hasAlpha === true",
  "runtime texture alpha metadata",
);
replaceOnce(
  runtimePath,
  `  let texturedMaterialCount = 0;
  let lightmappedMaterialCount = 0;
  let hiddenLegacyGroundMaterialCount = 0;`,
  `  let texturedMaterialCount = 0;
  let lightmappedMaterialCount = 0;
  let hiddenLegacyGroundMaterialCount = 0;
  let sourceCutoutMaterialCount = 0;`,
  "let sourceCutoutMaterialCount = 0",
  "cutout material counter",
);
replaceOnce(
  runtimePath,
  `      material.transparent = false;
      material.opacity = 1;
      material.side = THREE.DoubleSide;
      material.depthWrite = !legacyGroundAtlas;
      material.visible = !legacyGroundAtlas;`,
  `      const sourceCutout = texture?.userData?.sourceHasAlpha === true;
      material.transparent = sourceCutout;
      material.opacity = 1;
      material.alphaTest = sourceCutout ? 0.42 : 0;
      material.side = THREE.DoubleSide;
      material.depthWrite = !legacyGroundAtlas;
      material.visible = !legacyGroundAtlas;`,
  "const sourceCutout = texture?.userData?.sourceHasAlpha === true",
  "source cutout material configuration",
);
replaceOnce(
  runtimePath,
  `        sourceLightmap: emissiveMap ? \`${"${reference}"} exact _lm source\` : null,
        visibilityAuthority: legacyGroundAtlas`,
  `        sourceLightmap: emissiveMap ? \`${"${reference}"} exact _lm source\` : null,
        sourceCutout,
        sourceAlphaCoverage: Number(texture?.userData?.sourceAlphaCoverage || 0),
        visibilityAuthority: legacyGroundAtlas`,
  "sourceAlphaCoverage: Number(texture?.userData?.sourceAlphaCoverage",
  "material alpha provenance",
);
replaceOnce(
  runtimePath,
  `      if (legacyGroundAtlas) hiddenLegacyGroundMaterialCount += 1;
      if (emissiveMap) lightmappedMaterialCount += 1;`,
  `      if (legacyGroundAtlas) hiddenLegacyGroundMaterialCount += 1;
      if (sourceCutout && !legacyGroundAtlas) sourceCutoutMaterialCount += 1;
      if (emissiveMap) lightmappedMaterialCount += 1;`,
  "if (sourceCutout && !legacyGroundAtlas) sourceCutoutMaterialCount",
  "cutout material accounting",
);
replaceOnce(
  runtimePath,
  "  return { texturedMaterialCount, lightmappedMaterialCount, hiddenLegacyGroundMaterialCount };",
  "  return { texturedMaterialCount, lightmappedMaterialCount, hiddenLegacyGroundMaterialCount, sourceCutoutMaterialCount };",
  "sourceCutoutMaterialCount };",
  "cutout material return state",
);
replaceOnce(
  runtimePath,
  `    texturedMaterialCount,
    lightmappedMaterialCount,
    hiddenLegacyGroundMaterialCount,
  } = applySourceMaterials`,
  `    texturedMaterialCount,
    lightmappedMaterialCount,
    hiddenLegacyGroundMaterialCount,
    sourceCutoutMaterialCount,
  } = applySourceMaterials`,
  "sourceCutoutMaterialCount,\n  } = applySourceMaterials",
  "cutout material destructuring",
);
replaceOnce(
  runtimePath,
  `  environment.userData.authoredTerminal4HiddenLegacyGroundMaterialCount = hiddenLegacyGroundMaterialCount;
  environment.userData.authoredTerminal4JetwayVisualCount`,
  `  environment.userData.authoredTerminal4HiddenLegacyGroundMaterialCount = hiddenLegacyGroundMaterialCount;
  environment.userData.authoredTerminal4SourceCutoutMaterialCount = sourceCutoutMaterialCount;
  environment.userData.authoredTerminal4SourceAlphaAuthority = "exact-recovered-dxt1-alpha-coverage";
  environment.userData.authoredTerminal4JetwayVisualCount`,
  "authoredTerminal4SourceAlphaAuthority",
  "terminal alpha runtime evidence",
);

for (const [path, tokens] of Object.entries({
  [materializerPath]: [
    "function inspectAlpha(rgba)",
    "const alpha = inspectAlpha(decoded.rgba)",
    "transparentPixelCount: alpha.transparentPixelCount",
    "alphaCoverage: alpha.alphaCoverage",
  ],
  [runtimePath]: [
    "sourceHasAlpha: entry.hasAlpha === true",
    "const sourceCutout = texture?.userData?.sourceHasAlpha === true",
    "material.alphaTest = sourceCutout ? 0.42 : 0",
    "authoredTerminal4SourceAlphaAuthority",
  ],
})) {
  const prepared = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!prepared.includes(token)) throw new Error(`${path}: exact source alpha preparation is missing ${token}`);
}

console.log("Prepared exact Terminal 4 DXT1 cutout alpha: transparent atlas regions no longer render as opaque black architecture.");
