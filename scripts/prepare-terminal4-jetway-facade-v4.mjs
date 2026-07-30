import fs from "node:fs";

function replaceOnce(path, oldText, newText, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(oldText)) throw new Error(`${path}: v4 anchor is missing for ${label}`);
  source = source.replace(oldText, newText);
  fs.writeFileSync(path, source, "utf8");
}

function replaceAll(path, oldText, newText, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(newText)) return;
  if (!source.includes(oldText)) throw new Error(`${path}: v4 token is missing for ${label}`);
  source = source.replaceAll(oldText, newText);
  fs.writeFileSync(path, source, "utf8");
}

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
for (const [oldText, newText, label] of [
  ['detailLevel: "fsx-air-jetway01-crj-scale-articulated-v3"', 'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v4"', "detail level"],
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25", "door longitudinal target"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3", "door lateral target"],
  ["AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55", "contact clearance"],
]) replaceAll(jetwayPath, oldText, newText, label);

replaceOnce(
  jetwayPath,
  "function createMaterials(THREE) {",
  "function createMaterials(THREE, sourceTextures = {}) {",
  "function createMaterials(THREE, sourceTextures = {})",
  "jetway material source parameter",
);

replaceOnce(
  jetwayPath,
  `  return {
    shell: standard("AIR_Jetway01 warm-gray outer shell", 0xb6b8b8, 0.66, 0.16),
    innerShell: standard("AIR_Jetway01 telescoping inner shell", 0xa4a8aa, 0.62, 0.2),
    cabin: standard("AIR_Jetway01 aircraft cabin", 0xc0c1bf, 0.64, 0.15),`,
  `  const withExactJetwayTexture = (material, repeatX, repeatY, emissiveIntensity = 0.16) => {
    if (!sourceTextures.diffuse) return material;
    const map = sourceTextures.diffuse.clone();
    map.name = \`M1DGJETWAY exact source for \${material.name}\`;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.needsUpdate = true;
    material.map = map;
    if (sourceTextures.emissive) {
      const emissiveMap = sourceTextures.emissive.clone();
      emissiveMap.name = \`M1DGJETWAY_LM exact source for \${material.name}\`;
      emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
      emissiveMap.repeat.set(repeatX, repeatY);
      emissiveMap.needsUpdate = true;
      material.emissiveMap = emissiveMap;
      material.emissive.setHex(0xffffff);
      material.emissiveIntensity = emissiveIntensity;
    }
    material.color.setHex(0xffffff);
    material.userData = {
      ...(material.userData || {}),
      exactJetwayTexture: "M1DGJETWAY.BMP",
      exactJetwayLightmap: sourceTextures.emissive ? "M1DGJETWAY_LM.BMP" : null,
      textureAuthority: "exact-recovered-original-freeware-archive",
    };
    return material;
  };
  return {
    shell: withExactJetwayTexture(standard("AIR_Jetway01 exact-source outer shell", 0xffffff, 0.68, 0.1), 1.15, 2.6, 0.12),
    innerShell: withExactJetwayTexture(standard("AIR_Jetway01 exact-source telescoping shell", 0xffffff, 0.64, 0.12), 1.0, 2.25, 0.12),
    cabin: withExactJetwayTexture(standard("AIR_Jetway01 exact-source aircraft cabin", 0xffffff, 0.66, 0.08), 0.9, 1.35, 0.18),`,
  "const withExactJetwayTexture = (material",
  "exact recovered jetway material application",
);

