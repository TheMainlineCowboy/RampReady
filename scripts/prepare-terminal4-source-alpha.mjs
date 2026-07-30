import fs from "node:fs";

function replaceOnce(path, oldText, newText, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(oldText)) throw new Error(`${path}: source-atlas anchor is missing for ${label}`);
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
  "const CRC_TABLE = (() => {",
  `function applySourceAtlasCutout(reference, width, height, rgba) {
  if (reference.toUpperCase() !== "PHX_TERM400_1.DDS") {
    return { applied: false, transparentPixelCount: 0, authority: "none" };
  }
  // The recovered source atlas has no encoded DXT1 alpha, but its lower-right
  // quadrant is a single unused pure-black allocation. Exactly 120 extracted
  // Terminal 4 triangles sample this quadrant, producing the standalone black
  // block and repeated false lower-level boxes seen in the trainer. Preserve the
  // separate left-side stairwell imagery and all dark windows; mask only pixels
  // inside the unused quadrant that are actually pure black.
  const startX = Math.floor(width / 2);
  const startY = Math.floor(height / 2);
  let transparentPixelCount = 0;
  for (let y = startY; y < height; y += 1) {
    for (let x = startX; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (rgba[offset] > 4 || rgba[offset + 1] > 4 || rgba[offset + 2] > 4) continue;
      if (rgba[offset + 3] !== 0) transparentPixelCount += 1;
      rgba[offset + 3] = 0;
    }
  }
  if (!(transparentPixelCount > 0)) throw new Error("PHX_TERM400_1 unused source-atlas quadrant contained no maskable pixels");
  return {
    applied: true,
    transparentPixelCount,
    authority: "recovered-phx-term400-1-unused-lower-right-atlas-quadrant",
  };
}

const CRC_TABLE = (() => {`,
  "function applySourceAtlasCutout(reference, width, height, rgba)",
  "source atlas cutout helper",
);
replaceOnce(
  materializerPath,
  `  const decoded = decodeSourceTexture(sourceBytes);
  const alpha = inspectAlpha(decoded.rgba);
  const png = encodePng(decoded.width, decoded.height, decoded.rgba);`,
  `  const decoded = decodeSourceTexture(sourceBytes);
  const atlasCutout = applySourceAtlasCutout(reference, decoded.width, decoded.height, decoded.rgba);
  const alpha = inspectAlpha(decoded.rgba);
  const png = encodePng(decoded.width, decoded.height, decoded.rgba);`,
  "const atlasCutout = applySourceAtlasCutout(reference",
  "per-texture source-atlas cutout",
);
replaceOnce(
  materializerPath,
  `    alphaCoverage: alpha.alphaCoverage,
    fidelity: mapping.fidelity,`,
  `    alphaCoverage: alpha.alphaCoverage,
    sourceAtlasCutoutApplied: atlasCutout.applied,
    sourceAtlasCutoutTransparentPixelCount: atlasCutout.transparentPixelCount,
    sourceAtlasCutoutAuthority: atlasCutout.authority,
    fidelity: mapping.fidelity,`,
  "sourceAtlasCutoutAuthority: atlasCutout.authority",
  "texture manifest source-atlas fields",
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
      sourceAtlasCutoutAuthority: entry.sourceAtlasCutoutAuthority || "none",
    };
    textures.set(reference.toUpperCase(), configuredDiffuse);`,
  "sourceHasAlpha: entry.hasAlpha === true",
  "runtime texture source-atlas metadata",
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
        sourceAtlasCutoutAuthority: texture?.userData?.sourceAtlasCutoutAuthority || "none",
        visibilityAuthority: legacyGroundAtlas`,
  "sourceAtlasCutoutAuthority: texture?.userData?.sourceAtlasCutoutAuthority",
  "material source-atlas provenance",
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
  environment.userData.authoredTerminal4SourceAlphaAuthority = "recovered-source-atlas-unused-quadrant-cutout";
  environment.userData.authoredTerminal4JetwayVisualCount`,
  "authoredTerminal4SourceAlphaAuthority",
  "terminal source-atlas runtime evidence",
);

let runtime = fs.readFileSync(runtimePath, "utf8");
runtime = runtime.replaceAll(
  'environment.userData.authoredTerminal4SourceAlphaAuthority = "exact-recovered-dxt1-alpha-coverage";',
  'environment.userData.authoredTerminal4SourceAlphaAuthority = "recovered-source-atlas-unused-quadrant-cutout";',
);
fs.writeFileSync(runtimePath, runtime, "utf8");

for (const [path, tokens] of Object.entries({
  [materializerPath]: [
    "function inspectAlpha(rgba)",
    "function applySourceAtlasCutout(reference, width, height, rgba)",
    "const atlasCutout = applySourceAtlasCutout(reference",
    "sourceAtlasCutoutAuthority: atlasCutout.authority",
  ],
  [runtimePath]: [
    "sourceHasAlpha: entry.hasAlpha === true",
    "const sourceCutout = texture?.userData?.sourceHasAlpha === true",
    "material.alphaTest = sourceCutout ? 0.42 : 0",
    "recovered-source-atlas-unused-quadrant-cutout",
  ],
})) {
  const prepared = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!prepared.includes(token)) throw new Error(`${path}: source-atlas preparation is missing ${token}`);
}

console.log("Prepared Terminal 4 source-atlas cutout: only PHX_TERM400_1's unused pure-black lower-right quadrant is transparent; dark windows and stair imagery remain intact.");
