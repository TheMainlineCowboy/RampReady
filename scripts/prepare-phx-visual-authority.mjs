import fs from "node:fs";

function update(path, operations) {
  let source = fs.readFileSync(path, "utf8");
  for (const { oldText, newText, marker } of operations) {
    if (source.includes(marker)) continue;
    if (!source.includes(oldText)) throw new Error(`${path}: visual-authority anchor is missing for ${marker}`);
    source = source.replace(oldText, newText);
  }
  fs.writeFileSync(path, source, "utf8");
}

update("src/environment/authoredTerminal4Visual.js", [
  {
    marker: 'manifestUrl.searchParams.set("materialPass"',
    oldText: `async function loadTextureManifest(baseUrl) {
  const manifestUrl = \`${"${baseUrl}"}texture-manifest.json\`;
  const response = await fetch(manifestUrl, { cache: "force-cache" });
  if (!response.ok) throw new Error(\`Terminal 4 texture manifest returned HTTP ${"${response.status}"}\`);
  const manifest = await response.json();
  if (manifest.schemaVersion !== 2 || !manifest.materials) throw new Error("Terminal 4 texture manifest is invalid");
  if (manifest.emissiveTextureCount !== 15) throw new Error(\`Terminal 4 exact lightmap count is ${"${manifest.emissiveTextureCount}"}\`);
  return { manifest, manifestUrl: new URL(manifestUrl, window.location.href) };
}`,
    newText: `async function loadTextureManifest(baseUrl) {
  const manifestUrl = new URL(\`${"${baseUrl}"}texture-manifest.json\`, window.location.href);
  manifestUrl.searchParams.set("materialPass", AUTHORED_TERMINAL4_PROFILE.materialPass);
  const response = await fetch(manifestUrl.href, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!response.ok) throw new Error(\`Terminal 4 texture manifest returned HTTP ${"${response.status}"}\`);
  const manifest = await response.json();
  if (manifest.schemaVersion !== 2 || !manifest.materials) throw new Error("Terminal 4 texture manifest is invalid");
  const exactLightmapCount = Number.isInteger(manifest.emissiveTextureCount)
    ? manifest.emissiveTextureCount
    : Object.values(manifest.materials).filter((entry) => entry?.emissiveUrl).length;
  if (exactLightmapCount !== 15) throw new Error(\`Terminal 4 exact lightmap count is ${"${exactLightmapCount}"}\`);
  manifest.emissiveTextureCount = exactLightmapCount;
  return { manifest, manifestUrl };
}`,
  },
]);

update("src/environment/authoredKphxPhotoGround.js", [
  {
    marker: 'manifestUrl.searchParams.set("textureMode"',
    oldText: `async function fetchManifest(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(\`PHX aerial manifest returned HTTP ${"${response.status}"}\`);
  const manifest = await response.json();`,
    newText: `async function fetchManifest(url) {
  const manifestUrl = new URL(url, window.location.href);
  manifestUrl.searchParams.set("textureMode", AUTHORED_KPHX_PHOTO_PROFILE.textureMode);
  const response = await fetch(manifestUrl.href, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!response.ok) throw new Error(\`PHX aerial manifest returned HTTP ${"${response.status}"}\`);
  const manifest = await response.json();`,
  },
  {
    marker: "tileVersion = encodeURIComponent",
    oldText: `  const textureLoader = new THREE.TextureLoader();
  const loadedTiles = await Promise.all(manifest.tiles.map(async (tile, index) => {
    const texture = await textureLoader.loadAsync(\`${"${baseUrl}"}${"${tile.file}"}\`);`,
    newText: `  const textureLoader = new THREE.TextureLoader();
  const tileVersion = encodeURIComponent(manifest.image.sha256.slice(0, 16));
  const loadedTiles = await Promise.all(manifest.tiles.map(async (tile, index) => {
    const texture = await textureLoader.loadAsync(\`${"${baseUrl}"}${"${tile.file}"}?v=${"${tileVersion}"}\`);`,
  },
]);

