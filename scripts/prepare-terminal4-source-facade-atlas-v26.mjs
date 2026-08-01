import fs from "node:fs";

const path = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(path, "utf8");
const marker = "source-package-facade-variation-atlas-v26";

if (!source.includes(marker)) {
  const configureAnchor = `function configureRuntimeTexture(THREE, texture, name, wrapping) {
  texture.name = name;
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = wrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
`;
  if (!source.includes(configureAnchor)) {
    throw new Error(`${path}: runtime texture configuration anchor is missing`);
  }

  const helpers = `
// ${marker}
// BGATE1 is one photographed open service-bay module that the original FSX
// mesh repeats across long walls through out-of-range UVs. Preserve the source
// mesh and source imagery, but assemble a wider atlas from the other real gate
// wall photographs in the same package so the browser does not stamp the same
// black opening at every UV interval.
const TERMINAL4_SOURCE_FACADE_PATTERN = Object.freeze([
  "BGATE1.BMP",
  "BGATE3.BMP",
  "DGATE2.BMP",
  "BGATE3.BMP",
  "DGATE3.BMP",
  "DGATE5.BMP",
  "BGATE3.BMP",
  "DGATE2.BMP",
]);

function terminal4TextureImage(texture, label) {
  const image = texture?.image ?? texture?.source?.data;
  const width = Number(image?.naturalWidth || image?.videoWidth || image?.width || 0);
  const height = Number(image?.naturalHeight || image?.videoHeight || image?.height || 0);
  if (!image || width < 1 || height < 1) {
    throw new Error(`Terminal 4 source facade image is unavailable for ${label}`);
  }
  return { image, width, height };
}

function buildTerminal4SourceFacadeAtlas(THREE, textureMap, lightmap = false) {
  const baseTexture = textureMap.get("BGATE1.BMP");
  if (!baseTexture) throw new Error("Terminal 4 BGATE1 source texture is missing");
  const base = terminal4TextureImage(baseTexture, "BGATE1.BMP");
  const canvas = document.createElement("canvas");
  canvas.width = base.width * TERMINAL4_SOURCE_FACADE_PATTERN.length;
  canvas.height = base.height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Terminal 4 source facade canvas is unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const destinationPatchY = Math.round(base.height * 0.76);
  const destinationPatchHeight = base.height - destinationPatchY;
  TERMINAL4_SOURCE_FACADE_PATTERN.forEach((reference, index) => {
    const destinationX = index * base.width;
    context.globalAlpha = 1;
    context.drawImage(base.image, destinationX, 0, base.width, base.height);
    if (reference === "BGATE1.BMP") return;

    const sourceTexture = textureMap.get(reference);
    const wall = terminal4TextureImage(sourceTexture, reference);
    const sourcePatchY = Math.round(wall.height * 0.54);
    const sourcePatchHeight = Math.max(1, wall.height - sourcePatchY);
    context.drawImage(
      wall.image,
      0,
      sourcePatchY,
      wall.width,
      sourcePatchHeight,
      destinationX,
      destinationPatchY,
      base.width,
      destinationPatchHeight,
    );

    // Blend a narrow source-derived transition band instead of introducing a
    // generated seam between the original upper wall and the closed lower bay.
    context.globalAlpha = lightmap ? 0.72 : 0.84;
    const transitionHeight = Math.max(8, Math.round(base.height * 0.018));
    context.drawImage(
      wall.image,
      0,
      Math.max(0, sourcePatchY - Math.round(sourcePatchHeight * 0.08)),
      wall.width,
      Math.max(1, Math.round(sourcePatchHeight * 0.12)),
      destinationX,
      destinationPatchY - transitionHeight,
      base.width,
      transitionHeight * 2,
    );
  });
  context.globalAlpha = 1;

  const atlas = configureRuntimeTexture(
    THREE,
    new THREE.CanvasTexture(canvas),
    lightmap
      ? "Terminal 4 source-package BGATE1 variation lightmap atlas v26"
      : "Terminal 4 source-package BGATE1 variation diffuse atlas v26",
    THREE.RepeatWrapping,
  );
  atlas.repeat.set(1 / TERMINAL4_SOURCE_FACADE_PATTERN.length, 1);
  atlas.userData = {
    ...(baseTexture.userData || {}),
    sourceFacadeVariationAuthority: marker,
    sourceFacadeVariationPattern: [...TERMINAL4_SOURCE_FACADE_PATTERN],
    sourceFacadeOpenBayFrequency: 1 / TERMINAL4_SOURCE_FACADE_PATTERN.length,
    sourceFacadeAtlasColumns: TERMINAL4_SOURCE_FACADE_PATTERN.length,
    sourceFacadeAtlasLightmap: lightmap,
  };
  return atlas;
}
`;
  source = source.replace(configureAnchor, `${configureAnchor}${helpers}`);

  const loadAnchor = `  if (emissiveTextures.size !== manifest.emissiveTextureCount) {
    throw new Error(\`Terminal 4 loaded \${emissiveTextures.size} of \${manifest.emissiveTextureCount} exact lightmaps\`);
  }
  return { textures, emissiveTextures, manifest };`;
  if (!source.includes(loadAnchor)) {
    throw new Error(`${path}: source texture completion anchor is missing`);
  }
  const loadReplacement = `  if (emissiveTextures.size !== manifest.emissiveTextureCount) {
    throw new Error(\`Terminal 4 loaded \${emissiveTextures.size} of \${manifest.emissiveTextureCount} exact lightmaps\`);
  }
  textures.set("BGATE1.BMP", buildTerminal4SourceFacadeAtlas(THREE, textures, false));
  emissiveTextures.set("BGATE1.BMP", buildTerminal4SourceFacadeAtlas(THREE, emissiveTextures, true));
  manifest.sourceFacadeVariationAuthority = marker;
  manifest.sourceFacadeVariationPattern = [...TERMINAL4_SOURCE_FACADE_PATTERN];
  return { textures, emissiveTextures, manifest };`;
  source = source.replace(loadAnchor, loadReplacement);

  const evidenceAnchor = `  environment.userData.authoredTerminal4TextureCount = manifest.diffuseReferenceCount;`;
  if (!source.includes(evidenceAnchor)) {
    throw new Error(`${path}: Terminal 4 texture evidence anchor is missing`);
  }
  source = source.replace(
    evidenceAnchor,
    `${evidenceAnchor}\n  environment.userData.authoredTerminal4FacadeVariationAuthority = manifest.sourceFacadeVariationAuthority || "none";\n  environment.userData.authoredTerminal4FacadeVariationPattern = manifest.sourceFacadeVariationPattern || [];`,
  );
}

for (const token of [
  marker,
  "TERMINAL4_SOURCE_FACADE_PATTERN",
  "buildTerminal4SourceFacadeAtlas",
  'textures.set("BGATE1.BMP"',
  'emissiveTextures.set("BGATE1.BMP"',
  "authoredTerminal4FacadeVariationAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${path}: source facade atlas v26 is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared Terminal 4 source-package facade atlas v26: original geometry retained, one real open BGATE1 bay per eight UV modules, and all closed-wall variation drawn from the package's recovered gate textures and lightmaps.");