replaceOnce(
  jetwayPath,
  "export function buildSourcePlacedTerminal4Jetways(THREE, terminal) {",
  "export function buildSourcePlacedTerminal4Jetways(THREE, terminal, sourceTextures = {}) {",
  "buildSourcePlacedTerminal4Jetways(THREE, terminal, sourceTextures = {})",
  "jetway texture builder parameter",
);
replaceOnce(
  jetwayPath,
  "  const materials = createMaterials(THREE);",
  "  const materials = createMaterials(THREE, sourceTextures);",
  "createMaterials(THREE, sourceTextures)",
  "jetway texture material creation",
);
replaceOnce(
  jetwayPath,
  "  let terminal4FacadeInfillCount = 0;",
  "  let terminal4FacadeInfillCount = 0;\n  let terminal4LowerFacadeFitCount = 0;",
  "let terminal4LowerFacadeFitCount = 0",
  "lower facade fit counter",
);
replaceOnce(
  jetwayPath,
  `    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);
    if (terminalWallDistance != null) terminalConnectedCount += 1;`,
  `    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);
    const lowerFacadeWallDistance = findTerminalWallDistance(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      1.25,
    );
    if (terminalWallDistance != null) terminalConnectedCount += 1;`,
  "const lowerFacadeWallDistance = findTerminalWallDistance",
  "lower facade wall measurement",
);
replaceOnce(
  jetwayPath,
  `    if (terminalWallDistance != null && !keepServiceBayOpen) {
      const facadeX = jetway.x - ux * Math.max(0.08, terminalWallDistance - 0.06);
      const facadeZ = jetway.z - uz * Math.max(0.08, terminalWallDistance - 0.06);
      transforms.facadeInfill.push({
        position: [facadeX, 1.12, facadeZ],
        yaw,
        scale: [5.55, 2.18, 0.16],
      });`,
  `    const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance;
    if (lowerWallFit != null && !keepServiceBayOpen) {
      // Measure the wall at ramp level rather than reusing the elevated rotunda
      // intersection. Place the closure toward the ramp so it visibly covers the
      // legacy repeated bay instead of landing behind the authored facade.
      const facadeX = jetway.x - ux * lowerWallFit + ux * 0.35;
      const facadeZ = jetway.z - uz * lowerWallFit + uz * 0.35;
      transforms.facadeInfill.push({
        position: [facadeX, 1.32, facadeZ],
        yaw,
        scale: [5.72, 2.58, 0.42],
      });
      terminal4LowerFacadeFitCount += 1;`,
  "const lowerWallFit = lowerFacadeWallDistance",
  "visible lower facade placement",
);
replaceAll(jetwayPath, "facadeX + px * 1.35 + ux * 0.1", "facadeX + px * 1.35 + ux * 0.56", "service door forward offset x");
replaceAll(jetwayPath, "facadeZ + pz * 1.35 + uz * 0.1", "facadeZ + pz * 1.35 + uz * 0.56", "service door forward offset z");
replaceAll(jetwayPath, "facadeX - px * 1.45 + ux * 0.1", "facadeX - px * 1.45 + ux * 0.56", "vent forward offset x");
replaceAll(jetwayPath, "facadeZ - pz * 1.45 + uz * 0.1", "facadeZ - pz * 1.45 + uz * 0.56", "vent forward offset z");
replaceOnce(
  jetwayPath,
  "  group.userData.facadeInfillCount = terminal4FacadeInfillCount;",
  "  group.userData.facadeInfillCount = terminal4FacadeInfillCount;\n  group.userData.lowerFacadeFitCount = terminal4LowerFacadeFitCount;",
  "group.userData.lowerFacadeFitCount",
  "lower facade runtime evidence",
);
replaceOnce(
  jetwayPath,
  "  group.userData.usesTerminalBuildingTextures = false;",
  `  group.userData.usesTerminalBuildingTextures = false;
  group.userData.usesExactRecoveredJetwayTexture = Boolean(sourceTextures.diffuse);
  group.userData.usesExactRecoveredJetwayLightmap = Boolean(sourceTextures.emissive);
  group.userData.jetwayTextureAuthority = sourceTextures.diffuse
    ? "M1DGJETWAY exact recovered original freeware texture and lightmap"
    : "missing";`,
  "group.userData.usesExactRecoveredJetwayTexture",
  "jetway source texture runtime evidence",
);

const materializerPath = "scripts/materialize-phx-terminal4.mjs";
replaceOnce(
  materializerPath,
  "const exactTextureCount = Object.values(materialTextures).filter((entry) => entry.fidelity.startsWith(\"exact\")).length;",
  `const JETWAY_TEXTURE_SOURCE = Object.freeze({
  diffuse: { file: "M1DGJETWAY.BMP", sha256: "6f7b4e3a91020e1f1db54667a0cbe1152c6f6b99497ce39e135aa1312a3df41f" },
  emissive: { file: "M1DGJETWAY_LM.BMP", sha256: "7681fa27310661358a059ece3bd861a7a0c5fa1878e626adbc92650755de04f0" },
});
const emitJetwayTexture = async (entry, outputName) => {
  const sourceBytes = await readFile(path.join(EXACT_TEXTURE_DIR, entry.file));
  const sourceHash = sha256(sourceBytes);
  if (sourceHash !== entry.sha256) throw new Error(\`Exact recovered jetway texture identity mismatch for \${entry.file}\`);
  const decoded = decodeSourceTexture(sourceBytes);
  const png = encodePng(decoded.width, decoded.height, decoded.rgba);
  await writeFile(path.join(TEXTURE_DIR, outputName), png);
  return {
    url: \`textures/\${outputName}\`,
    sourceFile: entry.file,
    sourceSha256: sourceHash,
    pngSha256: sha256(png),
    width: decoded.width,
    height: decoded.height,
    compression: decoded.compression,
    fidelity: "exact-recovered-original-freeware",
  };
};
const exactJetwayTextures = {
  diffuse: await emitJetwayTexture(JETWAY_TEXTURE_SOURCE.diffuse, "M1DGJETWAY.png"),
  emissive: await emitJetwayTexture(JETWAY_TEXTURE_SOURCE.emissive, "M1DGJETWAY_LM.png"),
};

const exactTextureCount = Object.values(materialTextures).filter((entry) => entry.fidelity.startsWith("exact")).length;`,
  "const exactJetwayTextures = {",
  "exact recovered jetway texture emission",
);
replaceOnce(
  materializerPath,
  "  materials: materialTextures,\n};",
  "  materials: materialTextures,\n  jetway: exactJetwayTextures,\n};",
  "jetway: exactJetwayTextures",
  "jetway texture manifest",
);
replaceOnce(
  materializerPath,
  "  exactRecoveredArchiveSha256: \"0cc4d2eac2249f4b477b9d1cb273b845b9dab08a17d60aa53f9c16d76f0861f5\",",
  `  exactRecoveredArchiveSha256: "0cc4d2eac2249f4b477b9d1cb273b845b9dab08a17d60aa53f9c16d76f0861f5",
  jetwayTextureStatus: "exact-M1DGJETWAY-day-and-night-active",
  jetwayTextures: exactJetwayTextures,`,
  "jetwayTextureStatus: \"exact-M1DGJETWAY-day-and-night-active\"",
  "jetway runtime manifest",
);