update("src/environment/authoredKphxGround.js", [
  {
    marker: 'surfaceMaterialMode: "authored-pavement-nearfield-over-source-aerial-background"',
    oldText: `  detailLevel: "terminal4-authored-textured-v4-source-ramp-exact-a1-nearfield",
  surfaceMaterialMode: "source-aerial-diffuse-with-source-atlas-nearfield-concrete",`,
    newText: `  detailLevel: "terminal4-authored-pavement-v5-source-ramp-stand-markings",
  surfaceMaterialMode: "authored-pavement-nearfield-over-source-aerial-background",`,
  },
  {
    marker: "PHX supplied PARKRAMPS opaque near-field concrete",
    oldText: `    // Use the exact source strip as a transparent detail decal. Slab faces stay
    // almost clear so the georeferenced aerial remains visible; the authored dark
    // joints receive strong alpha and stay crisp at tug height.
    const detail = Math.max(45, Math.min(135, 90 + (luminance - meanLuminance) * 0.7));
    const alpha = Math.max(10, Math.min(235, 14 + darkness * 6));
    detailPixels.data[index] = Math.min(255, detail + 3);
    detailPixels.data[index + 1] = Math.min(255, detail + 2);
    detailPixels.data[index + 2] = detail;
    detailPixels.data[index + 3] = alpha;`,
    newText: `    // Tug-height pavement must not depend on the airport-wide aerial, which is
    // only about one source pixel per 1.2-1.3 meters. Convert the supplied clean
    // concrete strip into an opaque, neutral apron tile with crisp authored joints.
    const detail = Math.max(108, Math.min(198, 158 + (luminance - meanLuminance) * 0.72 - darkness * 0.10));
    detailPixels.data[index] = Math.min(255, detail + 5);
    detailPixels.data[index + 1] = Math.min(255, detail + 4);
    detailPixels.data[index + 2] = Math.min(255, detail + 1);
    detailPixels.data[index + 3] = 255;`,
  },
  {
    marker: '"PHX supplied PARKRAMPS opaque near-field concrete"',
    oldText: `      "PHX supplied PARKRAMPS transparent near-field joint decal",`,
    newText: `      "PHX supplied PARKRAMPS opaque near-field concrete",`,
  },
  {
    marker: 'diffuseAuthority: "authored-kphx-pavement-nearfield"',
    oldText: `        diffuseAuthority: "source-authored-phx-photo",
        sourceAtlasPolicy: "crop-clean-source-concrete-strip-never-repeat-entire-atlas",`,
    newText: `        diffuseAuthority: "authored-kphx-pavement-nearfield",
        sourceAtlasPolicy: "crop-clean-source-concrete-strip-never-repeat-entire-atlas",`,
  },
  {
    marker: 'material.userData.nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background"',
    oldText: `      } else if (material.name === "concrete") {
        material.visible = true;
        material.color.setHex(0xffffff);
        material.transparent = true;
        material.opacity = 0.72;
        material.alphaTest = 0.01;
        material.depthWrite = false;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.022;
        material.roughness = 0.95;
        material.metalness = 0;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -1;
        material.polygonOffsetUnits = -1;
        material.userData.nearfieldBlendMode = "transparent-source-joint-decal-over-aerial";
        node.renderOrder = Math.max(node.renderOrder || 0, 30);
        sourceDetailedSurfaceMaterialCount += 1;`,
    newText: `      } else if (material.name === "concrete") {
        material.visible = true;
        material.color.setHex(0xffffff);
        material.transparent = false;
        material.opacity = 1;
        material.alphaTest = 0;
        material.depthWrite = true;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.028;
        material.roughness = 0.96;
        material.metalness = 0;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -1;
        material.polygonOffsetUnits = -1;
        material.userData.nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 30);
        sourceDetailedSurfaceMaterialCount += 1;`,
  },
  {
    marker: 'material.userData.nearfieldBlendMode = "opaque-authored-asphalt-over-aerial-background"',
    oldText: `      } else if (material.name === "asphalt") {
        material.visible = true;
        material.color.setHex(0x555a5e);
        material.transparent = true;
        material.opacity = 0.10;
        material.depthWrite = false;
        material.roughness = 0.98;
        material.metalness = 0;
        node.renderOrder = Math.max(node.renderOrder || 0, 20);
        sourceDetailedSurfaceMaterialCount += 1;`,
    newText: `      } else if (material.name === "asphalt") {
        material.visible = true;
        material.color.setHex(0x4f5456);
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.roughness = 0.98;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "opaque-authored-asphalt-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 20);
        sourceDetailedSurfaceMaterialCount += 1;`,
  },
  {
    marker: 'material.userData.nearfieldBlendMode = "opaque-authored-service-road-over-aerial-background"',
    oldText: `      } else if (material.name === "service-road") {
        material.visible = true;
        material.color.setHex(0x777976);
        material.transparent = true;
        material.opacity = 0.42;
        material.alphaTest = 0.01;
        material.depthWrite = false;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.010;
        material.roughness = 0.97;
        material.metalness = 0;
        node.renderOrder = Math.max(node.renderOrder || 0, 35);
        sourceDetailedSurfaceMaterialCount += 1;`,
    newText: `      } else if (material.name === "service-road") {
        material.visible = true;
        material.color.setHex(0x777976);
        material.transparent = false;
        material.opacity = 1;
        material.alphaTest = 0;
        material.depthWrite = true;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.014;
        material.roughness = 0.97;
        material.metalness = 0;
        material.userData.nearfieldBlendMode = "opaque-authored-service-road-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 35);
        sourceDetailedSurfaceMaterialCount += 1;`,
  },
  {
    marker: "function buildTerminal4StandMarkings(THREE)",
    oldText: `function buildGateMetadata() {`,
    newText: `function appendGroundStrip(positions, indices, a, b, width, y = 0.0022) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return;
  const nx = -dz / length * width / 2;
  const nz = dx / length * width / 2;
  const base = positions.length / 3;
  positions.push(
    a[0] + nx, y, a[1] + nz,
    b[0] + nx, y, b[1] + nz,
    b[0] - nx, y, b[1] - nz,
    a[0] - nx, y, a[1] - nz,
  );
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function buildGateLabel(THREE, gate, x, z, heading) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PHX gate-label canvas is unavailable");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(20, 22, 20, 0.88)";
  context.fillRect(4, 4, 248, 120);
  context.strokeStyle = "#f4c500";
  context.lineWidth = 12;
  context.strokeRect(8, 8, 240, 112);
  context.fillStyle = "#f4c500";
  context.font = "bold 72px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(gate, 128, 67);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  const geometry = new THREE.PlaneGeometry(6.4, 3.2);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -0.25,
    polygonOffsetUnits: -0.5,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = \`PHX_T4_GateLabel_${"${gate}"}\`;
  mesh.position.set(x, 0.0028, z);
  mesh.rotation.y = -heading;
  mesh.renderOrder = 28;
  return mesh;
}

function buildTerminal4StandMarkings(THREE) {
  const group = new THREE.Group();
  group.name = "PHX_T4_SourcePositionedStandMarkings";
  const positions = [];
  const indices = [];
  for (const parking of TERMINAL4_PARKINGS) {
    const heading = THREE.MathUtils.degToRad(parking.h);
    const hx = Math.cos(heading);
    const hz = Math.sin(heading);
    const px = parking.x;
    const pz = parking.z;
    const near = [px + hx * 8, pz + hz * 8];
    const far = [px - hx * 55, pz - hz * 55];
    appendGroundStrip(positions, indices, near, far, 0.28);
    const stopCenter = [px - hx * 2.5, pz - hz * 2.5];
    const sx = -hz * 4.2;
    const sz = hx * 4.2;
    appendGroundStrip(
      positions,
      indices,
      [stopCenter[0] - sx, stopCenter[1] - sz],
      [stopCenter[0] + sx, stopCenter[1] + sz],
      0.32,
      0.0024,
    );
    const labelX = px - hx * 19;
    const labelZ = pz - hz * 19;
    group.add(buildGateLabel(THREE, parking.g, labelX, labelZ, heading));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    color: 0xf4c500,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -0.25,
    polygonOffsetUnits: -0.5,
  });
  const lines = new THREE.Mesh(geometry, material);
  lines.name = "PHX_T4_StandCenterlinesAndStopBars";
  lines.renderOrder = 26;
  group.add(lines);
  group.userData.gateMarkingCount = TERMINAL4_PARKINGS.length;
  group.userData.detailLevel = "source-positioned-terminal4-stand-centerlines-labels-v1";
  return group;
}

function buildGateMetadata() {`,
  },
  {
    marker: "const standMarkings = buildTerminal4StandMarkings(THREE);",
    oldText: `  const materialState = applyAuthoredSurfaceMaterials(THREE, authored, surfaceTextures);

  environment.add(authored);`,
    newText: `  const materialState = applyAuthoredSurfaceMaterials(THREE, authored, surfaceTextures);
  const standMarkings = buildTerminal4StandMarkings(THREE);
  authored.add(standMarkings);

  environment.add(authored);`,
  },
  {
    marker: "authoredGroundGateMarkingCount",
    oldText: `  environment.userData.authoredGroundEnhancedMarkingMaterialCount = materialState.enhancedMarkingMaterialCount;
  environment.userData.authoredGroundSurfaceMaterialMode = AUTHORED_KPHX_GROUND_PROFILE.surfaceMaterialMode;`,
    newText: `  environment.userData.authoredGroundEnhancedMarkingMaterialCount = materialState.enhancedMarkingMaterialCount;
  environment.userData.authoredGroundGateMarkingCount = standMarkings.userData.gateMarkingCount;
  environment.userData.authoredGroundStandMarkingDetailLevel = standMarkings.userData.detailLevel;
  environment.userData.authoredGroundSurfaceMaterialMode = AUTHORED_KPHX_GROUND_PROFILE.surfaceMaterialMode;`,
  },
]);

for (const [path, tokens] of Object.entries({
  "src/environment/authoredTerminal4Visual.js": [
    'cache: "no-store"',
    'manifestUrl.searchParams.set("materialPass"',
    "exactLightmapCount !== 15",
  ],
  "src/environment/authoredKphxPhotoGround.js": [
    'manifestUrl.searchParams.set("textureMode"',
    "tileVersion = encodeURIComponent",
  ],
  "src/environment/authoredKphxGround.js": [
    'surfaceMaterialMode: "authored-pavement-nearfield-over-source-aerial-background"',
    'nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background"',
    "function buildTerminal4StandMarkings(THREE)",
    "authoredGroundGateMarkingCount",
  ],
})) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${path}: prepared PHX visual authority is missing ${token}`);
}

console.log("Prepared PHX visual authority: non-stale Terminal 4 assets, opaque ramp-scale pavement, and source-positioned stand markings.");
