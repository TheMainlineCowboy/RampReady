export function buildCRJ700NoseGear(THREE, materials = {}) {
  const group = new THREE.Group();
  group.name = "CRJ700 detailed procedural nose gear";

  const metal = materials.metal || new THREE.MeshStandardMaterial({
    color: 0x9ca6b0,
    roughness: 0.42,
    metalness: 0.58,
  });
  const darkMetal = materials.darkMetal || new THREE.MeshStandardMaterial({
    color: 0x343a40,
    roughness: 0.5,
    metalness: 0.42,
  });
  const tire = materials.tire || new THREE.MeshStandardMaterial({
    color: 0x111214,
    roughness: 0.9,
    metalness: 0,
  });
  const hub = materials.hub || new THREE.MeshStandardMaterial({
    color: 0x707982,
    roughness: 0.38,
    metalness: 0.72,
  });
  const hydraulic = materials.hydraulic || new THREE.MeshStandardMaterial({
    color: 0xd8dde2,
    roughness: 0.2,
    metalness: 0.82,
  });

  const add = (mesh, name) => {
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const cylinder = (radiusTop, radiusBottom, length, material, radialSegments = 24) =>
    new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radialSegments), material);

  const mainStrut = add(cylinder(0.07, 0.082, 0.78, metal, 24), "nose gear outer strut");
  mainStrut.position.set(0, 0.82, 0.02);

  const chromePiston = add(cylinder(0.048, 0.048, 0.42, hydraulic, 20), "nose gear chrome piston");
  chromePiston.position.set(0, 0.32, 0.02);

  const steeringCollar = add(cylinder(0.115, 0.115, 0.12, darkMetal, 24), "nose gear steering collar");
  steeringCollar.position.set(0, 0.62, 0.02);

  const axle = add(cylinder(0.045, 0.045, 0.48, hub, 20), "nose gear axle");
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, 0.2, -0.16);

  for (const side of [-1, 1]) {
    const wheel = add(cylinder(0.215, 0.215, 0.15, tire, 28), `nose wheel ${side < 0 ? "left" : "right"}`);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.17, 0.2, -0.16);

    const wheelHub = add(cylinder(0.09, 0.09, 0.158, hub, 24), `nose wheel hub ${side < 0 ? "left" : "right"}`);
    wheelHub.rotation.z = Math.PI / 2;
    wheelHub.position.copy(wheel.position);
  }

  const dragBrace = add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.78, 0.075), darkMetal), "nose gear drag brace");
  dragBrace.position.set(0, 0.69, 0.29);
  dragBrace.rotation.x = -0.42;

  const upperFork = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.09), metal), "nose gear upper fork");
  upperFork.position.set(0, 0.31, -0.11);

  const lowerFork = add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.08), darkMetal), "nose gear lower fork");
  lowerFork.position.set(0, 0.18, -0.16);

  for (const side of [-1, 1]) {
    const torqueLink = add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.34, 0.045), darkMetal), `nose gear torque link ${side < 0 ? "left" : "right"}`);
    torqueLink.position.set(side * 0.07, 0.39, -0.02);
    torqueLink.rotation.z = side * 0.16;
  }

  const towFitting = add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.16), darkMetal), "nose gear tow fitting");
  towFitting.position.set(0, 0.22, -0.39);

  const captureMarker = new THREE.Object3D();
  captureMarker.name = "nose gear axle capture origin";
  captureMarker.position.set(0, 0, 0);
  captureMarker.userData.isTowCaptureOrigin = true;
  group.add(captureMarker);

  group.userData.noseGearCaptureOrigin = [0, 0, 0];
  group.userData.preserveTowKinematics = true;
  group.userData.detailState = "detailed-procedural-crj700-nose-gear";
  return group;
}
