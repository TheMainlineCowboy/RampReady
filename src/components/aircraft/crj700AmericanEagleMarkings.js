function makeMaterial(THREE, color, roughness = 0.42, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide });
}

function addBox(THREE, group, material, size, position, rotation = [0, 0, 0], name = "") {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createAmericanEagleTitleTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create CRJ700 livery decal canvas");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.font = "700 146px Arial, Helvetica, sans-serif";
  context.fillStyle = "#252a31";
  context.fillText("American", 34, 128);

  const americanWidth = context.measureText("American").width;
  context.font = "italic 700 146px Arial, Helvetica, sans-serif";
  context.fillStyle = "#173f73";
  context.fillText("Eagle", 58 + americanWidth, 128);

  const texture = new THREE.CanvasTexture(canvas);
  if ("colorSpace" in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function addTitleDecal(THREE, group, texture, side) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: THREE.FrontSide,
    toneMapped: false,
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(5.25, 0.88), material);
  decal.position.set(side * 1.027, 3.24, 3.55);
  decal.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
  decal.name = `Readable American Eagle title ${side < 0 ? "left" : "right"}`;
  decal.renderOrder = 4;
  group.add(decal);
  return decal;
}

function addStripeDecal(THREE, group, color, width, height, position, side, name) {
  const material = new THREE.MeshBasicMaterial({
    color,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: THREE.FrontSide,
    toneMapped: false,
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  decal.position.set(side * position[0], position[1], position[2]);
  decal.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
  decal.name = `${name} ${side < 0 ? "left" : "right"}`;
  decal.renderOrder = 3;
  group.add(decal);
  return decal;
}

export function buildAmericanEagleMarkings(THREE) {
  const group = new THREE.Group();
  group.name = "American Eagle CRJ700 exterior markings";

  const blue = makeMaterial(THREE, 0x173f73, 0.38, 0.04);
  const red = makeMaterial(THREE, 0xc62032, 0.4, 0.03);
  const silver = makeMaterial(THREE, 0xc7ccd2, 0.31, 0.22);
  const charcoal = makeMaterial(THREE, 0x252a31, 0.52, 0.04);
  const titleTexture = createAmericanEagleTitleTexture(THREE);

  // The imported fuselage is wider below the title band. Production screenshots showed the lower
  // decals repeatedly intersecting the skin and breaking into dashes, so keep the tricolor planes
  // on one continuous outboard side plane while preserving their verified vertical placement.
  for (const side of [-1, 1]) {
    addStripeDecal(THREE, group, 0x173f73, 19.4, 0.16, [1.34, 2.83, 7.2], side, "American Eagle blue cheatline");
    addStripeDecal(THREE, group, 0x173f73, 18.2, 0.19, [1.35, 2.68, 7.85], side, "American Eagle lower blue stripe");
    addStripeDecal(THREE, group, 0xc7ccd2, 18.0, 0.10, [1.36, 2.56, 7.9], side, "American Eagle lower silver separator");
    addStripeDecal(THREE, group, 0xc62032, 17.6, 0.15, [1.37, 2.43, 8.1], side, "American Eagle lower red stripe");
    addTitleDecal(THREE, group, titleTexture, side);
  }

  // American tail motif: alternating red, silver and blue diagonal bands on both fin faces.
  const tailBands = [
    { material: red, y: 3.58, z: 22.02, rotation: -0.24 },
    { material: silver, y: 4.23, z: 22.43, rotation: -0.24 },
    { material: blue, y: 4.88, z: 22.84, rotation: -0.24 },
    { material: red, y: 5.53, z: 23.25, rotation: -0.24 },
  ];
  for (const side of [-1, 1]) {
    for (const [index, band] of tailBands.entries()) {
      addBox(
        THREE,
        group,
        band.material,
        [0.035, 0.54, 2.55],
        [side * 0.125, band.y, band.z],
        [band.rotation, 0, side * 0.015],
        `American tail band ${index + 1} ${side < 0 ? "left" : "right"}`,
      );
    }
  }

  // Engine identity panels and nose anti-glare treatment.
  for (const side of [-1, 1]) {
    addBox(THREE, group, blue, [0.72, 0.035, 1.15], [side * 1.34, 3.12, 19.5], [0, 0, 0], `Engine blue identity panel ${side < 0 ? "left" : "right"}`);
    addBox(THREE, group, silver, [0.56, 0.038, 0.10], [side * 1.34, 3.14, 19.18], [0, 0, 0], `Engine silver accent ${side < 0 ? "left" : "right"}`);
  }
  addBox(THREE, group, charcoal, [1.15, 0.035, 1.55], [0, 3.42, -3.36], [-0.10, 0, 0], "CRJ700 nose anti-glare panel");

  group.userData.liveryState = "american-eagle-readable-title-tail-and-lower-fuselage-stripe-decals";
  group.userData.markingSystem = "retained procedural overlays plus runtime canvas and plane decals on verified real GLB";
  return group;
}
