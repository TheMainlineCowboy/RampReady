import fs from "node:fs";

function replaceRequired(source, oldText, newText, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(oldText)) throw new Error(`Missing ${label} anchor`);
  return source.replace(oldText, newText);
}

const visualPath = "src/environment/authoredTerminal4Visual.js";
let visual = fs.readFileSync(visualPath, "utf8");

visual = replaceRequired(
  visual,
  "  let sourceCutoutMaterialCount = 0;",
  "  let sourceCutoutMaterialCount = 0;\n  let sourceClosedBayMaterialCount = 0;",
  "let sourceClosedBayMaterialCount = 0;",
  "source closed-bay material counter",
);

visual = replaceRequired(
  visual,
  `      const material = source.clone();
      const reference = textureReference(material);
      const key = reference?.toUpperCase();
      const texture = key ? textures.get(key) : null;
      const emissiveMap = key ? emissiveTextures.get(key) : null;
      if (!texture) throw new Error(\`Terminal 4 material texture is missing at runtime: \${reference || material.name}\`);
      const character = materialCharacter(reference);
      const legacyGroundAtlas = /PARKRAMP|RW\\.BMP/i.test(reference || "");`,
  `      const material = source.clone();
      const sourceReference = textureReference(material);
      const sourceKey = sourceReference?.toUpperCase();
      // BGATE1 is the package's photographed open-bay module. The original BGL
      // repeats that one opening across the entire lower facade. Use the same
      // package's closed BGATE3 variant for those authored surfaces instead of
      // stamping generated boxes or synthesizing a replacement atlas.
      const runtimeReference = sourceKey === "BGATE1.BMP" ? "BGATE3.BMP" : sourceReference;
      const key = runtimeReference?.toUpperCase();
      const texture = key ? textures.get(key) : null;
      const emissiveMap = key ? emissiveTextures.get(key) : null;
      if (!texture) throw new Error(\`Terminal 4 material texture is missing at runtime: \${runtimeReference || material.name}\`);
      const character = materialCharacter(runtimeReference);
      const legacyGroundAtlas = /PARKRAMP|RW\\.BMP/i.test(sourceReference || "");
      const sourceClosedBaySelection = sourceKey === "BGATE1.BMP";`,
  "const sourceClosedBaySelection = sourceKey === \"BGATE1.BMP\";",
  "source-authored closed-bay facade selection",
);

visual = replaceRequired(
  visual,
  `        sourceLightmap: emissiveMap ? \`\${reference} exact _lm source\` : null,
        sourceCutout,`,
  `        sourceLightmap: emissiveMap ? \`\${runtimeReference} exact _lm source\` : null,
        sourceDiffuseTexture: sourceReference,
        runtimeDiffuseTexture: runtimeReference,
        sourceFacadeSelectionAuthority: sourceClosedBaySelection
          ? "source-BGATE3-closed-bay-variant-replaces-repeated-BGATE1-open-bay-v27"
          : "source-material-unmodified",
        sourceCutout,`,
  "source-BGATE3-closed-bay-variant-replaces-repeated-BGATE1-open-bay-v27",
  "source facade authority metadata",
);

visual = replaceRequired(
  visual,
  "      if (sourceCutout && !legacyGroundAtlas) sourceCutoutMaterialCount += 1;",
  "      if (sourceCutout && !legacyGroundAtlas) sourceCutoutMaterialCount += 1;\n      if (sourceClosedBaySelection) sourceClosedBayMaterialCount += 1;",
  "if (sourceClosedBaySelection) sourceClosedBayMaterialCount += 1;",
  "source closed-bay material accounting",
);

visual = replaceRequired(
  visual,
  "  return { texturedMaterialCount, lightmappedMaterialCount, hiddenLegacyGroundMaterialCount, sourceCutoutMaterialCount };",
  "  return { texturedMaterialCount, lightmappedMaterialCount, hiddenLegacyGroundMaterialCount, sourceCutoutMaterialCount, sourceClosedBayMaterialCount };",
  "sourceCutoutMaterialCount, sourceClosedBayMaterialCount",
  "source material result accounting",
);

visual = replaceRequired(
  visual,
  `    hiddenLegacyGroundMaterialCount,
    sourceCutoutMaterialCount,
  } = applySourceMaterials`,
  `    hiddenLegacyGroundMaterialCount,
    sourceCutoutMaterialCount,
    sourceClosedBayMaterialCount,
  } = applySourceMaterials`,
  "    sourceClosedBayMaterialCount,\n  } = applySourceMaterials",
  "source closed-bay install accounting",
);

visual = replaceRequired(
  visual,
  "  environment.userData.authoredTerminal4SourceCutoutMaterialCount = sourceCutoutMaterialCount;",
  "  environment.userData.authoredTerminal4SourceCutoutMaterialCount = sourceCutoutMaterialCount;\n  environment.userData.authoredTerminal4SourceClosedBayMaterialCount = sourceClosedBayMaterialCount;\n  environment.userData.authoredTerminal4SourceFacadeSelectionAuthority = \"source-BGATE3-closed-bay-variant-replaces-repeated-BGATE1-open-bay-v27\";",
  "authoredTerminal4SourceClosedBayMaterialCount",
  "source closed-bay environment evidence",
);

fs.writeFileSync(visualPath, visual, "utf8");

const polishPath = "src/environment/terminal4JetwaySimulatorPolishV13.js";
if (fs.existsSync(polishPath)) {
  let polish = fs.readFileSync(polishPath, "utf8");
  polish = replaceRequired(
    polish,
    "  const a1LowerFacadePanelCount = installA1LowerFacadePortal(group);",
    "  // The source-measured T4_WALK portal is now the attachment authority.\n  // Do not retain the obsolete generated panels at the rejected BGATE1 plane.\n  const a1LowerFacadePanelCount = 0;",
    "Do not retain the obsolete generated panels at the rejected BGATE1 plane.",
    "obsolete A1 lower-facade overlay removal",
  );
  polish = replaceRequired(
    polish,
    "  group.userData.a1LowerFacadeAuthority = \"exact-BGATE1-wall-solid-lower-facade-with-jetway-portal-v15\";",
    "  group.userData.a1LowerFacadeAuthority = \"source-authored-A1-lower-facade-no-rejected-BGATE1-overlay-v27\";",
    "source-authored-A1-lower-facade-no-rejected-BGATE1-overlay-v27",
    "A1 lower-facade source authority",
  );
  fs.writeFileSync(polishPath, polish, "utf8");
}

console.log("Prepared Terminal 4 facade v27 from package-native BGATE3 closed bays and removed the rejected A1 BGATE1 overlay.");
