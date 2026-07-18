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

function interpolateRibbonProfile(profile, subdivisions = 6) {
  const samples = [];
  for (let index = 0; index < profile.length - 1; index += 1) {
    const start = profile[index];
    const end = profile[index + 1];
    const firstStep = index === 0 ? 0 : 1;
    for (let step = firstStep; step <= subdivisions; step += 1) {
      const t = step / subdivisions;
      samples.push({
        x: start.x + (end.x - start.x) * t,
        z: start.z + (end.z - start.z) * t,
        taper: start.taper + (end.taper - start.taper) * t,
      });
    }
  }
  return samples;
}

function addContouredStripeRibbon(THREE, group, color, height, y, zOffset, side, name) {
  // One connected ribbon follows the changing fuselage radius. The tapered ends and shared vertices
  // eliminate the rectangular slab edges, seams, and buried gaps visible in the prior panel system.
  const profile = interpolateRibbonProfile([
    { x: 0.96, z: -2.55, taper: 0.16 },
    { x: 1.16, z: -1.75, taper: 0.72 },
    { x: 1.30, z: -0.55, taper: 1.0 },
    { x: 1.40, z: 1.55, taper: 1.0 },
    { x: 1.47, z: 4.55, taper: 1.0 },
    { x: 1.50, z: 8.05, taper: 1.0 },
    { x: 1.48, z: 11.55, taper: 1.0 },
    { x: 1.40, z: 14.55, taper: 1.0 },
    { x: 1.28, z: 17.25, taper: 0.90 },
    { x: 1.15, z: 18.70, taper: 0.22 },
  ]);

  const positions = [];
  const indices = [];
  for (const point of profile) {
    const halfHeight = (height * point.taper) / 2;
    const x = side * point.x;
    const z = point.z + zOffset;
    positions.push(x, y - halfHeight, z, x, y + halfHeight, z);
  }

  for (let index = 0; index < profile.length - 1; index += 1) {
    const lowerStart = index * 2;
    const upperStart = lowerStart + 1;
    const lowerEnd = lowerStart + 2;
    const upperEnd = lowerStart + 3;
    if (side > 0) {
      indices.push(lowerStart, lowerEnd, upperStart, upperStart, lowerEnd, upperEnd);
    } else {
      indices.push(lowerStart, upperStart, lowerEnd, upperStart, upperEnd, lowerEnd);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshBasicMaterial({
    color,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.name = `${name} continuous contour ribbon ${side < 0 ? "left" : "right"}`;
  ribbon.renderOrder = 3;
  group.add(ribbon);
  return ribbon;
}

export function buildAmericanEagleMarkings(THREE) {
  const group = new THREE.Group();
  group.name = "American Eagle CRJ700 exterior markings";

  const blue = makeMaterial(THREE, 0x173f73, 0.38, 0.04);
  const red = makeMaterial(THREE, 0xc62032, 0.4, 0.03);
  const silver = makeMaterial(THREE, 0xc7ccd2, 0.31, 0.22);
  const charcoal = makeMaterial(THREE, 0x252a31, 0.52, 0.04);
  const titleTexture = createAmericanEagleTitleTexture(THREE);

  for (const side of [-1, 1]) {
    addContouredStripeRibbon(THREE, group, 0x173f73, 0.16, 2.83, 0, side, "American Eagle blue cheatline");
    addContouredStripeRibbon(THREE, group, 0x173f73, 0.19, 2.68, 0.05, side, "American Eagle lower blue stripe");
    addContouredStripeRibbon(THREE, group, 0xc7ccd2, 0.10, 2.56, 0.08, side, "American Eagle lower silver separator");
    addContouredStripeRibbon(THREE, group, 0xc62032, 0.15, 2.43, 0.12, side, "American Eagle lower red stripe");
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

  group.userData.liveryState = "american-eagle-readable-title-tail-and-continuous-contour-ribbon-decals";
  group.userData.markingSystem = "retained procedural overlays plus runtime canvas title and connected contour-ribbon decals on verified real GLB";
  return group;
}
