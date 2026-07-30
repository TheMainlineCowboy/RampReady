export const KPHX_DERIVED_SIGN_PROFILE = Object.freeze({
  detailLevel: "graph-derived-runway-and-ils-hold-signs-v1",
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
  provenance: "derived-from-exact-kphx-taxiway-graph-runway-records-and-hold-short-points",
  panelHeightMeters: 0.92,
  panelBottomMeters: 0.62,
});

const STYLE = Object.freeze({
  mandatory: Object.freeze({ background: "#b51f24", foreground: "#ffffff", border: "#ffffff" }),
  location: Object.freeze({ background: "#0a0b0c", foreground: "#ffd217", border: "#ffd217" }),
  direction: Object.freeze({ background: "#ffd217", foreground: "#090a0b", border: "#090a0b" }),
});

function normalizedPanels(sign) {
  const panels = Array.isArray(sign.panels) ? sign.panels : [];
  return panels
    .map((panel) => ({ style: STYLE[panel.style] ? panel.style : "direction", text: String(panel.text ?? "").trim() }))
    .filter((panel) => panel.text);
}

function panelPixelWidth(panel) {
  const characters = Math.max(2, panel.text.length);
  return Math.max(210, 72 + characters * (panel.style === "mandatory" ? 44 : 40));
}

function makeSignTexture(THREE, sign) {
  const panels = normalizedPanels(sign);
  if (!panels.length) throw new Error(`KPHX sign ${sign.id ?? "unknown"} has no drawable panels`);
  const gap = 12;
  const panelWidths = panels.map(panelPixelWidth);
  const width = panelWidths.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, panels.length - 1);
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("KPHX taxiway-sign canvas is unavailable");
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";

  let cursor = 0;
  panels.forEach((panel, index) => {
    const panelWidth = panelWidths[index];
    const style = STYLE[panel.style];
    context.fillStyle = style.background;
    context.fillRect(cursor, 0, panelWidth, height);
    context.strokeStyle = style.border;
    context.lineWidth = 13;
    context.strokeRect(cursor + 9, 9, panelWidth - 18, height - 18);
    const compact = panel.text.length > 9;
    context.fillStyle = style.foreground;
    context.font = `900 ${compact ? 102 : 122}px Arial Black, Arial, sans-serif`;
    context.fillText(panel.text, cursor + panelWidth / 2, height / 2 + 4, panelWidth - 44);
    cursor += panelWidth + gap;
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `KPHX sign ${sign.id ?? panels.map((panel) => panel.text).join("-")}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return { texture, aspect: width / height, panels };
}

function addSign(THREE, parent, sign, textureCache) {
  const panels = normalizedPanels(sign);
  const signature = JSON.stringify(panels);
  let textureEntry = textureCache.get(signature);
  if (!textureEntry) {
    textureEntry = makeSignTexture(THREE, sign);
    textureCache.set(signature, textureEntry);
  }

  const signGroup = new THREE.Group();
  signGroup.name = `KPHX_DerivedSign_${sign.id}`;
  signGroup.position.set(sign.x, 0, sign.z);
  const headingRadians = THREE.MathUtils.degToRad(sign.headingDegrees);
  signGroup.rotation.y = Math.PI / 2 - headingRadians;

  const panelHeight = KPHX_DERIVED_SIGN_PROFILE.panelHeightMeters;
  const panelWidth = Math.max(1.9, Math.min(8.5, panelHeight * textureEntry.aspect));
  const panelCenterY = KPHX_DERIVED_SIGN_PROFILE.panelBottomMeters + panelHeight / 2;
  const panelDepth = 0.09;

  const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight);
  const panelMaterial = new THREE.MeshBasicMaterial({
    map: textureEntry.texture,
    side: THREE.FrontSide,
    toneMapped: false,
    transparent: false,
  });
  const panel = new THREE.Mesh(panelGeometry, panelMaterial);
  panel.name = `${signGroup.name}_Face`;
  panel.position.set(0, panelCenterY, panelDepth / 2 + 0.003);
  panel.renderOrder = 610;
  signGroup.add(panel);

  const backMaterial = new THREE.MeshStandardMaterial({
    name: "KPHX taxiway sign aluminum back",
    color: 0x6d7172,
    roughness: 0.58,
    metalness: 0.58,
  });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(panelWidth + 0.08, panelHeight + 0.08, panelDepth), backMaterial);
  backing.name = `${signGroup.name}_Back`;
  backing.position.set(0, panelCenterY, 0);
  backing.castShadow = true;
  backing.receiveShadow = true;
  signGroup.add(backing);

  const postMaterial = new THREE.MeshStandardMaterial({
    name: "KPHX taxiway sign galvanized posts",
    color: 0x777c7d,
    roughness: 0.52,
    metalness: 0.62,
  });
  const postHeight = KPHX_DERIVED_SIGN_PROFILE.panelBottomMeters;
  const postGeometry = new THREE.BoxGeometry(0.075, postHeight, 0.075);
  const baseGeometry = new THREE.BoxGeometry(0.34, 0.10, 0.34);
  for (const lateral of [-panelWidth * 0.32, panelWidth * 0.32]) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(lateral, postHeight / 2, 0);
    post.castShadow = true;
    post.receiveShadow = true;
    signGroup.add(post);
    const base = new THREE.Mesh(baseGeometry, postMaterial);
    base.position.set(lateral, 0.05, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    signGroup.add(base);
  }

  signGroup.userData.signId = sign.id;
  signGroup.userData.kind = sign.kind;
  signGroup.userData.panels = panels;
  signGroup.userData.sourcePointIndex = sign.sourcePointIndex;
  signGroup.userData.nearestRunway = sign.nearestRunway;
  signGroup.userData.connectedTaxiwayNames = sign.connectedTaxiwayNames;
  signGroup.userData.provenance = sign.provenance;
  parent.add(signGroup);
  return signGroup;
}

export function buildKphxTaxiwaySigns(THREE, signRecords) {
  if (!Array.isArray(signRecords) || !signRecords.length) throw new Error("KPHX derived taxiway-sign records are required");
  const group = new THREE.Group();
  group.name = "KPHX_GraphDerived_RunwayAndIlsHoldSigns";
  const textureCache = new Map();
  const built = signRecords.map((sign) => addSign(THREE, group, sign, textureCache));
  group.userData.signCount = built.length;
  group.userData.runwayHoldSignCount = signRecords.filter((sign) => sign.kind === "runway-hold-position").length;
  group.userData.ilsHoldSignCount = signRecords.filter((sign) => sign.kind === "ils-hold-position").length;
  group.userData.textureCount = textureCache.size;
  group.userData.detailLevel = KPHX_DERIVED_SIGN_PROFILE.detailLevel;
  group.userData.coordinateFrame = KPHX_DERIVED_SIGN_PROFILE.coordinateFrame;
  group.userData.provenance = KPHX_DERIVED_SIGN_PROFILE.provenance;
  return group;
}
