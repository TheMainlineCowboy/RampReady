export function buildCRJ700Aircraft(THREE, mat, cyl) {
  const group = new THREE.Group();
  group.name = "CRJ700 lightweight procedural model";

  const white = mat(0xf4f6f8, 0.34, 0.04);
  const bellyBlue = mat(0x1e4777, 0.48, 0.03);
  const glass = mat(0x172333, 0.22, 0.08);
  const dark = mat(0x15181d, 0.68, 0.04);
  const gearMetal = mat(0x8b949e, 0.55, 0.2);

  const add = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  function box(w, h, d, material, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return add(mesh);
  }

  function capsule(radius, length, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 14, 36), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.set(0.92, 0.78, 1);
    return add(mesh);
  }

  function taperedWing(span, rootChord, tipChord, material, z, y, sweep, side) {
    const half = side;
    const geom = new THREE.BufferGeometry();
    const rootFront = z - rootChord * 0.45;
    const rootBack = z + rootChord * 0.55;
    const tipFront = z - tipChord * 0.45 + sweep * half;
    const tipBack = z + tipChord * 0.55 + sweep * half;
    const xRoot = 0.62 * half;
    const xTip = span * half;
    const thickness = 0.06;
    const verts = new Float32Array([
      xRoot, y + thickness, rootFront, xTip, y + thickness, tipFront, xTip, y + thickness, tipBack, xRoot, y + thickness, rootBack,
      xRoot, y - thickness, rootFront, xTip, y - thickness, tipFront, xTip, y - thickness, tipBack, xRoot, y - thickness, rootBack,
    ]);
    const idx = [0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0];
    geom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    return add(new THREE.Mesh(geom, material));
  }

  // Local origin is nose gear contact point. Negative Z is aircraft nose, positive Z is tail.
  capsule(0.92, 24.2, white, 0, 2.65, 9.4);
  capsule(0.82, 6.2, white, 0, 2.7, -2.6);

  box(1.36, 0.36, 1.0, glass, 0, 2.9, -2.7, -0.1);
  box(0.08, 0.18, 19.8, mat(0x1d4e89, 0.42, 0.02), 0, 2.95, 8.1);
  box(1.58, 0.16, 17.4, mat(0x225f9f, 0.5, 0.02), 0, 2.1, 9.6);

  // Main swept low wings.
  taperedWing(10.8, 3.6, 1.35, white, 10.7, 2.33, 1.2, 1);
  taperedWing(10.8, 3.6, 1.35, white, 10.7, 2.33, 1.2, -1);
  box(1.8, 0.22, 2.7, white, 0, 2.38, 10.9);

  // Rear-mounted engines, closer to the real CRJ family silhouette.
  const leftEngine = cyl(0.42, 1.45, 0x20242b, -1.15, 2.8, 20.8, Math.PI / 2, 0, 0, 36);
  const rightEngine = cyl(0.42, 1.45, 0x20242b, 1.15, 2.8, 20.8, Math.PI / 2, 0, 0, 36);
  group.add(leftEngine, rightEngine);
  box(0.22, 0.1, 1.0, gearMetal, -0.74, 2.78, 20.7);
  box(0.22, 0.1, 1.0, gearMetal, 0.74, 2.78, 20.7);

  // T-tail.
  box(0.18, 3.8, 2.4, white, 0, 4.25, 23.8, 0.04);
  taperedWing(4.3, 1.7, 1.0, white, 24.3, 5.78, 0.15, 1);
  taperedWing(4.3, 1.7, 1.0, white, 24.3, 5.78, 0.15, -1);

  // Nose gear at origin.
  const strut = cyl(0.045, 1.05, 0x8b949e, 0, 0.78, 0, 0, 0, 0, 16);
  group.add(strut);
  group.add(cyl(0.2, 0.16, 0x101114, -0.16, 0.24, -0.16, 0, 0, Math.PI / 2, 24));
  group.add(cyl(0.2, 0.16, 0x101114, 0.16, 0.24, -0.16, 0, 0, Math.PI / 2, 24));

  // Main landing gear.
  group.add(cyl(0.26, 0.22, 0x101114, -1.9, 0.32, 12.1, 0, 0, Math.PI / 2, 28));
  group.add(cyl(0.26, 0.22, 0x101114, 1.9, 0.32, 12.1, 0, 0, Math.PI / 2, 28));
  box(0.08, 1.05, 0.08, gearMetal, -1.9, 0.9, 12.1);
  box(0.08, 1.05, 0.08, gearMetal, 1.9, 0.9, 12.1);

  // Window row dots.
  for (let z = 0.4; z < 18.8; z += 1.08) {
    box(0.035, 0.12, 0.22, glass, -0.92, 3.03, z, 0, 0.02, 0);
    box(0.035, 0.12, 0.22, glass, 0.92, 3.03, z, 0, -0.02, 0);
  }

  const target = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  target.rotation.x = Math.PI / 2;
  target.position.y = 0.055;
  group.add(target);

  return group;
}
