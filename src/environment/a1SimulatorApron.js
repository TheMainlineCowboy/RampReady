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
  textureResolution: 2048,
  detailLevel: "a1-a8-source-aerial-pbr-close-range-apron-v2",
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

function apronPixelTransform(size) {
  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  return {
    pxForX: (x) => (x - minX) / (maxX - minX) * size,
    pxForZ: (z) => size - (z - minZ) / (maxZ - minZ) * size,
  };
}

function drawPavementDetailCanvases() {
  const size = A1_SIMULATOR_APRON_PROFILE.textureResolution;
  const bumpCanvas = document.createElement("canvas");
  const roughnessCanvas = document.createElement("canvas");
  const wearCanvas = document.createElement("canvas");
  bumpCanvas.width = roughnessCanvas.width = wearCanvas.width = size;
  bumpCanvas.height = roughnessCanvas.height = wearCanvas.height = size;
  const bumpContext = bumpCanvas.getContext("2d", { willReadFrequently: true });
  const roughnessContext = roughnessCanvas.getContext("2d", { willReadFrequently: true });
  const wearContext = wearCanvas.getContext("2d");
  if (!bumpContext || !roughnessContext || !wearContext) throw new Error("A1 simulator apron detail canvases are unavailable");

  const random = seededNoise(0xa1a8c0de);
  const bumpPixels = bumpContext.createImageData(size, size);
  const roughnessPixels = roughnessContext.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const aggregate = (random() - 0.5) * 17;
      const fine = (random() - 0.5) * 6;
      const broad = Math.sin(x * 0.034) * 1.2 + Math.cos(y * 0.029) * 1.0;
      const height = Math.max(0, Math.min(255, 128 + aggregate + fine + broad));
      bumpPixels.data[index] = height;
      bumpPixels.data[index + 1] = height;
      bumpPixels.data[index + 2] = height;
      bumpPixels.data[index + 3] = 255;

      const roughness = Math.max(0, Math.min(255, 226 + (random() - 0.5) * 20 - Math.abs(aggregate) * 0.32));
      roughnessPixels.data[index] = roughness;
      roughnessPixels.data[index + 1] = roughness;
      roughnessPixels.data[index + 2] = roughness;
      roughnessPixels.data[index + 3] = 255;
    }
  }
  bumpContext.putImageData(bumpPixels, 0, 0);
  roughnessContext.putImageData(roughnessPixels, 0, 0);

  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  const { pxForX, pxForZ } = apronPixelTransform(size);

  for (const context of [bumpContext, wearContext]) context.save();
  for (let x = Math.ceil(minX / 11.5) * 11.5; x <= maxX; x += 11.5) {
    const px = pxForX(x);
    bumpContext.strokeStyle = "rgb(79,79,79)";
    bumpContext.lineWidth = 2.4;
    bumpContext.beginPath();
    bumpContext.moveTo(px, 0);
    bumpContext.lineTo(px, size);
    bumpContext.stroke();
    wearContext.strokeStyle = "rgba(35,37,37,0.30)";
    wearContext.lineWidth = 1.7;
    wearContext.beginPath();
    wearContext.moveTo(px, 0);
    wearContext.lineTo(px, size);
    wearContext.stroke();
    wearContext.strokeStyle = "rgba(230,229,222,0.10)";
    wearContext.lineWidth = 0.8;
    wearContext.beginPath();
    wearContext.moveTo(px + 2, 0);
    wearContext.lineTo(px + 2, size);
    wearContext.stroke();
  }
  for (let z = Math.ceil(minZ / 9.5) * 9.5; z <= maxZ; z += 9.5) {
    const py = pxForZ(z);
    bumpContext.strokeStyle = "rgb(82,82,82)";
    bumpContext.lineWidth = 2.4;
    bumpContext.beginPath();
    bumpContext.moveTo(0, py);
    bumpContext.lineTo(size, py);
    bumpContext.stroke();
    wearContext.strokeStyle = "rgba(35,37,37,0.28)";
    wearContext.lineWidth = 1.7;
    wearContext.beginPath();
    wearContext.moveTo(0, py);
    wearContext.lineTo(size, py);
    wearContext.stroke();
    wearContext.strokeStyle = "rgba(230,229,222,0.09)";
    wearContext.lineWidth = 0.8;
    wearContext.beginPath();
    wearContext.moveTo(0, py - 2);
    wearContext.lineTo(size, py - 2);
    wearContext.stroke();
  }

  for (let speck = 0; speck < 16_000; speck += 1) {
    const x = random() * size;
    const y = random() * size;
    const alpha = 0.018 + random() * 0.055;
    wearContext.fillStyle = random() > 0.52
      ? `rgba(30,31,31,${alpha})`
      : `rgba(235,233,225,${alpha * 0.75})`;
    const radius = 0.3 + random() * 1.15;
    wearContext.fillRect(x, y, radius, radius);
  }

  for (let patch = 0; patch < 18; patch += 1) {
    const x = random() * size;
    const y = random() * size;
    const width = 22 + random() * 78;
    const height = 8 + random() * 34;
    wearContext.save();
    wearContext.translate(x, y);
    wearContext.rotate((random() - 0.5) * 0.08);
    wearContext.fillStyle = `rgba(73,74,72,${0.025 + random() * 0.045})`;
    wearContext.fillRect(-width / 2, -height / 2, width, height);
    wearContext.strokeStyle = "rgba(35,36,35,0.08)";
    wearContext.lineWidth = 1;
    wearContext.strokeRect(-width / 2, -height / 2, width, height);
    wearContext.restore();
  }

  wearContext.strokeStyle = "rgba(45,47,47,0.19)";
  wearContext.lineWidth = 1.1;
  bumpContext.strokeStyle = "rgb(101,101,101)";
  bumpContext.lineWidth = 1.3;
  for (let crack = 0; crack < 58; crack += 1) {
    let x = random() * size;
    let y = random() * size;
    wearContext.beginPath();
    bumpContext.beginPath();
    wearContext.moveTo(x, y);
    bumpContext.moveTo(x, y);
    for (let segment = 0; segment < 4 + Math.floor(random() * 7); segment += 1) {
      x += (random() - 0.5) * 28;
      y += 5 + random() * 19;
      wearContext.lineTo(x, y);
      bumpContext.lineTo(x, y);
    }
    wearContext.stroke();
    bumpContext.stroke();
  }

  wearContext.strokeStyle = "rgba(24,25,25,0.14)";
  wearContext.lineCap = "round";
  wearContext.lineWidth = 7;
  for (const gate of [
    [0, 6.2], [86.3, -51.7], [86.3, 6.2], [172.5, -51.7],
    [172.5, 6.2], [258.8, -51.7], [258.8, 6.2],
  ]) {
    const x = pxForX(gate[0]);
    const y = pxForZ(gate[1]);
    for (const radius of [34, 43]) {
      wearContext.beginPath();
      wearContext.arc(x, y, radius, Math.PI * 0.16, Math.PI * 0.84);
      wearContext.stroke();
    }
    const stain = wearContext.createRadialGradient(x, y + 18, 0, x, y + 18, 46);
    stain.addColorStop(0, "rgba(33,31,28,0.105)");
    stain.addColorStop(0.5, "rgba(43,40,35,0.045)");
    stain.addColorStop(1, "rgba(43,40,35,0)");
    wearContext.fillStyle = stain;
    wearContext.beginPath();
    wearContext.ellipse(x, y + 18, 46, 19, 0, 0, Math.PI * 2);
    wearContext.fill();
  }

  bumpContext.restore();
  wearContext.restore();
  return { bumpCanvas, roughnessCanvas, wearCanvas };
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

