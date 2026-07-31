import { buildAnimatedA1Jetway as buildV10 } from "./animatedA1JetwayV10.js";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const lerp = (a, b, t) => a + (b - a) * t;

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mesh(THREE, geometry, material, name) {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function box(THREE, material, name, width, height, depth) {
  return mesh(THREE, new THREE.BoxGeometry(width, height, depth), material, name);
}

function roundBeam(THREE, material, name, radius = 0.035, segments = 12) {
  return mesh(THREE, new THREE.CylinderGeometry(radius, radius, 1, segments), material, name);
}

function positionBeamBetween(THREE, beam, start, end) {
  const direction = end.clone().sub(start);
  const length = Math.max(0.001, direction.length());
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  beam.scale.set(1, length, 1);
}

function installCleanDynamicServiceStair(THREE, root, materials, layout, controller) {
  const stairRoot = root.getObjectByName("A1 AIR_Jetway01 moving open service stair");
  if (!stairRoot) throw new Error("A1 service stair root is missing from the v10 jetway");

  for (const child of [...stairRoot.children]) {
    child.traverse?.((entry) => entry.geometry?.dispose?.());
    stairRoot.remove(child);
  }

  const treadMaterial = materials.stair.clone();
  treadMaterial.name = "A1 dark galvanized open stair tread";
  treadMaterial.color?.setHex(0x596064);
  treadMaterial.roughness = 0.7;
  treadMaterial.metalness = 0.38;

  const railMaterial = materials.metal.clone();
  railMaterial.name = "A1 dark galvanized stair rail";
  railMaterial.color?.setHex(0x3f474c);
  railMaterial.roughness = 0.58;
  railMaterial.metalness = 0.55;

  const stepCount = 12;
  const stepRun = 0.33;
  const totalRun = (stepCount - 1) * stepRun;
  const treadWidth = 1.08;
  const treadDepth = 0.3;
  const bottomHeight = 0.16;
  const thresholdGap = 0.2;
  const railHeight = 0.86;

  const treads = [];
  const nosings = [];
  for (let index = 0; index < stepCount; index += 1) {
    const tread = box(THREE, treadMaterial, `A1 clean open stair tread ${index + 1}`, treadWidth, 0.065, treadDepth);
    const nosing = box(THREE, materials.warning, `A1 clean stair safety nosing ${index + 1}`, treadWidth + 0.015, 0.022, 0.035);
    stairRoot.add(tread, nosing);
    treads.push(tread);
    nosings.push(nosing);
  }

  const landing = box(THREE, treadMaterial, "A1 compact cabin-side stair landing", treadWidth, 0.08, 0.62);
  const lowerFootLeft = box(THREE, railMaterial, "A1 stair left ramp foot", 0.24, 0.07, 0.32);
  const lowerFootRight = box(THREE, railMaterial, "A1 stair right ramp foot", 0.24, 0.07, 0.32);
  lowerFootLeft.position.x = -0.42;
  lowerFootRight.position.x = 0.42;
  stairRoot.add(landing, lowerFootLeft, lowerFootRight);

  const stringers = [-1, 1].map((side) => {
    const beam = roundBeam(THREE, railMaterial, `A1 clean stair stringer ${side}`, 0.045, 14);
    stairRoot.add(beam);
    return beam;
  });
  const handrails = [-1, 1].map((side) => {
    const beam = roundBeam(THREE, railMaterial, `A1 clean continuous handrail ${side}`, 0.036, 14);
    stairRoot.add(beam);
    return beam;
  });
  const posts = [-1, 1].map((side) => Array.from({ length: 6 }, (_, index) => {
    const post = roundBeam(THREE, railMaterial, `A1 clean stair post ${side} ${index + 1}`, 0.031, 12);
    stairRoot.add(post);
    return post;
  }));
  const landingRails = [-1, 1].map((side) => {
    const post = roundBeam(THREE, railMaterial, `A1 clean landing post ${side}`, 0.034, 12);
    const top = roundBeam(THREE, railMaterial, `A1 clean landing top rail ${side}`, 0.034, 12);
    stairRoot.add(post, top);
    return { post, top };
  });
  const gate = roundBeam(THREE, materials.warning, "A1 compact landing safety gate", 0.034, 12);
  stairRoot.add(gate);

  stairRoot.position.x = -1.72;
  stairRoot.position.z = -4.08;

  const attachedCabinY = layout.cabinY;
  const parkedCabinY = clamp(attachedCabinY + 0.72, 2.35, 5.75);

  const update = (deployment) => {
    const extensionDeployment = smoothstep(0, 0.78, deployment);
    const cabinY = lerp(parkedCabinY, attachedCabinY, extensionDeployment);
    const topHeight = Math.max(2.3, cabinY - thresholdGap);
    const totalRise = topHeight - bottomHeight;

    stairRoot.position.y = -cabinY + 0.025;
    for (let index = 0; index < stepCount; index += 1) {
      const t = index / (stepCount - 1);
      const height = bottomHeight + totalRise * t;
      const z = totalRun * t;
      treads[index].position.set(0, height, z);
      nosings[index].position.set(0, height + 0.044, z + treadDepth / 2 - 0.025);
    }

    landing.position.set(0, topHeight, totalRun + 0.26);
    lowerFootLeft.position.set(-0.42, 0.04, -0.08);
    lowerFootRight.position.set(0.42, 0.04, -0.08);

    for (const [index, side] of [-1, 1].entries()) {
      const x = side * 0.47;
      positionBeamBetween(
        THREE,
        stringers[index],
        new THREE.Vector3(x, bottomHeight - 0.11, 0),
        new THREE.Vector3(x, topHeight - 0.11, totalRun),
      );
      positionBeamBetween(
        THREE,
        handrails[index],
        new THREE.Vector3(x, bottomHeight + railHeight, 0),
        new THREE.Vector3(x, topHeight + railHeight, totalRun),
      );
      posts[index].forEach((post, postIndex) => {
        const t = postIndex / (posts[index].length - 1);
        const treadHeight = bottomHeight + totalRise * t;
        const z = totalRun * t;
        positionBeamBetween(
          THREE,
          post,
          new THREE.Vector3(x, treadHeight + 0.03, z),
          new THREE.Vector3(x, treadHeight + railHeight, z),
        );
      });
      positionBeamBetween(
        THREE,
        landingRails[index].post,
        new THREE.Vector3(x, topHeight + 0.03, totalRun + 0.48),
        new THREE.Vector3(x, topHeight + railHeight, totalRun + 0.48),
      );
      positionBeamBetween(
        THREE,
        landingRails[index].top,
        new THREE.Vector3(x, topHeight + railHeight, totalRun - 0.02),
        new THREE.Vector3(x, topHeight + railHeight, totalRun + 0.52),
      );
    }
    positionBeamBetween(
      THREE,
      gate,
      new THREE.Vector3(-0.45, topHeight + 0.72, totalRun + 0.5),
      new THREE.Vector3(0.45, topHeight + 0.72, totalRun + 0.5),
    );

    stairRoot.userData.rampContact = "dynamic-open-tread-cabin-threshold-fit-v11";
    stairRoot.userData.stepCount = stepCount;
    stairRoot.userData.thresholdGapMeters = thresholdGap;
    stairRoot.userData.currentCabinHeightMeters = cabinY;
  };

  const originalSetDeployment = controller.setDeployment.bind(controller);
  controller.setDeployment = (value) => {
    originalSetDeployment(value);
    update(controller.getDeployment());
  };
  update(controller.getDeployment());
  return stairRoot;
}

export function buildAnimatedA1Jetway(THREE, materials, layout) {
  const root = buildV10(THREE, materials, layout);
  root.name = "AIR_Jetway01_A1_AnimatedDepartureAssembly_V11";
  const controller = root.userData.controller;
  if (!controller) throw new Error("A1 jetway controller is missing from v10 base assembly");
  const stairRoot = installCleanDynamicServiceStair(THREE, root, materials, layout, controller);
  root.userData.animationAuthority = "independent-source-scale-rotunda-telescope-lift-hood-bogie-runtime-assembly-v11";
  root.userData.detailAuthority = `${root.userData.detailAuthority} clean-dynamic-open-tread-round-rail-service-stair-v11`;
  root.userData.serviceStairRampContact = true;
  root.userData.serviceStairVisualAuthority = stairRoot.userData.rampContact;
  controller.setDeployment(controller.getDeployment());
  return root;
}