const terminalPath = "src/environment/authoredTerminal4Visual.js";
replaceOnce(
  terminalPath,
  "async function loadSourceTextures(THREE, baseUrl) {",
  `async function loadExactJetwayTextures(THREE, baseUrl) {
  const loader = new THREE.TextureLoader();
  const [diffuse, emissive] = await Promise.all([
    loader.loadAsync(\`${"${baseUrl}"}textures/M1DGJETWAY.png\`),
    loader.loadAsync(\`${"${baseUrl}"}textures/M1DGJETWAY_LM.png\`),
  ]);
  return {
    diffuse: configureRuntimeTexture(THREE, diffuse, "M1DGJETWAY exact recovered source", THREE.RepeatWrapping),
    emissive: configureRuntimeTexture(THREE, emissive, "M1DGJETWAY_LM exact recovered source", THREE.RepeatWrapping),
    authority: "exact-recovered-original-freeware-archive",
  };
}

async function loadSourceTextures(THREE, baseUrl) {`,
  "async function loadExactJetwayTextures",
  "jetway texture runtime loader",
);
replaceOnce(
  terminalPath,
  `  const [{ scene: authored }, { textures, emissiveTextures, manifest }] = await Promise.all([
    new GLTFLoader().loadAsync(\`${"${baseUrl}"}terminal4.gltf\`),
    loadSourceTextures(THREE, baseUrl),
  ]);`,
  `  const [{ scene: authored }, { textures, emissiveTextures, manifest }, jetwayTextures] = await Promise.all([
    new GLTFLoader().loadAsync(\`${"${baseUrl}"}terminal4.gltf\`),
    loadSourceTextures(THREE, baseUrl),
    loadExactJetwayTextures(THREE, baseUrl),
  ]);`,
  "jetwayTextures] = await Promise.all",
  "jetway texture asynchronous load",
);
replaceOnce(
  terminalPath,
  "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored);",
  "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);",
  "buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures)",
  "jetway texture builder input",
);
replaceOnce(
  terminalPath,
  "  environment.userData.authoredTerminal4FacadeInfillCount = sourcePlacedJetways.userData.facadeInfillCount;",
  `  environment.userData.authoredTerminal4FacadeInfillCount = sourcePlacedJetways.userData.facadeInfillCount;
  environment.userData.authoredTerminal4LowerFacadeFitCount = sourcePlacedJetways.userData.lowerFacadeFitCount;
  environment.userData.authoredTerminal4JetwayTextureAuthority = sourcePlacedJetways.userData.jetwayTextureAuthority;
  environment.userData.authoredTerminal4ExactJetwayTextureActive = sourcePlacedJetways.userData.usesExactRecoveredJetwayTexture;
  environment.userData.authoredTerminal4ExactJetwayLightmapActive = sourcePlacedJetways.userData.usesExactRecoveredJetwayLightmap;`,
  "authoredTerminal4JetwayTextureAuthority",
  "jetway and lower facade environment evidence",
);