function buildApronGeometry(THREE, useAerialUvs) {
  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  const { photoSceneBounds } = A1_SIMULATOR_APRON_PROFILE;
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
  if (useAerialUvs) {
    const uWest = (minZ - photoSceneBounds.west) / (photoSceneBounds.east - photoSceneBounds.west);
    const uEast = (maxZ - photoSceneBounds.west) / (photoSceneBounds.east - photoSceneBounds.west);
    const vSouth = (minX - photoSceneBounds.south) / (photoSceneBounds.north - photoSceneBounds.south);
    const vNorth = (maxX - photoSceneBounds.south) / (photoSceneBounds.north - photoSceneBounds.south);
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
      uWest, vNorth,
      uWest, vSouth,
      uEast, vSouth,
      uEast, vNorth,
    ], 2));
  } else {
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
      0, 1,
      0, 0,
      1, 0,
      1, 1,
    ], 2));
  }
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeBoundingSphere();
  return geometry;
}

function mapDetailTextureToApron(texture) {
  const { minX, maxX, minZ, maxZ } = A1_SIMULATOR_APRON_PROFILE.bounds;
  const { photoSceneBounds } = A1_SIMULATOR_APRON_PROFILE;
  const uWest = (minZ - photoSceneBounds.west) / (photoSceneBounds.east - photoSceneBounds.west);
  const uEast = (maxZ - photoSceneBounds.west) / (photoSceneBounds.east - photoSceneBounds.west);
  const vSouth = (minX - photoSceneBounds.south) / (photoSceneBounds.north - photoSceneBounds.south);
  const vNorth = (maxX - photoSceneBounds.south) / (photoSceneBounds.north - photoSceneBounds.south);
  const uSpan = uEast - uWest;
  const vSpan = vNorth - vSouth;
  texture.repeat.set(1 / uSpan, 1 / vSpan);
  texture.offset.set(-uWest / uSpan, -vSouth / vSpan);
  texture.needsUpdate = true;
}

