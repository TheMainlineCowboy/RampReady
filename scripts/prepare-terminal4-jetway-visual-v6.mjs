import fs from "node:fs";

function replaceRequired(path, oldText, newText, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(oldText)) throw new Error(`${path}: visual v6 anchor is missing for ${label}`);
  source = source.replace(oldText, newText);
  fs.writeFileSync(path, source, "utf8");
}

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
replaceRequired(
  jetwayPath,
  `  geometry.translate(0, 0, -0.5);
  geometry.computeVertexNormals();
  return geometry;`,
  `  geometry.translate(0, 0, -0.5);
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position");
  const normalizedUv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    normalizedUv[index * 2] = clamp(position.getX(index) / width + 0.5, 0, 1);
    normalizedUv[index * 2 + 1] = clamp(position.getY(index) / height + 0.5, 0, 1);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2));
  return geometry;`,
  'geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2))',
  "normalized tunnel UVs",
);
replaceRequired(
  jetwayPath,
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
  };`,
  `  const exactJetwayAtlasRegions = Object.freeze({
    shell: Object.freeze([0, 0, 1, 0.285]),
    cabin: Object.freeze([0.365, 0.621, 0.213, 0.379]),
    bellows: Object.freeze([0.58, 0.301, 0.213, 0.648]),
  });
  const withExactJetwayTexture = (material, regionName, emissiveIntensity = 0.16) => {
    if (!sourceTextures.diffuse) return material;
    const region = exactJetwayAtlasRegions[regionName];
    if (!region) throw new Error(\`Unknown M1DGJETWAY atlas region \${regionName}\`);
    const configureRegion = (texture, name) => {
      const map = texture.clone();
      map.name = name;
      map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
      map.offset.set(region[0], region[1]);
      map.repeat.set(region[2], region[3]);
      map.needsUpdate = true;
      return map;
    };
    material.map = configureRegion(sourceTextures.diffuse, \`M1DGJETWAY \${regionName} exact source for \${material.name}\`);
    if (sourceTextures.emissive) {
      material.emissiveMap = configureRegion(sourceTextures.emissive, \`M1DGJETWAY_LM \${regionName} exact source for \${material.name}\`);
      material.emissive.setHex(0xffffff);
      material.emissiveIntensity = emissiveIntensity;
    }
    material.color.setHex(0xffffff);
    material.userData = {
      ...(material.userData || {}),
      exactJetwayTexture: "M1DGJETWAY.BMP",
      exactJetwayLightmap: sourceTextures.emissive ? "M1DGJETWAY_LM.BMP" : null,
      exactJetwayAtlasRegion: regionName,
      textureAuthority: "exact-recovered-original-freeware-atlas-region",
    };
    return material;
  };`,
  "exactJetwayAtlasRegions",
  "atlas region mapping",
);
replaceRequired(
  jetwayPath,
  `    shell: withExactJetwayTexture(standard("AIR_Jetway01 exact-source outer shell", 0xffffff, 0.68, 0.1), 1.15, 2.6, 0.12),
    innerShell: withExactJetwayTexture(standard("AIR_Jetway01 exact-source telescoping shell", 0xffffff, 0.64, 0.12), 1.0, 2.25, 0.12),
    cabin: withExactJetwayTexture(standard("AIR_Jetway01 exact-source aircraft cabin", 0xffffff, 0.66, 0.08), 0.9, 1.35, 0.18),`,
  `    shell: withExactJetwayTexture(standard("AIR_Jetway01 exact-source outer shell", 0xffffff, 0.68, 0.1), "shell", 0.12),
    innerShell: withExactJetwayTexture(standard("AIR_Jetway01 exact-source telescoping shell", 0xffffff, 0.64, 0.12), "shell", 0.12),
    cabin: withExactJetwayTexture(standard("AIR_Jetway01 exact-source aircraft cabin", 0xffffff, 0.66, 0.08), "cabin", 0.12),`,
  '"AIR_Jetway01 exact-source outer shell", 0xffffff, 0.68, 0.1), "shell"',
  "shell and cabin regions",
);
replaceRequired(
  jetwayPath,
  `    bellows: standard("AIR_Jetway01 aircraft bellows", 0x1b1e21, 0.92, 0.02),`,
  `    bellows: withExactJetwayTexture(standard("AIR_Jetway01 aircraft bellows", 0xffffff, 0.92, 0.02), "bellows", 0.04),`,
  '"AIR_Jetway01 aircraft bellows", 0xffffff, 0.92, 0.02), "bellows"',
  "bellows atlas region",
);

// Visual v7 supersedes only the facade placement from v6. If the v7 outer-plane
// closure is already present, preserve it rather than demanding the intermediate
// v6 ramp-forward panel or trying to move it back into the recessed bay.
if (!fs.readFileSync(jetwayPath, "utf8").includes("const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance")) {
  replaceRequired(
    jetwayPath,
    `      const facadeX = jetway.x - ux * lowerWallFit + ux * 0.35;
      const facadeZ = jetway.z - uz * lowerWallFit + uz * 0.35;
      transforms.facadeInfill.push({
        position: [facadeX, 1.32, facadeZ],
        yaw,
        scale: [5.72, 2.58, 0.42],
      });`,
    `      const facadeRampOffset = 0.95;
      const facadeX = jetway.x - ux * lowerWallFit + ux * facadeRampOffset;
      const facadeZ = jetway.z - uz * lowerWallFit + uz * facadeRampOffset;
      transforms.facadeInfill.push({
        position: [facadeX, 1.72, facadeZ],
        yaw,
        scale: [6.4, 3.36, 0.68],
      });`,
    "const facadeRampOffset = 0.95",
    "forward full-height facade closure",
  );
}
replaceRequired(
  jetwayPath,
  `          position: [facadeX + px * 1.35 + ux * 0.56, 0.94, facadeZ + pz * 1.35 + uz * 0.56],
          yaw,
          scale: [1.05, 1.78, 0.12],`,
  `          position: [facadeX + px * 1.45 + ux * 0.4, 1.06, facadeZ + pz * 1.45 + uz * 0.4],
          yaw,
          scale: [1.12, 2.02, 0.14],`,
  "scale: [1.12, 2.02, 0.14]",
  "closed service door fit",
);
replaceRequired(
  jetwayPath,
  `          position: [facadeX - px * 1.45 + ux * 0.56, 1.54, facadeZ - pz * 1.45 + uz * 0.56],
          yaw,
          scale: [1.16, 0.32, 0.12],`,
  `          position: [facadeX - px * 1.55 + ux * 0.4, 1.88, facadeZ - pz * 1.55 + uz * 0.4],
          yaw,
          scale: [1.24, 0.36, 0.14],`,
  "scale: [1.24, 0.36, 0.14]",
  "facade vent fit",
);
replaceRequired(
  jetwayPath,
  `  group.userData.jetwayTextureAuthority = sourceTextures.diffuse
    ? "M1DGJETWAY exact recovered original freeware texture and lightmap"
    : "missing";`,
  `  group.userData.jetwayTextureAuthority = sourceTextures.diffuse
    ? "M1DGJETWAY exact recovered original freeware atlas regions and lightmap"
    : "missing";
  group.userData.jetwayTextureMappingAuthority = sourceTextures.diffuse
    ? "normalized-fallback-geometry-uvs-with-exact-atlas-subregions-never-whole-atlas-repeat"
    : "missing";`,
  "jetwayTextureMappingAuthority",
  "texture mapping authority",
);

const animatedPath = "src/environment/animatedA1Jetway.js";
replaceRequired(
  animatedPath,
  `  geometry.translate(0, 0, -0.5);
  geometry.computeVertexNormals();
  return geometry;`,
  `  geometry.translate(0, 0, -0.5);
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position");
  const normalizedUv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    normalizedUv[index * 2] = clamp(position.getX(index) / width + 0.5, 0, 1);
    normalizedUv[index * 2 + 1] = clamp(position.getY(index) / height + 0.5, 0, 1);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2));
  return geometry;`,
  'geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2))',
  "animated A1 normalized UVs",
);

for (const [path, tokens, forbidden] of [
  [jetwayPath, [
    "exactJetwayAtlasRegions",
    'exactJetwayAtlasRegion: regionName',
    '"shell", 0.12',
    '"cabin", 0.12',
    '"bellows", 0.04',
    "jetwayTextureMappingAuthority",
  ], [
    "map.wrapS = map.wrapT = THREE.RepeatWrapping",
    "map.repeat.set(repeatX, repeatY)",
    "position: [facadeX, 1.32, facadeZ]",
    "scale: [5.72, 2.58, 0.42]",
  ]],
  [animatedPath, [
    'geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2))',
  ], []],
]) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${path}: jetway visual v6 is missing ${token}`);
  for (const token of forbidden) if (source.includes(token)) throw new Error(`${path}: obsolete jetway visual token remains ${token}`);
}
const preparedJetways = fs.readFileSync(jetwayPath, "utf8");
const hasV6Facade = preparedJetways.includes("const facadeRampOffset = 0.95")
  && preparedJetways.includes("scale: [6.4, 3.36, 0.68]");
const hasV7Facade = preparedJetways.includes("const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance")
  && preparedJetways.includes("scale: [7.0, 3.42, 0.5]");
if (!hasV6Facade && !hasV7Facade) throw new Error("Jetway visual preparation has neither the v6 nor superseding v7 facade contract");

console.log("Prepared Terminal 4 jetway visual v6: normalized source-scale UVs, exact atlas subregions, non-striped shell/cabin/bellows materials, and a v6-or-newer facade closure.");
