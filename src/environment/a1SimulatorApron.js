export const A1_SIMULATOR_APRON_PROFILE = Object.freeze({
  sourceAerial: "models/kphx-photo/phx-airport-photo.webp",
  sourceMaterialReference: "models/phx-terminal4/textures/PARKRAMPS.png",
  bounds: Object.freeze({ minX: -35, maxX: 300, minZ: -92, maxZ: 38 }),
  photoSceneBounds: Object.freeze({
    north: 957.2170236474195,
    south: -1794.5159946189253,
    west: -3703.4637473759662,
    east: 4801.396159291422,
  }),
  surfaceY: 0.021,
  textureWidth: 2048,
  textureHeight: 1024,
  textureResolution: "2048x1024",
  detailLevel: "a1-a8-normalized-source-aerial-pbr-apron-v3",
});

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function worldToCanvas(width, height) {
  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  return {
    x: (worldX) => (worldX - minX) / (maxX - minX) * width,
    z: (worldZ) => height - (worldZ - minZ) / (maxZ - minZ) * height,
  };
}

function sourceCrop(image) {
  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  const { north, south, west, east } = A1_SIMULATOR_APRON_PROFILE.photoSceneBounds;
  const uWest = (minZ - west) / (east - west);
  const uEast = (maxZ - west) / (east - west);
  const vSouth = (minX - south) / (north - south);
  const vNorth = (maxX - south) / (north - south);
  return {
    x: clamp(uWest * image.width, 0, image.width - 1),
    y: clamp((1 - vNorth) * image.height, 0, image.height - 1),
    width: clamp((uEast - uWest) * image.width, 1, image.width),
    height: clamp((vNorth - vSouth) * image.height, 1, image.height),
  };
}

function normalizeSourceAerial(context, image, width, height) {
  const crop = sourceCrop(image);
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const random = seededNoise(0x50485241);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const luminance = Math.max(1, red * 0.2126 + green * 0.7152 + blue * 0.0722);

    // Compress the baked aerial's extreme black aircraft/jetway shadows and white
    // missing-tile smears while retaining its exact local color and spatial grain.
    let normalizedLuminance = 142 + (luminance - 142) * 0.23;
    if (luminance < 72) normalizedLuminance = 118 + luminance * 0.16;
    if (luminance > 205) normalizedLuminance = 160 + (luminance - 205) * 0.04;
    normalizedLuminance = clamp(normalizedLuminance, 112, 171);
    const aggregate = (random() - 0.5) * 8;
    const chromaScale = 0.24;
    pixels.data[index] = clamp(normalizedLuminance + (red - luminance) * chromaScale + aggregate + 1, 0, 255);
    pixels.data[index + 1] = clamp(normalizedLuminance + (green - luminance) * chromaScale + aggregate, 0, 255);
    pixels.data[index + 2] = clamp(normalizedLuminance + (blue - luminance) * chromaScale + aggregate - 2, 0, 255);
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
}

