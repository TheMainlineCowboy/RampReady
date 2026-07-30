import { buildAnimatedA1Jetway as buildV9 } from "./animatedA1JetwayV9.js";

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

function replaceSuspendedServiceStair(THREE, root, materials, layout, controller) {
  const stairRoot = root.getObjectByName("A1 AIR_Jetway01 moving open service stair");
  if (!stairRoot) throw new Error("A1 service stair root is missing from the detailed jetway");

  for (const child of [...stairRoot.children]) {
    child.traverse?.((entry) => entry.geometry?.dispose?.());
    stairRoot.remove(child);
  }

  const stepCount = 14;
  const stepRise = 0.18;
  const stepRun = 0.28;
  const treadWidth = 1.12;
  const treadDepth = 0.32;
  const totalRun = (stepCount - 1) * stepRun;
  const topHeight = 0.18 + (stepCount - 1) * stepRise;
  const railHeight = 0.92;
  const inclineLength = Math.hypot(totalRun, topHeight);
  const inclineAngle = -Math.atan2(topHeight, totalRun);

  for (let index = 0; index < stepCount; index += 1) {
    const height = 0.18 + index * stepRise;
    const z = index * stepRun;
    const tread = box(THREE, materials.stair, `A1 ramp-anchored service stair tread ${index + 1}`, treadWidth, 0.075, treadDepth);
    tread.position.set(0, height, z);
    const riser = box(THREE, materials.metal, `A1 ramp-anchored service stair riser ${index + 1}`, treadWidth, stepRise, 0.055);
    riser.position.set(0, height - stepRise / 2, z - treadDepth / 2 + 0.03);
    const antiSlip = box(THREE, materials.warning, `A1 service stair anti-slip edge ${index + 1}`, treadWidth + 0.02, 0.025, 0.045);
    antiSlip.position.set(0, height + 0.052, z + treadDepth / 2 - 0.035);
    stairRoot.add(tread, riser, antiSlip);
  }

  const landing = box(THREE, materials.stair, "A1 cabin-side service stair landing", treadWidth, 0.1, 0.72);
  landing.position.set(0, topHeight, totalRun + 0.25);
  stairRoot.add(landing);

  for (const side of [-1, 1]) {
    const stringer = box(THREE, materials.metal, `A1 service stair lower stringer ${side}`, 0.075, 0.075, inclineLength);
    stringer.position.set(side * 0.5, topHeight / 2 - 0.05, totalRun / 2);
    stringer.rotation.x = inclineAngle;
    stairRoot.add(stringer);

    const handrail = box(THREE, materials.metal, `A1 service stair upper handrail ${side}`, 0.05, 0.05, inclineLength);
    handrail.position.set(side * 0.5, topHeight / 2 + railHeight, totalRun / 2);
    handrail.rotation.x = inclineAngle;
    stairRoot.add(handrail);

    for (let index = 0; index < 8; index += 1) {
      const t = index / 7;
      const z = totalRun * t;
      const treadHeight = 0.18 + (stepCount - 1) * stepRise * t;
      const post = box(THREE, materials.metal, `A1 service stair rail post ${side} ${index + 1}`, 0.05, railHeight, 0.05);
      post.position.set(side * 0.5, treadHeight + railHeight / 2, z);
      stairRoot.add(post);
    }

    const landingRail = box(THREE, materials.metal, `A1 service stair landing rail ${side}`, 0.05, railHeight, 0.05);
    landingRail.position.set(side * 0.5, topHeight + railHeight / 2, totalRun + 0.48);
    stairRoot.add(landingRail);
  }

  const gateLatch = box(THREE, materials.warning, "A1 service stair cabin landing gate", treadWidth, 0.08, 0.06);
  gateLatch.position.set(0, topHeight + 0.76, totalRun + 0.58);
  stairRoot.add(gateLatch);

  stairRoot.position.x = -1.8;
  stairRoot.position.z = -4.0;
  stairRoot.userData.rampContact = "dynamic-cabin-height-to-ramp-zero-v10";
  stairRoot.userData.stepCount = stepCount;
  stairRoot.userData.cabinSideGapMeters = 0.03;

  const attachedCabinY = layout.cabinY;
  const parkedCabinY = clamp(attachedCabinY + 0.72, 2.35, 5.75);
  const updateRampContact = (deployment) => {
    const extensionDeployment = smoothstep(0, 0.78, deployment);
    const cabinY = lerp(parkedCabinY, attachedCabinY, extensionDeployment);
    stairRoot.position.y = -cabinY + 0.025;
  };
  updateRampContact(controller.getDeployment());
  return updateRampContact;
}

function installPersistentSequenceHistory(root, controller, updateRampContact) {
  const originalSetDeployment = controller.setDeployment.bind(controller);
  const history = [controller.getState?.() || "attached"];
  let priorDeployment = controller.getDeployment();

  const append = (state) => {
    if (state && history.at(-1) !== state) history.push(state);
  };

  controller.setDeployment = (value) => {
    const next = clamp(Number(value) || 0, 0, 1);
    const descending = next < priorDeployment;
    if (descending) {
      if (priorDeployment > 0.995 && next <= 0.995) append("retracting");
      if (priorDeployment > 0.78 && next <= 0.78) append("hood-clear");
      if (priorDeployment > 0.62 && next <= 0.62) append("telescoping");
      if (priorDeployment > 0.34 && next <= 0.34) append("rotating-to-park");
    }
    originalSetDeployment(next);
    updateRampContact(next);
    append(controller.getState?.() || root.userData.state || "unknown");
    priorDeployment = next;
    root.userData.stateHistory = history;
  };
  controller.getStateHistory = () => [...history];
  root.userData.stateHistory = history;
  root.userData.sequenceEvidenceAuthority = "persistent-controller-threshold-history-v10";
  controller.setDeployment(priorDeployment);
}

export function buildAnimatedA1Jetway(THREE, materials, layout) {
  const root = buildV9(THREE, materials, layout);
  root.name = "AIR_Jetway01_A1_AnimatedDepartureAssembly_V10";
  const controller = root.userData.controller;
  if (!controller) throw new Error("A1 jetway controller is missing from v9 base assembly");
  const updateRampContact = replaceSuspendedServiceStair(THREE, root, materials, layout, controller);
  installPersistentSequenceHistory(root, controller, updateRampContact);
  root.userData.animationAuthority = "independent-source-scale-rotunda-telescope-lift-hood-bogie-runtime-assembly-v10";
  root.userData.detailAuthority = `${root.userData.detailAuthority} ramp-anchored-open-service-stair-v10`;
  root.userData.serviceStairRampContact = true;
  return root;
}