const runtimePath = "scripts/prepare-terminal4-runtime.mjs";
replaceOnce(
  runtimePath,
  '    renderer.domElement.dataset.terminal4JetwayDetailLevel = "loading";',
  `    renderer.domElement.dataset.terminal4JetwayDetailLevel = "loading";
    renderer.domElement.dataset.terminal4LowerFacadeFitCount = "loading";
    renderer.domElement.dataset.terminal4JetwayTextureAuthority = "loading";
    renderer.domElement.dataset.terminal4ExactJetwayTextureActive = "loading";`,
  "dataset.terminal4LowerFacadeFitCount = \"loading\"",
  "runtime loading evidence",
);
replaceOnce(
  runtimePath,
  '        renderer.domElement.dataset.terminal4JetwayDetailLevel = environment.userData.authoredTerminal4JetwayDetailLevel || "missing";',
  `        renderer.domElement.dataset.terminal4JetwayDetailLevel = environment.userData.authoredTerminal4JetwayDetailLevel || "missing";
        renderer.domElement.dataset.terminal4LowerFacadeFitCount = String(environment.userData.authoredTerminal4LowerFacadeFitCount ?? 0);
        renderer.domElement.dataset.terminal4JetwayTextureAuthority = environment.userData.authoredTerminal4JetwayTextureAuthority || "missing";
        renderer.domElement.dataset.terminal4ExactJetwayTextureActive = String(environment.userData.authoredTerminal4ExactJetwayTextureActive === true);`,
  "authoredTerminal4LowerFacadeFitCount ?? 0",
  "runtime success evidence",
);
replaceOnce(
  runtimePath,
  '        renderer.domElement.dataset.terminal4JetwayDetailLevel = "load-error";',
  `        renderer.domElement.dataset.terminal4JetwayDetailLevel = "load-error";
        renderer.domElement.dataset.terminal4LowerFacadeFitCount = "load-error";
        renderer.domElement.dataset.terminal4JetwayTextureAuthority = "load-error";
        renderer.domElement.dataset.terminal4ExactJetwayTextureActive = "load-error";`,
  "dataset.terminal4LowerFacadeFitCount = \"load-error\"",
  "runtime failure evidence",
);

const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
for (const [oldText, newText, label] of [
  ['detailLevel: "fsx-air-jetway01-crj-scale-articulated-v3"', 'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v4"', "verifier detail level"],
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25", "verifier door longitudinal target"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3", "verifier door lateral target"],
  ["AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55", "verifier contact clearance"],
]) replaceAll(verifierPath, oldText, newText, label);
replaceOnce(
  verifierPath,
  '  "facadeInfillCount",',
  `  "facadeInfillCount",
  "lowerFacadeFitCount",
  "M1DGJETWAY exact recovered original freeware texture and lightmap",
  "usesExactRecoveredJetwayTexture",`,
  '"lowerFacadeFitCount"',
  "v4 verifier contracts",
);

const browserPath = "tests/browser/kphx-ground-runtime.spec.js";
replaceOnce(
  browserPath,
  '  "/models/phx-terminal4/textures/RW.png",',
  `  "/models/phx-terminal4/textures/RW.png",
  "/models/phx-terminal4/textures/M1DGJETWAY.png",
  "/models/phx-terminal4/textures/M1DGJETWAY_LM.png",`,
  '"/models/phx-terminal4/textures/M1DGJETWAY.png"',
  "browser jetway assets",
);
replaceAll(browserPath, '"fsx-air-jetway01-crj-scale-articulated-v3"', '"fsx-air-jetway01-exact-textured-crj-scale-v4"', "browser detail level");
replaceOnce(
  browserPath,
  "  expect(Number(runtime.terminal4OpenServiceBayCount)).toBe(6);",
  `  expect(Number(runtime.terminal4OpenServiceBayCount)).toBe(6);
  expect(Number(runtime.terminal4LowerFacadeFitCount)).toBeGreaterThan(45);
  expect(runtime.terminal4ExactJetwayTextureActive).toBe("true");
  expect(runtime.terminal4JetwayTextureAuthority).toContain("M1DGJETWAY exact recovered");`,
  "terminal4LowerFacadeFitCount",
  "browser v4 visual authority assertions",
);

for (const [path, tokens] of Object.entries({
  [jetwayPath]: [
    'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v4"',
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
    "const lowerFacadeWallDistance = findTerminalWallDistance",
    "const withExactJetwayTexture = (material",
    "group.userData.lowerFacadeFitCount",
    "usesExactRecoveredJetwayTexture",
  ],
  [materializerPath]: ["M1DGJETWAY.png", "M1DGJETWAY_LM.png", "exactJetwayTextures"],
  [terminalPath]: ["loadExactJetwayTextures", "authoredTerminal4JetwayTextureAuthority"],
  [runtimePath]: ["terminal4LowerFacadeFitCount", "terminal4JetwayTextureAuthority"],
  [verifierPath]: ["lowerFacadeFitCount", "usesExactRecoveredJetwayTexture"],
  [browserPath]: ["M1DGJETWAY.png", "terminal4LowerFacadeFitCount"],
})) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${path}: v4 preparation is missing ${token}`);
}

console.log("Prepared Terminal 4 v4: exact M1DGJETWAY day/night textures, lower-wall facade fits, visible gate-module closures and aft CRJ forward-door contact.");