function drawConcreteDetails(diffuseContext, bumpContext, roughnessContext, width, height) {
  const random = seededNoise(0xa1a8c0de);
  const transform = worldToCanvas(width, height);
  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;

  bumpContext.fillStyle = "rgb(128,128,128)";
  bumpContext.fillRect(0, 0, width, height);
  roughnessContext.fillStyle = "rgb(232,232,232)";
  roughnessContext.fillRect(0, 0, width, height);

  // Concrete slab joints use real-world spacing and consistent meter scale.
  for (let x = Math.ceil(minX / 11.5) * 11.5; x <= maxX; x += 11.5) {
    const px = transform.x(x);
    diffuseContext.strokeStyle = "rgba(38,40,40,0.28)";
    diffuseContext.lineWidth = 1.25;
    diffuseContext.beginPath();
    diffuseContext.moveTo(px, 0);
    diffuseContext.lineTo(px, height);
    diffuseContext.stroke();
    diffuseContext.strokeStyle = "rgba(225,224,217,0.08)";
    diffuseContext.lineWidth = 0.7;
    diffuseContext.beginPath();
    diffuseContext.moveTo(px + 1.5, 0);
    diffuseContext.lineTo(px + 1.5, height);
    diffuseContext.stroke();
    bumpContext.strokeStyle = "rgb(72,72,72)";
    bumpContext.lineWidth = 1.6;
    bumpContext.beginPath();
    bumpContext.moveTo(px, 0);
    bumpContext.lineTo(px, height);
    bumpContext.stroke();
  }
  for (let z = Math.ceil(minZ / 9.5) * 9.5; z <= maxZ; z += 9.5) {
    const py = transform.z(z);
    diffuseContext.strokeStyle = "rgba(38,40,40,0.26)";
    diffuseContext.lineWidth = 1.25;
    diffuseContext.beginPath();
    diffuseContext.moveTo(0, py);
    diffuseContext.lineTo(width, py);
    diffuseContext.stroke();
    diffuseContext.strokeStyle = "rgba(225,224,217,0.075)";
    diffuseContext.lineWidth = 0.7;
    diffuseContext.beginPath();
    diffuseContext.moveTo(0, py - 1.5);
    diffuseContext.lineTo(width, py - 1.5);
    diffuseContext.stroke();
    bumpContext.strokeStyle = "rgb(75,75,75)";
    bumpContext.lineWidth = 1.6;
    bumpContext.beginPath();
    bumpContext.moveTo(0, py);
    bumpContext.lineTo(width, py);
    bumpContext.stroke();
  }

  // High-frequency aggregate, repairs and hairline cracking remove the blurry
  // browser-ground appearance at driver height without obscuring decoded markings.
  for (let speck = 0; speck < 24_000; speck += 1) {
    const x = random() * width;
    const y = random() * height;
    const light = random() > 0.52;
    const alpha = 0.018 + random() * 0.052;
    diffuseContext.fillStyle = light
      ? `rgba(235,233,225,${alpha * 0.7})`
      : `rgba(28,30,30,${alpha})`;
    const radius = 0.25 + random() * 0.95;
    diffuseContext.fillRect(x, y, radius, radius);
    const bumpValue = light ? 145 : 112;
    bumpContext.fillStyle = `rgb(${bumpValue},${bumpValue},${bumpValue})`;
    bumpContext.fillRect(x, y, Math.max(0.5, radius), Math.max(0.5, radius));
  }

  for (let patch = 0; patch < 22; patch += 1) {
    const x = random() * width;
    const y = random() * height;
    const patchWidth = 24 + random() * 84;
    const patchHeight = 8 + random() * 30;
    diffuseContext.save();
    diffuseContext.translate(x, y);
    diffuseContext.rotate((random() - 0.5) * 0.08);
    diffuseContext.fillStyle = `rgba(70,72,70,${0.024 + random() * 0.042})`;
    diffuseContext.fillRect(-patchWidth / 2, -patchHeight / 2, patchWidth, patchHeight);
    diffuseContext.strokeStyle = "rgba(35,36,35,0.08)";
    diffuseContext.lineWidth = 1;
    diffuseContext.strokeRect(-patchWidth / 2, -patchHeight / 2, patchWidth, patchHeight);
    diffuseContext.restore();
  }

  diffuseContext.strokeStyle = "rgba(43,45,45,0.17)";
  diffuseContext.lineWidth = 0.85;
  bumpContext.strokeStyle = "rgb(103,103,103)";
  bumpContext.lineWidth = 1;
  for (let crack = 0; crack < 70; crack += 1) {
    let x = random() * width;
    let y = random() * height;
    diffuseContext.beginPath();
    bumpContext.beginPath();
    diffuseContext.moveTo(x, y);
    bumpContext.moveTo(x, y);
    for (let segment = 0; segment < 4 + Math.floor(random() * 7); segment += 1) {
      x += (random() - 0.5) * 26;
      y += 4 + random() * 16;
      diffuseContext.lineTo(x, y);
      bumpContext.lineTo(x, y);
    }
    diffuseContext.stroke();
    bumpContext.stroke();
  }

  // Tire arcs and localized fluid staining follow the decoded A-gate stand row.
  diffuseContext.strokeStyle = "rgba(25,27,27,0.12)";
  diffuseContext.lineCap = "round";
  diffuseContext.lineWidth = 5.5;
  for (const gate of [
    [0, 6.2], [86.3, -51.7], [86.3, 6.2], [172.5, -51.7],
    [172.5, 6.2], [258.8, -51.7], [258.8, 6.2],
  ]) {
    const x = transform.x(gate[0]);
    const y = transform.z(gate[1]);
    for (const radius of [28, 35]) {
      diffuseContext.beginPath();
      diffuseContext.arc(x, y, radius, Math.PI * 0.16, Math.PI * 0.84);
      diffuseContext.stroke();
    }
    const stain = diffuseContext.createRadialGradient(x, y + 14, 0, x, y + 14, 38);
    stain.addColorStop(0, "rgba(32,30,27,0.095)");
    stain.addColorStop(0.5, "rgba(42,39,34,0.038)");
    stain.addColorStop(1, "rgba(42,39,34,0)");
    diffuseContext.fillStyle = stain;
    diffuseContext.beginPath();
    diffuseContext.ellipse(x, y + 14, 38, 15, 0, 0, Math.PI * 2);
    diffuseContext.fill();
  }
}

