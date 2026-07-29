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
  textureWidth: 1024,
  textureHeight: 2048,
  textureResolution: "1024x2048",
  detailLevel: "a1-a8-normalized-source-aerial-pbr-apron-v3",
  materialMode: "direct-uploaded-parkramps-high-pass-over-source-aerial",
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
const luminance = (red, green, blue) => red * 0.2126 + green * 0.7152 + blue * 0.0722;

function worldToCanvas(width, height) {
  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  return {
    horizontalFromZ: (worldZ) => (worldZ - minZ) / (maxZ - minZ) * width,
    verticalFromX: (worldX) => height - (worldX - minX) / (maxX - minX) * height,
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

function drawLowFrequencyAerial(context, image, width, height) {
  const crop = sourceCrop(image);
  const lowWidth = Math.max(128, Math.round(width / 4));
  const lowHeight = Math.max(256, Math.round(height / 4));
  const lowCanvas = document.createElement("canvas");
  lowCanvas.width = lowWidth;
  lowCanvas.height = lowHeight;
  const lowContext = lowCanvas.getContext("2d", { willReadFrequently: true });
  if (!lowContext) throw new Error("PHX source aerial low-frequency canvas is unavailable");
  lowContext.imageSmoothingEnabled = true;
  lowContext.imageSmoothingQuality = "high";
  lowContext.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, lowWidth, lowHeight);
  const lowPixels = lowContext.getImageData(0, 0, lowWidth, lowHeight);
  for (let index = 0; index < lowPixels.data.length; index += 4) {
    const red = lowPixels.data[index];
    const green = lowPixels.data[index + 1];
    const blue = lowPixels.data[index + 2];
    const sourceLuminance = Math.max(1, luminance(red, green, blue));
    let normalized = 143 + (sourceLuminance - 143) * 0.18;
    if (sourceLuminance < 72) normalized = 126 + sourceLuminance * 0.12;
    if (sourceLuminance > 205) normalized = 160 + (sourceLuminance - 205) * 0.03;
    normalized = clamp(normalized, 118, 169);
    const chromaScale = 0.18;
    lowPixels.data[index] = clamp(normalized + (red - sourceLuminance) * chromaScale + 1, 0, 255);
    lowPixels.data[index + 1] = clamp(normalized + (green - sourceLuminance) * chromaScale, 0, 255);
    lowPixels.data[index + 2] = clamp(normalized + (blue - sourceLuminance) * chromaScale - 2, 0, 255);
    lowPixels.data[index + 3] = 255;
  }
  lowContext.putImageData(lowPixels, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(lowCanvas, 0, 0, lowWidth, lowHeight, 0, 0, width, height);
}

function extractSourceMaterialDetail(image) {
  const size = 512;
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = size;
  sourceCanvas.height = size;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("PHX uploaded PARKRAMPS detail canvas is unavailable");
  sourceContext.imageSmoothingEnabled = true;
  sourceContext.imageSmoothingQuality = "high";
  sourceContext.drawImage(image, 0, 0, image.width, image.height, 0, 0, size, size);

  const blurSmall = document.createElement("canvas");
  blurSmall.width = 32;
  blurSmall.height = 32;
  const blurSmallContext = blurSmall.getContext("2d");
  if (!blurSmallContext) throw new Error("PHX uploaded PARKRAMPS blur canvas is unavailable");
  blurSmallContext.imageSmoothingEnabled = true;
  blurSmallContext.imageSmoothingQuality = "high";
  blurSmallContext.drawImage(sourceCanvas, 0, 0, size, size, 0, 0, 32, 32);

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = size;
  blurCanvas.height = size;
  const blurContext = blurCanvas.getContext("2d", { willReadFrequently: true });
  if (!blurContext) throw new Error("PHX uploaded PARKRAMPS reconstruction canvas is unavailable");
  blurContext.imageSmoothingEnabled = true;
  blurContext.imageSmoothingQuality = "high";
  blurContext.drawImage(blurSmall, 0, 0, 32, 32, 0, 0, size, size);

  const sourcePixels = sourceContext.getImageData(0, 0, size, size).data;
  const blurPixels = blurContext.getImageData(0, 0, size, size).data;
  const detail = new Int16Array(size * size);
  const chromaRed = new Int8Array(size * size);
  const chromaGreen = new Int8Array(size * size);
  const chromaBlue = new Int8Array(size * size);
  for (let pixel = 0; pixel < detail.length; pixel += 1) {
    const index = pixel * 4;
    const sourceLuminance = luminance(sourcePixels[index], sourcePixels[index + 1], sourcePixels[index + 2]);
    const blurredLuminance = luminance(blurPixels[index], blurPixels[index + 1], blurPixels[index + 2]);
    detail[pixel] = Math.round(clamp((sourceLuminance - blurredLuminance) * 1.65, -54, 54));
    chromaRed[pixel] = Math.round(clamp((sourcePixels[index] - sourceLuminance) * 0.22, -12, 12));
    chromaGreen[pixel] = Math.round(clamp((sourcePixels[index + 1] - sourceLuminance) * 0.22, -12, 12));
    chromaBlue[pixel] = Math.round(clamp((sourcePixels[index + 2] - sourceLuminance) * 0.22, -12, 12));
  }
  return { size, detail, chromaRed, chromaGreen, chromaBlue };
}

function transformedSourceIndex(x, y, blockX, blockY, size) {
  const mode = (blockX * 3 + blockY * 5) & 3;
  const localX = x % size;
  const localY = y % size;
  if (mode === 0) return localY * size + localX;
  if (mode === 1) return localY * size + (size - 1 - localX);
  if (mode === 2) return (size - 1 - localY) * size + localX;
  return (size - 1 - localY) * size + (size - 1 - localX);
}

function applySourceMaterialMicrodetail(diffuseContext, bumpContext, roughnessContext, sourceDetail, width, height) {
  const diffuse = diffuseContext.getImageData(0, 0, width, height);
  const bump = bumpContext.createImageData(width, height);
  const roughness = roughnessContext.createImageData(width, height);
  const { size, detail, chromaRed, chromaGreen, chromaBlue } = sourceDetail;
  for (let y = 0; y < height; y += 1) {
    const blockY = Math.floor(y / size);
    for (let x = 0; x < width; x += 1) {
      const blockX = Math.floor(x / size);
      const sourceIndex = transformedSourceIndex(x, y, blockX, blockY, size);
      const target = (y * width + x) * 4;
      const high = detail[sourceIndex];
      diffuse.data[target] = clamp(diffuse.data[target] + high * 0.72 + chromaRed[sourceIndex], 0, 255);
      diffuse.data[target + 1] = clamp(diffuse.data[target + 1] + high * 0.72 + chromaGreen[sourceIndex], 0, 255);
      diffuse.data[target + 2] = clamp(diffuse.data[target + 2] + high * 0.72 + chromaBlue[sourceIndex], 0, 255);
      diffuse.data[target + 3] = 255;
      const bumpValue = Math.round(clamp(128 + high * 1.35, 54, 202));
      const roughnessValue = Math.round(clamp(232 - Math.abs(high) * 0.34, 198, 242));
      bump.data[target] = bump.data[target + 1] = bump.data[target + 2] = bumpValue;
      bump.data[target + 3] = 255;
      roughness.data[target] = roughness.data[target + 1] = roughness.data[target + 2] = roughnessValue;
      roughness.data[target + 3] = 255;
    }
  }
  diffuseContext.putImageData(diffuse, 0, 0);
  bumpContext.putImageData(bump, 0, 0);
  roughnessContext.putImageData(roughness, 0, 0);
}

function drawConcreteDetails(diffuseContext, bumpContext, roughnessContext, width, height) {
  const random = seededNoise(0xa1a8c0de);
  const transform = worldToCanvas(width, height);
  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;

  for (let x = Math.ceil(minX / 11.5) * 11.5; x <= maxX; x += 11.5) {
    const py = transform.verticalFromX(x);
    diffuseContext.strokeStyle = "rgba(38,40,40,0.24)";
    diffuseContext.lineWidth = 1.15;
    diffuseContext.beginPath();
    diffuseContext.moveTo(0, py);
    diffuseContext.lineTo(width, py);
    diffuseContext.stroke();
    bumpContext.strokeStyle = "rgba(76,76,76,0.7)";
    bumpContext.lineWidth = 1.35;
    bumpContext.beginPath();
    bumpContext.moveTo(0, py);
    bumpContext.lineTo(width, py);
    bumpContext.stroke();
  }
  for (let z = Math.ceil(minZ / 9.5) * 9.5; z <= maxZ; z += 9.5) {
    const px = transform.horizontalFromZ(z);
    diffuseContext.strokeStyle = "rgba(38,40,40,0.22)";
    diffuseContext.lineWidth = 1.15;
    diffuseContext.beginPath();
    diffuseContext.moveTo(px, 0);
    diffuseContext.lineTo(px, height);
    diffuseContext.stroke();
    bumpContext.strokeStyle = "rgba(78,78,78,0.7)";
    bumpContext.lineWidth = 1.35;
    bumpContext.beginPath();
    bumpContext.moveTo(px, 0);
    bumpContext.lineTo(px, height);
    bumpContext.stroke();
  }

  for (let patch = 0; patch < 28; patch += 1) {
    const x = random() * width;
    const y = random() * height;
    const patchWidth = 26 + random() * 96;
    const patchHeight = 9 + random() * 34;
    diffuseContext.save();
    diffuseContext.translate(x, y);
    diffuseContext.rotate((random() - 0.5) * 0.08);
    diffuseContext.fillStyle = `rgba(55,58,56,${0.022 + random() * 0.036})`;
    diffuseContext.fillRect(-patchWidth / 2, -patchHeight / 2, patchWidth, patchHeight);
    diffuseContext.restore();
  }

  diffuseContext.strokeStyle = "rgba(43,45,45,0.13)";
  diffuseContext.lineWidth = 0.8;
  bumpContext.strokeStyle = "rgba(95,95,95,0.72)";
  bumpContext.lineWidth = 0.9;
  for (let crack = 0; crack < 82; crack += 1) {
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

  diffuseContext.strokeStyle = "rgba(25,27,27,0.055)";
  diffuseContext.lineCap = "round";
  diffuseContext.lineWidth = 2.1;
  for (const gate of [
    [0, 6.2], [86.3, -51.7], [86.3, 6.2], [172.5, -51.7],
    [172.5, 6.2], [258.8, -51.7], [258.8, 6.2],
  ]) {
    const x = transform.horizontalFromZ(gate[1]);
    const y = transform.verticalFromX(gate[0]);
    for (const radius of [10, 14]) {
      diffuseContext.beginPath();
      diffuseContext.arc(x, y, radius, Math.PI * 0.16, Math.PI * 0.84);
      diffuseContext.stroke();
    }
  }
}

function buildPavementTextures(aerialImage, sourceMaterialImage) {
  const width = A1_SIMULATOR_APRON_PROFILE.textureWidth;
  const height = A1_SIMULATOR_APRON_PROFILE.textureHeight;
  const diffuseCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const roughnessCanvas = document.createElement("canvas");
  diffuseCanvas.width = bumpCanvas.width = roughnessCanvas.width = width;
  diffuseCanvas.height = bumpCanvas.height = roughnessCanvas.height = height;
  const diffuseContext = diffuseCanvas.getContext("2d", { willReadFrequently: true });
  const bumpContext = bumpCanvas.getContext("2d", { willReadFrequently: true });
  const roughnessContext = roughnessCanvas.getContext("2d", { willReadFrequently: true });
  if (!diffuseContext || !bumpContext || !roughnessContext) throw new Error("A1 simulator apron texture canvases are unavailable");
  drawLowFrequencyAerial(diffuseContext, aerialImage, width, height);
  const sourceDetail = extractSourceMaterialDetail(sourceMaterialImage);
  applySourceMaterialMicrodetail(diffuseContext, bumpContext, roughnessContext, sourceDetail, width, height);
  drawConcreteDetails(diffuseContext, bumpContext, roughnessContext, width, height);
  return { diffuseCanvas, bumpCanvas, roughnessCanvas };
}

function configureCanvasTexture(THREE, canvas, name, colorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = colorSpace;
  texture.flipY = true;
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
  const baseUrl = import.meta.env.BASE_URL;
  const aerialUrl = `${baseUrl}${A1_SIMULATOR_APRON_PROFILE.sourceAerial}`;
  const sourceMaterialUrl = `${baseUrl}${A1_SIMULATOR_APRON_PROFILE.sourceMaterialReference}`;
  const loader = new THREE.TextureLoader();
  const [sourceAerial, sourceMaterial] = await Promise.all([
    loader.loadAsync(aerialUrl),
    loader.loadAsync(sourceMaterialUrl),
  ]);
  if (!sourceAerial.image?.width || !sourceAerial.image?.height) throw new Error("PHX source aerial did not decode for A-gate pavement");
  if (!sourceMaterial.image?.width || !sourceMaterial.image?.height) throw new Error("PHX uploaded PARKRAMPS material did not decode for A-gate pavement");
  const sourceMaterialResolution = `${sourceMaterial.image.width}x${sourceMaterial.image.height}`;
  const { diffuseCanvas, bumpCanvas, roughnessCanvas } = buildPavementTextures(sourceAerial.image, sourceMaterial.image);
  sourceAerial.dispose();
  sourceMaterial.dispose();

  const diffuse = configureCanvasTexture(THREE, diffuseCanvas, "PHX source-atlas detailed A1-A8 pavement diffuse", THREE.SRGBColorSpace);
  const bump = configureCanvasTexture(THREE, bumpCanvas, "PHX source-atlas detailed A1-A8 pavement bump", THREE.NoColorSpace);
  const roughness = configureCanvasTexture(THREE, roughnessCanvas, "PHX source-atlas detailed A1-A8 pavement roughness", THREE.NoColorSpace);
  const material = new THREE.MeshStandardMaterial({
    name: "PHX A1-A8 direct source-atlas PBR apron",
    map: diffuse,
    bumpMap: bump,
    bumpScale: 0.018,
    roughnessMap: roughness,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const apron = new THREE.Mesh(buildApronGeometry(THREE), material);
  apron.name = "PHX_A1_A8_DirectSourceAtlasPbrApron";
  apron.position.y = A1_SIMULATOR_APRON_PROFILE.surfaceY;
  apron.castShadow = false;
  apron.receiveShadow = true;
  apron.renderOrder = -2;
  apron.userData.sourceAerial = aerialUrl;
  apron.userData.sourceMaterialReference = sourceMaterialUrl;
  apron.userData.sourceMaterialResolution = sourceMaterialResolution;
  apron.userData.materialMode = A1_SIMULATOR_APRON_PROFILE.materialMode;
  apron.userData.detailLevel = A1_SIMULATOR_APRON_PROFILE.detailLevel;
  apron.userData.textureResolution = A1_SIMULATOR_APRON_PROFILE.textureResolution;
  apron.userData.dynamicShadowReceiver = true;
  apron.userData.layers = Object.freeze([
    "low-frequency-source-aerial-alignment",
    "direct-uploaded-PARKRAMPS-high-pass-detail",
    "source-derived-bump-and-roughness",
    "source-aligned-joints-and-wear",
  ]);
  environment.add(apron);
  environment.userData.a1SimulatorApron = apron;
  environment.userData.a1SimulatorApronDetailLevel = apron.userData.detailLevel;
  environment.userData.a1SimulatorApronTextureResolution = apron.userData.textureResolution;
  environment.userData.a1SimulatorApronSourceMaterialResolution = sourceMaterialResolution;
  environment.userData.a1SimulatorApronMaterialMode = apron.userData.materialMode;
  environment.userData.a1SimulatorApronDynamicShadowReceiver = apron.userData.dynamicShadowReceiver;
  return apron;
}
