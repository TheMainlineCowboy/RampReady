export const A1_SIMULATOR_APRON_PROFILE = Object.freeze({
  sourceTexture: "models/phx-terminal4/textures/PARKRAMPS.png",
  bounds: Object.freeze({ minX: -35, maxX: 300, minZ: -92, maxZ: 38 }),
  surfaceY: 0.021,
  textureResolution: 1024,
  detailLevel: "a1-a8-source-derived-close-range-apron-v1",
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

function sampleSourceAverage(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !image?.width || !image?.height) return [142, 143, 140];
  context.drawImage(image, 0, 0, image.width, image.height, 0, 0, 64, 64);
  const data = context.getImageData(0, 0, 64, 64).data;
  const values = [];
  for (let index = 0; index < data.length; index += 4) {
    const luminance = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
    if (luminance > 55 && luminance < 215) values.push([data[index], data[index + 1], data[index + 2]]);
  }
  if (!values.length) return [142, 143, 140];
  return [0, 1, 2].map((channel) => Math.round(values.reduce((sum, value) => sum + value[channel], 0) / values.length));
}

function drawApronCanvas(sourceImage) {
  const size = A1_SIMULATOR_APRON_PROFILE.textureResolution;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("A1 simulator apron canvas is unavailable");
  const random = seededNoise(0xa1a8c0de);
  const sampled = sampleSourceAverage(sourceImage);
  const base = sampled.map((value, index) => Math.round(value * 0.28 + [139, 140, 137][index] * 0.72));
  const pixels = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const broad = Math.sin(x * 0.0105) * 1.8 + Math.cos(y * 0.012) * 1.4;
      const fine = (random() - 0.5) * 16;
      const aggregate = random() > 0.996 ? (random() - 0.5) * 36 : 0;
      pixels.data[index] = Math.max(0, Math.min(255, base[0] + broad + fine + aggregate));
      pixels.data[index + 1] = Math.max(0, Math.min(255, base[1] + broad + fine + aggregate));
      pixels.data[index + 2] = Math.max(0, Math.min(255, base[2] + broad + fine + aggregate));
      pixels.data[index + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);

  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  const pxForX = (x) => (x - minX) / (maxX - minX) * size;
  const pxForZ = (z) => size - (z - minZ) / (maxZ - minZ) * size;

  context.save();
  context.lineWidth = 1.4;
  context.strokeStyle = "rgba(63,66,66,0.38)";
  for (let x = Math.ceil(minX / 11.5) * 11.5; x <= maxX; x += 11.5) {
    context.beginPath();
    context.moveTo(pxForX(x), 0);
    context.lineTo(pxForX(x), size);
    context.stroke();
  }
  for (let z = Math.ceil(minZ / 9.5) * 9.5; z <= maxZ; z += 9.5) {
    context.beginPath();
    context.moveTo(0, pxForZ(z));
    context.lineTo(size, pxForZ(z));
    context.stroke();
  }

  context.lineWidth = 0.8;
  context.strokeStyle = "rgba(49,51,51,0.24)";
  for (let crack = 0; crack < 46; crack += 1) {
    let x = random() * size;
    let y = random() * size;
    context.beginPath();
    context.moveTo(x, y);
    for (let segment = 0; segment < 4 + Math.floor(random() * 5); segment += 1) {
      x += (random() - 0.5) * 22;
      y += 5 + random() * 15;
      context.lineTo(x, y);
    }
    context.stroke();
  }

  for (let patch = 0; patch < 24; patch += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 5 + random() * 25;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(45,42,38,0.18)");
    gradient.addColorStop(1, "rgba(45,42,38,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  // Baked tire scuffing is aligned to the decoded A-gate parking row rather than
  // painted randomly across the field.
  context.strokeStyle = "rgba(31,32,32,0.12)";
  context.lineWidth = 5;
  for (const gate of [
    [0, 6.2], [86.3, -51.7], [86.3, 6.2], [172.5, -51.7],
    [172.5, 6.2], [258.8, -51.7], [258.8, 6.2],
  ]) {
    const x = pxForX(gate[0]);
    const y = pxForZ(gate[1]);
    context.beginPath();
    context.arc(x, y, 23, Math.PI * 0.18, Math.PI * 0.82);
    context.stroke();
    context.beginPath();
    context.arc(x, y, 29, Math.PI * 0.18, Math.PI * 0.82);
    context.stroke();
  }
  context.restore();
  return canvas;
}

function createBumpCanvas(diffuseCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = diffuseCanvas.width;
  canvas.height = diffuseCanvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("A1 simulator apron bump canvas is unavailable");
  context.drawImage(diffuseCanvas, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance = Math.round(pixels.data[index] * 0.2126 + pixels.data[index + 1] * 0.7152 + pixels.data[index + 2] * 0.0722);
    pixels.data[index] = luminance;
    pixels.data[index + 1] = luminance;
    pixels.data[index + 2] = luminance;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export async function installA1SimulatorApron(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required for A1 apron detail");
  if (environment.userData.a1SimulatorApron) return environment.userData.a1SimulatorApron;
  const sourceUrl = `${import.meta.env.BASE_URL}${A1_SIMULATOR_APRON_PROFILE.sourceTexture}`;
  const source = await new THREE.TextureLoader().loadAsync(sourceUrl);
  const diffuseCanvas = drawApronCanvas(source.image);
  const diffuse = new THREE.CanvasTexture(diffuseCanvas);
  diffuse.name = "PHX A1-A8 source-derived close-range apron diffuse";
  diffuse.colorSpace = THREE.SRGBColorSpace;
  diffuse.minFilter = THREE.LinearMipmapLinearFilter;
  diffuse.magFilter = THREE.LinearFilter;
  diffuse.anisotropy = 16;
  diffuse.generateMipmaps = true;
  diffuse.needsUpdate = true;
  const bump = new THREE.CanvasTexture(createBumpCanvas(diffuseCanvas));
  bump.name = "PHX A1-A8 close-range apron bump";
  bump.colorSpace = THREE.NoColorSpace;
  bump.minFilter = THREE.LinearMipmapLinearFilter;
  bump.magFilter = THREE.LinearFilter;
  bump.anisotropy = 16;
  bump.generateMipmaps = true;
  bump.needsUpdate = true;

  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  const geometry = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    name: "PHX A1-A8 simulator apron",
    map: diffuse,
    bumpMap: bump,
    bumpScale: 0.014,
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const apron = new THREE.Mesh(geometry, material);
  apron.name = "PHX_A1_A8_CloseRangeSimulatorApron";
  apron.position.set((minX + maxX) / 2, A1_SIMULATOR_APRON_PROFILE.surfaceY, (minZ + maxZ) / 2);
  apron.castShadow = false;
  // The uploaded aerial contains broad baked shadows and missing-tile smears.
  // This close-range layer intentionally carries its own subtle baked contact
  // wear, avoiding a second low-resolution shadow pass over the training apron.
  apron.receiveShadow = false;
  apron.renderOrder = -2;
  apron.userData.sourceTexture = sourceUrl;
  apron.userData.detailLevel = A1_SIMULATOR_APRON_PROFILE.detailLevel;
  apron.userData.textureResolution = A1_SIMULATOR_APRON_PROFILE.textureResolution;
  environment.add(apron);
  environment.userData.a1SimulatorApron = apron;
  environment.userData.a1SimulatorApronDetailLevel = apron.userData.detailLevel;
  environment.userData.a1SimulatorApronTextureResolution = apron.userData.textureResolution;
  return apron;
}