function buildPavementTextures(sourceImage) {
  const width = A1_SIMULATOR_APRON_PROFILE.textureWidth;
  const height = A1_SIMULATOR_APRON_PROFILE.textureHeight;
  const diffuseCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const roughnessCanvas = document.createElement("canvas");
  diffuseCanvas.width = bumpCanvas.width = roughnessCanvas.width = width;
  diffuseCanvas.height = bumpCanvas.height = roughnessCanvas.height = height;
  const diffuseContext = diffuseCanvas.getContext("2d", { willReadFrequently: true });
  const bumpContext = bumpCanvas.getContext("2d");
  const roughnessContext = roughnessCanvas.getContext("2d");
  if (!diffuseContext || !bumpContext || !roughnessContext) throw new Error("A1 simulator apron texture canvases are unavailable");
  normalizeSourceAerial(diffuseContext, sourceImage, width, height);
  drawConcreteDetails(diffuseContext, bumpContext, roughnessContext, width, height);
  return { diffuseCanvas, bumpCanvas, roughnessCanvas };
}

function configureCanvasTexture(THREE, canvas, name, colorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = colorSpace;
  texture.flipY = false;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function buildApronGeometry(THREE) {
  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    maxX, 0, minZ,
    minX, 0, minZ,
    minX, 0, maxZ,
    maxX, 0, maxZ,
  ], 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute([
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
    0, 1,
    0, 0,
    1, 0,
    1, 1,
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeBoundingSphere();
  return geometry;
}

export async function installA1SimulatorApron(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required for A1 apron detail");
  if (environment.userData.a1SimulatorApron) return environment.userData.a1SimulatorApron;
  const aerialUrl = `${import.meta.env.BASE_URL}${A1_SIMULATOR_APRON_PROFILE.sourceAerial}`;
  const sourceAerial = await new THREE.TextureLoader().loadAsync(aerialUrl);
  if (!sourceAerial.image?.width || !sourceAerial.image?.height) throw new Error("PHX source aerial did not decode for A-gate pavement");
  const { diffuseCanvas, bumpCanvas, roughnessCanvas } = buildPavementTextures(sourceAerial.image);
  sourceAerial.dispose();

  const diffuse = configureCanvasTexture(THREE, diffuseCanvas, "PHX normalized source-aerial A1-A8 pavement diffuse", THREE.SRGBColorSpace);
  const bump = configureCanvasTexture(THREE, bumpCanvas, "PHX A1-A8 pavement bump", THREE.NoColorSpace);
  const roughness = configureCanvasTexture(THREE, roughnessCanvas, "PHX A1-A8 pavement roughness", THREE.NoColorSpace);
  const material = new THREE.MeshStandardMaterial({
    name: "PHX A1-A8 normalized source-aerial PBR apron",
    map: diffuse,
    bumpMap: bump,
    bumpScale: 0.024,
    roughnessMap: roughness,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const apron = new THREE.Mesh(buildApronGeometry(THREE), material);
  apron.name = "PHX_A1_A8_NormalizedSourceAerialPbrApron";
  apron.position.y = A1_SIMULATOR_APRON_PROFILE.surfaceY;
  apron.castShadow = false;
  apron.receiveShadow = true;
  apron.renderOrder = -2;
  apron.userData.sourceAerial = aerialUrl;
  apron.userData.sourceMaterialReference = A1_SIMULATOR_APRON_PROFILE.sourceMaterialReference;
  apron.userData.detailLevel = A1_SIMULATOR_APRON_PROFILE.detailLevel;
  apron.userData.textureResolution = A1_SIMULATOR_APRON_PROFILE.textureResolution;
  apron.userData.dynamicShadowReceiver = true;
  apron.userData.layers = Object.freeze(["normalized-source-aerial-diffuse", "pbr-bump-and-roughness", "source-aligned-wear"]);
  environment.add(apron);
  environment.userData.a1SimulatorApron = apron;
  environment.userData.a1SimulatorApronDetailLevel = apron.userData.detailLevel;
  environment.userData.a1SimulatorApronTextureResolution = apron.userData.textureResolution;
  environment.userData.a1SimulatorApronDynamicShadowReceiver = apron.userData.dynamicShadowReceiver;
  return apron;
}
