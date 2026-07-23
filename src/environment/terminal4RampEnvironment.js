export const TERMINAL4_RAMP_PROFILE = Object.freeze({
  id: "phx-terminal4-b15-a1",
  coordinateUnits: "meters",
  gateAuthority: "scenery/KPHX_ADEX.BGL",
  corridor: Object.freeze({ startGate: "B15", endGate: "A1" }),
  runtimeGateSelectionAllowed: false,
  dimensions: Object.freeze({ width: 180, depth: 260 }),
  surface: Object.freeze({
    slabSize: 10,
    jointWidth: 0.045,
    roughness: 0.9,
    concreteColor: 0x696d72,
    jointColor: 0x3a3d41,
  }),
  markings: Object.freeze({
    centerlineWidth: 0.16,
    leadInWidth: 0.18,
    stopBarWidth: 0.34,
    serviceRoadWidth: 7.2,
    serviceRoadDashLength: 3.2,
    serviceRoadGapLength: 2.4,
    yellow: 0xffd400,
    red: 0xe63737,
    white: 0xf4f4f2,
  }),
  terminal: Object.freeze({
    facadeDepth: 18,
    facadeHeight: 8.5,
    setback: 44,
    moduleWidth: 18,
    color: 0xb7bdc4,
    glassColor: 0x31485a,
  }),
  lighting: Object.freeze({
    poleSpacing: 34,
    poleHeight: 14,
    lampIntensity: 1.6,
    lampRange: 42,
  }),
});

function material(THREE, color, roughness = 0.82, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addGroundPlane(THREE, group, profile) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(profile.dimensions.width, profile.dimensions.depth),
    material(THREE, profile.surface.concreteColor, profile.surface.roughness, 0.01),
  );
  plane.name = "Terminal4RampSurface";
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  group.add(plane);
}

function addExpansionJoints(THREE, group, profile) {
  const { width, depth } = profile.dimensions;
  const { slabSize, jointWidth, jointColor } = profile.surface;
  const jointMaterial = new THREE.MeshBasicMaterial({ color: jointColor });

  for (let x = -width / 2 + slabSize; x < width / 2; x += slabSize) {
    const joint = new THREE.Mesh(new THREE.PlaneGeometry(jointWidth, depth), jointMaterial);
    joint.name = "RampExpansionJointX";
    joint.rotation.x = -Math.PI / 2;
    joint.position.set(x, 0.006, 0);
    group.add(joint);
  }

  for (let z = -depth / 2 + slabSize; z < depth / 2; z += slabSize) {
    const joint = new THREE.Mesh(new THREE.PlaneGeometry(width, jointWidth), jointMaterial);
    joint.name = "RampExpansionJointZ";
    joint.rotation.x = -Math.PI / 2;
    joint.position.set(0, 0.006, z);
    group.add(joint);
  }
}

function addLine(THREE, group, { width, length, color, x = 0, z = 0, rotation = 0, name }) {
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshBasicMaterial({ color }),
  );
  line.name = name;
  line.rotation.set(-Math.PI / 2, 0, rotation);
  line.position.set(x, 0.012, z);
  group.add(line);
  return line;
}

function addCalibrationMarkings(THREE, group, profile) {
  const { depth } = profile.dimensions;
  const { centerlineWidth, leadInWidth, stopBarWidth, yellow, red, white, serviceRoadWidth } = profile.markings;

  addLine(THREE, group, {
    width: centerlineWidth,
    length: depth - 24,
    color: yellow,
    z: 8,
    name: "CalibrationCenterline",
  });

  addLine(THREE, group, {
    width: 14,
    length: stopBarWidth,
    color: red,
    z: 52,
    rotation: Math.PI / 2,
    name: "TrainingStopBar",
  });

  addLine(THREE, group, {
    width: serviceRoadWidth,
    length: profile.dimensions.width - 18,
    color: 0x565b60,
    x: 0,
    z: -profile.dimensions.depth / 2 + 24,
    rotation: Math.PI / 2,
    name: "ServiceRoadSurface",
  });

  const dashSpan = profile.markings.serviceRoadDashLength + profile.markings.serviceRoadGapLength;
  for (let x = -profile.dimensions.width / 2 + 12; x < profile.dimensions.width / 2 - 12; x += dashSpan) {
    addLine(THREE, group, {
      width: 0.12,
      length: profile.markings.serviceRoadDashLength,
      color: white,
      x,
      z: -profile.dimensions.depth / 2 + 24,
      rotation: Math.PI / 2,
      name: "ServiceRoadDash",
    });
  }

  const leadOffsets = [-48, -24, 24, 48];
  for (const x of leadOffsets) {
    addLine(THREE, group, {
      width: leadInWidth,
      length: 62,
      color: yellow,
      x,
      z: 70,
      name: "UnassignedGateLeadIn",
    });
  }
}

function addTerminalMassing(THREE, group, profile) {
  const { width, depth } = profile.dimensions;
  const { facadeDepth, facadeHeight, setback, moduleWidth, color, glassColor } = profile.terminal;
  const terminalZ = depth / 2 - setback;
  const modules = Math.floor((width - 18) / moduleWidth);

  for (let index = 0; index < modules; index += 1) {
    const x = -((modules - 1) * moduleWidth) / 2 + index * moduleWidth;
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(moduleWidth - 0.5, facadeHeight, facadeDepth),
      material(THREE, color, 0.72, 0.08),
    );
    shell.name = "TerminalFacadeModule";
    shell.position.set(x, facadeHeight / 2, terminalZ);
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(moduleWidth - 2.2, 3.1),
      material(THREE, glassColor, 0.16, 0.24),
    );
    glass.name = "TerminalFacadeGlass";
    glass.position.set(x, facadeHeight * 0.58, terminalZ - facadeDepth / 2 - 0.012);
    group.add(glass);
  }
}

function addRampLighting(THREE, group, profile) {
  const { width, depth } = profile.dimensions;
  const { poleSpacing, poleHeight, lampIntensity, lampRange } = profile.lighting;
  const poleMaterial = material(THREE, 0x6e747a, 0.54, 0.5);

  for (let x = -width / 2 + 20; x <= width / 2 - 20; x += poleSpacing) {
    for (const z of [-depth / 2 + 48, depth / 2 - 62]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, poleHeight, 12), poleMaterial);
      pole.name = "RampLightPole";
      pole.position.set(x, poleHeight / 2, z);
      pole.castShadow = true;
      group.add(pole);

      const lamp = new THREE.PointLight(0xfff2d6, lampIntensity, lampRange, 1.6);
      lamp.name = "RampLight";
      lamp.position.set(x, poleHeight, z);
      group.add(lamp);
    }
  }
}

export function buildTerminal4RampEnvironment(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh) throw new Error("THREE runtime is required");
  const profile = options.profile ?? TERMINAL4_RAMP_PROFILE;
  const group = new THREE.Group();
  group.name = "Terminal4RampEnvironment";
  group.userData = {
    environmentId: profile.id,
    gateAuthority: profile.gateAuthority,
    corridor: { ...profile.corridor },
    runtimeGateSelectionAllowed: profile.runtimeGateSelectionAllowed,
    calibrationOnly: true,
  };

  addGroundPlane(THREE, group, profile);
  addExpansionJoints(THREE, group, profile);
  addCalibrationMarkings(THREE, group, profile);
  addTerminalMassing(THREE, group, profile);
  addRampLighting(THREE, group, profile);

  return group;
}
