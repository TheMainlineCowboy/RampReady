import fs from "node:fs";

function replaceRequired(source, oldText, newText, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(oldText)) throw new Error(`Missing ${label} anchor`);
  return source.replace(oldText, newText);
}

const visualPath = "src/environment/authoredTerminal4Visual.js";
let visual = fs.readFileSync(visualPath, "utf8");

const splitterMarker = "source-package-facade-cell-variation-v31";
if (!visual.includes(splitterMarker)) {
  const anchor = "function applySourceMaterials(THREE, scene, textures, emissiveTextures) {";
  if (!visual.includes(anchor)) throw new Error("Missing Terminal 4 source material function anchor");
  const helper = `function interpolateFacadeVertex(a, b, t) {
  return {
    position: a.position.clone().lerp(b.position, t),
    normal: a.normal.clone().lerp(b.normal, t).normalize(),
    uv: a.uv.clone().lerp(b.uv, t),
  };
}

function clipFacadePolygonByU(polygon, boundary, keepGreater) {
  if (!polygon.length) return [];
  const clipped = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const aInside = keepGreater ? a.uv.x >= boundary - 1e-6 : a.uv.x <= boundary + 1e-6;
    const bInside = keepGreater ? b.uv.x >= boundary - 1e-6 : b.uv.x <= boundary + 1e-6;
    if (aInside && bInside) {
      clipped.push(b);
    } else if (aInside !== bInside) {
      const denominator = b.uv.x - a.uv.x;
      const t = Math.abs(denominator) < 1e-8 ? 0 : (boundary - a.uv.x) / denominator;
      const intersection = interpolateFacadeVertex(a, b, Math.max(0, Math.min(1, t)));
      clipped.push(intersection);
      if (!aInside && bInside) clipped.push(b);
    }
  }
  return clipped;
}

function splitRepeatedBGATE1Facade(THREE, scene) {
  const sequence = [
    "BGATE3.BMP",
    "DGATE3.BMP",
    "BGATE3.BMP",
    "DGATE4.BMP",
    "BGATE3.BMP",
    "BGATE1.BMP",
    "DGATE3.BMP",
    "BGATE3.BMP",
  ];
  const uniqueReferences = [...new Set(sequence)];
  let splitMeshCount = 0;
  const sourceCells = new Set();
  const openCells = new Set();
  const closedCells = new Set();

  scene.traverse((node) => {
    if (!node.isMesh || Array.isArray(node.material)) return;
    if (textureReference(node.material)?.toUpperCase() !== "BGATE1.BMP") return;
    const sourceGeometry = node.geometry?.index ? node.geometry.toNonIndexed() : node.geometry;
    const position = sourceGeometry?.getAttribute?.("position");
    const normal = sourceGeometry?.getAttribute?.("normal");
    const uv = sourceGeometry?.getAttribute?.("uv");
    if (!position || !normal || !uv || position.count % 3 !== 0) {
      throw new Error("BGATE1 facade geometry is missing non-indexed position, normal or UV attributes");
    }

    const buffers = new Map(uniqueReferences.map((reference) => [reference, {
      position: [],
      normal: [],
      uv: [],
    }]));
    const readVertex = (vertexIndex) => ({
      position: new THREE.Vector3().fromBufferAttribute(position, vertexIndex),
      normal: new THREE.Vector3().fromBufferAttribute(normal, vertexIndex),
      uv: new THREE.Vector2().fromBufferAttribute(uv, vertexIndex),
    });

    for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 3) {
      const triangle = [readVertex(vertexIndex), readVertex(vertexIndex + 1), readVertex(vertexIndex + 2)];
      const minimumU = Math.min(...triangle.map((vertex) => vertex.uv.x));
      const maximumU = Math.max(...triangle.map((vertex) => vertex.uv.x));
      const firstCell = Math.floor(minimumU + 1e-6);
      const lastCell = Math.max(firstCell, Math.ceil(maximumU - 1e-6) - 1);
      for (let cell = firstCell; cell <= lastCell; cell += 1) {
        let polygon = clipFacadePolygonByU(triangle, cell, true);
        polygon = clipFacadePolygonByU(polygon, cell + 1, false);
        if (polygon.length < 3) continue;
        const sequenceIndex = ((cell % sequence.length) + sequence.length) % sequence.length;
        const reference = sequence[sequenceIndex];
        const buffer = buffers.get(reference);
        sourceCells.add(cell);
        if (reference === "BGATE1.BMP") openCells.add(cell);
        else closedCells.add(cell);
        for (let fan = 1; fan < polygon.length - 1; fan += 1) {
          for (const vertex of [polygon[0], polygon[fan], polygon[fan + 1]]) {
            buffer.position.push(vertex.position.x, vertex.position.y, vertex.position.z);
            buffer.normal.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
            buffer.uv.push(Math.max(0, Math.min(1, vertex.uv.x - cell)), vertex.uv.y);
          }
        }
      }
    }

    const replacement = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const materials = [];
    let groupStart = 0;
    for (const reference of uniqueReferences) {
      const buffer = buffers.get(reference);
      if (!buffer.position.length) continue;
      const material = node.material.clone();
      material.name = String(material.name || "material-0-BGATE1.BMP").replace(/BGATE1\\.(BMP|DDS)/i, reference);
      material.userData = {
        ...(material.userData || {}),
        diffuseTexture: reference,
        sourceFacadeCellVariation: true,
        sourceFacadeVariationAuthority: splitterMarker,
      };
      materials.push(material);
      positions.push(...buffer.position);
      normals.push(...buffer.normal);
      uvs.push(...buffer.uv);
      replacement.addGroup(groupStart, buffer.position.length / 3, materials.length - 1);
      groupStart += buffer.position.length / 3;
    }
    if (!materials.length) throw new Error("BGATE1 facade splitter produced no source-variant geometry");
    replacement.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    replacement.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    replacement.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    replacement.computeBoundingBox();
    replacement.computeBoundingSphere();
    if (sourceGeometry !== node.geometry) sourceGeometry.dispose();
    node.geometry.dispose();
    node.geometry = replacement;
    node.material = materials;
    node.userData = {
      ...(node.userData || {}),
      sourceFacadeCellVariation: true,
      sourceFacadeVariationAuthority: splitterMarker,
      sourceFacadeVariantReferences: uniqueReferences,
    };
    splitMeshCount += 1;
  });

  return {
    authority: splitterMarker,
    splitMeshCount,
    sourceCellCount: sourceCells.size,
    openCellCount: openCells.size,
    closedCellCount: closedCells.size,
    variantMaterialCount: uniqueReferences.length,
  };
}

`;
  visual = visual.replace(anchor, `${helper}${anchor}`);
}

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
      const key = reference?.toUpperCase();`,
  `      const material = source.clone();
      const reference = textureReference(material);
      const key = reference?.toUpperCase();
      const sourceFacadeSelection = node.userData?.sourceFacadeVariationAuthority === "source-package-facade-cell-variation-v31";
      const sourceClosedBaySelection = sourceFacadeSelection && key !== "BGATE1.BMP";`,
  "const sourceFacadeSelection = node.userData?.sourceFacadeVariationAuthority",
  "source-authored cell variation selection",
);

visual = replaceRequired(
  visual,
  `        sourceLightmap: emissiveMap ? \`\${reference} exact _lm source\` : null,
        sourceCutout,`,
  `        sourceLightmap: emissiveMap ? \`\${reference} exact _lm source\` : null,
        sourceDiffuseTexture: reference,
        runtimeDiffuseTexture: reference,
        sourceFacadeSelectionAuthority: sourceFacadeSelection
          ? "source-package-facade-cell-variation-v31"
          : "source-material-unmodified",
        sourceCutout,`,
  "sourceFacadeSelectionAuthority: sourceFacadeSelection",
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
  `  const {
    texturedMaterialCount,`,
  `  const sourceFacadeVariation = splitRepeatedBGATE1Facade(THREE, authored);
  const {
    texturedMaterialCount,`,
  "const sourceFacadeVariation = splitRepeatedBGATE1Facade(THREE, authored);",
  "source facade variation installation",
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
  "  environment.userData.authoredTerminal4SourceCutoutMaterialCount = sourceCutoutMaterialCount;\n  environment.userData.authoredTerminal4SourceClosedBayMaterialCount = sourceClosedBayMaterialCount;\n  environment.userData.authoredTerminal4SourceFacadeSelectionAuthority = sourceFacadeVariation.authority;\n  environment.userData.authoredTerminal4SourceFacadeSplitMeshCount = sourceFacadeVariation.splitMeshCount;\n  environment.userData.authoredTerminal4SourceFacadeCellCount = sourceFacadeVariation.sourceCellCount;\n  environment.userData.authoredTerminal4SourceFacadeOpenCellCount = sourceFacadeVariation.openCellCount;\n  environment.userData.authoredTerminal4SourceFacadeClosedCellCount = sourceFacadeVariation.closedCellCount;\n  environment.userData.authoredTerminal4SourceFacadeVariantMaterialCount = sourceFacadeVariation.variantMaterialCount;",
  "authoredTerminal4SourceFacadeVariantMaterialCount",
  "source facade cell variation environment evidence",
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
    "  group.userData.a1LowerFacadeAuthority = \"source-authored-A1-lower-facade-no-rejected-BGATE1-overlay-v31\";",
    "source-authored-A1-lower-facade-no-rejected-BGATE1-overlay-v31",
    "A1 lower-facade source authority",
  );
  fs.writeFileSync(polishPath, polish, "utf8");
}

console.log("Prepared Terminal 4 facade v31: original BGATE1 faces are split at their source UV repeat cells and cycle package-native facade variants with mostly closed bays, occasional real service openings, and no generated wall or atlas.");