export async function installA1SimulatorApron(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required for A1 apron detail");
  if (environment.userData.a1SimulatorApron) return environment.userData.a1SimulatorApron;
  const aerialUrl = `${import.meta.env.BASE_URL}${A1_SIMULATOR_APRON_PROFILE.sourceAerial}`;
  const aerial = await new THREE.TextureLoader().loadAsync(aerialUrl);
  aerial.name = "PHX source aerial cropped by A1-A8 geometry UVs";
  aerial.colorSpace = THREE.SRGBColorSpace;
  aerial.flipY = true;
  aerial.wrapS = aerial.wrapT = THREE.ClampToEdgeWrapping;
  aerial.minFilter = THREE.LinearMipmapLinearFilter;
  aerial.magFilter = THREE.LinearFilter;
  aerial.anisotropy = 16;
  aerial.generateMipmaps = true;
  aerial.needsUpdate = true;

  const { bumpCanvas, roughnessCanvas, wearCanvas } = drawPavementDetailCanvases();
  const bump = configureCanvasTexture(THREE, bumpCanvas, "PHX A1-A8 high-frequency pavement bump", THREE.NoColorSpace);
  const roughness = configureCanvasTexture(THREE, roughnessCanvas, "PHX A1-A8 pavement roughness", THREE.NoColorSpace);
  mapDetailTextureToApron(bump);
  mapDetailTextureToApron(roughness);

  const baseMaterial = new THREE.MeshStandardMaterial({
    name: "PHX A1-A8 source-aerial PBR apron",
    map: aerial,
    bumpMap: bump,
    bumpScale: 0.036,
    roughnessMap: roughness,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const apron = new THREE.Mesh(buildApronGeometry(THREE, true), baseMaterial);
  apron.name = "PHX_A1_A8_SourceAerialPbrApron";
  apron.position.y = A1_SIMULATOR_APRON_PROFILE.surfaceY;
  apron.castShadow = false;
  apron.receiveShadow = true;
  apron.renderOrder = -2;

  const wear = configureCanvasTexture(THREE, wearCanvas, "PHX A1-A8 joints cracks stains and aggregate", THREE.SRGBColorSpace);
  const wearMaterial = new THREE.MeshBasicMaterial({
    name: "PHX A1-A8 close-range pavement wear overlay",
    map: wear,
    transparent: true,
    alphaTest: 0.004,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const wearOverlay = new THREE.Mesh(buildApronGeometry(THREE, false), wearMaterial);
  wearOverlay.name = "PHX_A1_A8_CloseRangePavementWear";
  wearOverlay.position.y = A1_SIMULATOR_APRON_PROFILE.surfaceY + 0.003;
  wearOverlay.castShadow = false;
  wearOverlay.receiveShadow = false;
  wearOverlay.renderOrder = -1;

  const group = new THREE.Group();
  group.name = "PHX_A1_A8_CloseRangeSimulatorApron";
  group.add(apron, wearOverlay);
  group.userData.sourceAerial = aerialUrl;
  group.userData.sourceMaterialReference = A1_SIMULATOR_APRON_PROFILE.sourceMaterialReference;
  group.userData.detailLevel = A1_SIMULATOR_APRON_PROFILE.detailLevel;
  group.userData.textureResolution = A1_SIMULATOR_APRON_PROFILE.textureResolution;
  group.userData.dynamicShadowReceiver = true;
  group.userData.layers = Object.freeze(["source-aerial-diffuse", "procedural-pbr-microdetail", "transparent-source-aligned-wear"]);
  environment.add(group);
  environment.userData.a1SimulatorApron = group;
  environment.userData.a1SimulatorApronDetailLevel = group.userData.detailLevel;
  environment.userData.a1SimulatorApronTextureResolution = group.userData.textureResolution;
  environment.userData.a1SimulatorApronDynamicShadowReceiver = group.userData.dynamicShadowReceiver;
  return group;
}
