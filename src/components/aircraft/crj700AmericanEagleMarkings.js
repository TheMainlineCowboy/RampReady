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

export function buildAmericanEagleMarkings(THREE) {
  const group = new THREE.Group();
  group.name = "American Eagle CRJ700 exterior markings";

  const blue = makeMaterial(THREE, 0x173f73, 0.38, 0.04);
  const red = makeMaterial(THREE, 0xc62032, 0.4, 0.03);
  const silver = makeMaterial(THREE, 0xc7ccd2, 0.31, 0.22);
  const charcoal = makeMaterial(THREE, 0x252a31, 0.52, 0.04);

  // Thin fuselage cheatline retained over the imported white airframe.
  for (const side of [-1, 1]) {
    addBox(THREE, group, blue, [0.028, 0.16, 19.4], [side * 1.015, 2.83, 7.2], [0, 0, 0], `American Eagle blue cheatline ${side < 0 ? "left" : "right"}`);

    // Main title represented as a clean two-tone block treatment until UV text decals are available.
    addBox(THREE, group, charcoal, [0.03, 0.30, 4.8], [side * 1.022, 3.22, 3.4], [0, 0, 0], `American title block ${side < 0 ? "left" : "right"}`);
    addBox(THREE, group, silver, [0.032, 0.07, 4.45], [side * 1.024, 3.22, 3.4], [0, 0, 0], `American title highlight ${side < 0 ? "left" : "right"}`);
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

  group.userData.liveryState = "american-eagle-first-pass-markings";
  group.userData.markingSystem = "retained procedural overlays on verified real GLB";
  return group;
}
