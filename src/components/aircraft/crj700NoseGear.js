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
  const hose = materials.hose || new THREE.MeshStandardMaterial({
    color: 0x151719,
    roughness: 0.78,
    metalness: 0.08,
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

  const addHose = (points, name) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.012, 8, false), hose), name);
  };

  // Keep the upper shock strut connected to the imported fuselage while preserving
  // the established wheel contact point and [0,0,0] tow-capture origin.
  const mainStrut = add(cylinder(0.07, 0.082, 0.96, metal, 24), "nose gear outer strut");
  mainStrut.position.set(0, 0.94, 0.02);

  const upperTrunnion = add(cylinder(0.13, 0.13, 0.34, darkMetal, 24), "nose gear upper trunnion");
  upperTrunnion.rotation.z = Math.PI / 2;
  upperTrunnion.position.set(0, 1.39, 0.02);

  const chromePiston = add(cylinder(0.048, 0.048, 0.46, hydraulic, 20), "nose gear chrome piston");
  chromePiston.position.set(0, 0.39, 0.02);

  const steeringCollar = add(cylinder(0.115, 0.115, 0.12, darkMetal, 24), "nose gear steering collar");
  steeringCollar.position.set(0, 0.64, 0.02);

  const axle = add(cylinder(0.045, 0.045, 0.48, hub, 20), "nose gear axle");
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, 0.2, -0.16);

  for (const side of [-1, 1]) {
    const sideName = side < 0 ? "left" : "right";
    const wheel = add(cylinder(0.215, 0.215, 0.15, tire, 32), `nose wheel ${sideName}`);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.17, 0.2, -0.16);

    const wheelHub = add(cylinder(0.09, 0.09, 0.158, hub, 24), `nose wheel hub ${sideName}`);
    wheelHub.rotation.z = Math.PI / 2;
    wheelHub.position.copy(wheel.position);

    const axleRetainer = add(cylinder(0.035, 0.035, 0.025, darkMetal, 18), `nose wheel axle retainer ${sideName}`);
    axleRetainer.rotation.z = Math.PI / 2;
    axleRetainer.position.set(side * 0.255, 0.2, -0.16);

    for (let treadIndex = 0; treadIndex < 10; treadIndex += 1) {
      const tread = add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.055, 0.018), tire), `nose wheel tread ${sideName} ${treadIndex + 1}`);
      const angle = (treadIndex / 10) * Math.PI * 2;
      tread.position.set(side * 0.248, 0.2 + Math.cos(angle) * 0.208, -0.16 + Math.sin(angle) * 0.208);
      tread.rotation.x = angle;
    }

    const forkArm = add(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.42, 0.055), darkMetal), `nose gear fork arm ${sideName}`);
    forkArm.position.set(side * 0.145, 0.39, -0.13);
    forkArm.rotation.z = side * 0.08;

    const steeringActuator = add(cylinder(0.026, 0.026, 0.36, hydraulic, 16), `nose gear steering actuator ${sideName}`);
    steeringActuator.rotation.z = Math.PI / 2;
    steeringActuator.position.set(side * 0.16, 0.61, -0.02);

    addHose([
      [side * 0.055, 1.17, 0.08],
      [side * 0.09, 0.84, 0.13],
      [side * 0.13, 0.58, 0.02],
      [side * 0.18, 0.34, -0.12],
    ], `nose gear hydraulic hose ${sideName}`);
  }

  const dragBrace = add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.88, 0.075), darkMetal), "nose gear drag brace");
  dragBrace.position.set(0, 0.82, 0.31);
  dragBrace.rotation.x = -0.42;

  const dragBracePivot = add(cylinder(0.055, 0.055, 0.16, hub, 18), "nose gear drag brace pivot");
  dragBracePivot.rotation.z = Math.PI / 2;
  dragBracePivot.position.set(0, 0.53, 0.14);

  const upperFork = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.09), metal), "nose gear upper fork");
  upperFork.position.set(0, 0.34, -0.11);

  const lowerFork = add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.08), darkMetal), "nose gear lower fork");
  lowerFork.position.set(0, 0.18, -0.16);

  for (const side of [-1, 1]) {
    const torqueLink = add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.36, 0.045), darkMetal), `nose gear torque link ${side < 0 ? "left" : "right"}`);
    torqueLink.position.set(side * 0.07, 0.43, -0.02);
    torqueLink.rotation.z = side * 0.16;
  }

  const towFitting = add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.16), darkMetal), "nose gear tow fitting");
  towFitting.position.set(0, 0.22, -0.39);

  const captureMarker = new THREE.Object3D();
  captureMarker.name = "nose gear ground capture origin";
  captureMarker.position.set(0, 0, 0);
  captureMarker.userData.isTowCaptureOrigin = true;
  group.add(captureMarker);

  group.userData.noseGearCaptureOrigin = [0, 0, 0];
  group.userData.preserveTowKinematics = true;
  group.userData.detailState = "detailed-procedural-crj700-nose-gear-steering-hydraulics-and-tread";
  return group;
}
