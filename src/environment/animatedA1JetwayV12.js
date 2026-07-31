import { buildAnimatedA1Jetway as buildV11 } from "./animatedA1JetwayV11.js";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const lerp = (a, b, t) => a + (b - a) * t;

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function configuredMaterial(base, name, color, roughness, metalness) {
  const material = base.clone();
  material.name = name;
  material.color?.setHex(color);
  material.roughness = roughness;
  material.metalness = metalness;
  material.side = base.side;
  material.needsUpdate = true;
  return material;
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

function roundBeam(THREE, material, name, radius = 0.035, segments = 14) {
  return mesh(THREE, new THREE.CylinderGeometry(radius, radius, 1, segments), material, name);
}

function positionBeamBetween(THREE, beam, start, end) {
  const direction = end.clone().sub(start);
  const length = Math.max(0.001, direction.length());
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  beam.scale.set(1, length, 1);
}

function styleExistingAssembly(root, palette) {
  const outer = root.getObjectByName("A1 AIR_Jetway01 outer telescoping tunnel");
  const inner = root.getObjectByName("A1 AIR_Jetway01 inner telescoping tunnel");
  const cabin = root.getObjectByName("A1 AIR_Jetway01 aircraft cabin");
  if (!outer || !inner || !cabin) throw new Error("A1 v12 requires the committed outer, inner and cabin shells");
  outer.material = palette.outerShell;
  inner.material = palette.innerShell;
  cabin.material = palette.cabinShell;

  const outerDetails = root.getObjectByName("A1 AIR_Jetway01 outer tunnel structural ribs");
  const innerDetails = root.getObjectByName("A1 AIR_Jetway01 inner tunnel structural ribs");
  for (const detailRoot of [outerDetails, innerDetails]) {
    if (!detailRoot) throw new Error("A1 v12 tunnel structural detail root is missing");
    detailRoot.traverse((entry) => {
      if (entry.isMesh) entry.material = palette.frame;
    });
  }

  root.traverse((entry) => {
    if (!entry.isMesh) return;
    if (/hood .* fold|aircraft bellows/i.test(entry.name)) entry.material = palette.bellows;
    if (/underbridge service cable/i.test(entry.name)) entry.material = palette.rubber;
    if (/wheel \-?1|wheel 1|bogie tire/i.test(entry.name) && !/hub/i.test(entry.name)) entry.material = palette.tire;
    if (/wheel bogie|drive motor housing|wheel fender|lift sleeve|safety marker/i.test(entry.name)) entry.material = palette.safetyYellow;
    if (/lift column|axle|wheel hub|tie rod|diagonal brace|underbridge longitudinal rail|underbridge crossmember|roof cable tray/i.test(entry.name)) {
      entry.material = palette.galvanized;
    }
  });
  return { outer, inner, cabin, outerDetails, innerDetails };
}

function installCorrugatedTunnelDetail(THREE, detailRoot, label, width, palette, ridgeCount) {
  const root = new THREE.Group();
  root.name = `A1 ${label} PHX corrugated cladding detail V12`;
  detailRoot.add(root);

  const sideRidges = [-1, 1].flatMap((side) => Array.from({ length: ridgeCount }, (_, index) => {
    const ridge = box(
      THREE,
      palette.frame,
      `A1 ${label} corrugation ridge ${side} ${index + 1}`,
      0.045,
      label === "outer" ? 1.96 : 1.82,
      0.05,
    );
    ridge.position.x = side * (width / 2 + 0.025);
    root.add(ridge);
    return ridge;
  }));

  const lowerRails = [-1, 1].map((side) => {
    const rail = box(THREE, palette.safetyYellow, `A1 ${label} yellow lower safety rail ${side}`, 0.075, 0.11, 1);
    rail.position.set(side * (width / 2 + 0.04), -1.08, 0);
    root.add(rail);
    return rail;
  });

  const roofEdges = [-1, 1].map((side) => {
    const edge = box(THREE, palette.roof, `A1 ${label} raised roof edge ${side}`, 0.11, 0.1, 1);
    edge.position.set(side * (width / 2 - 0.18), 1.13, 0);
    root.add(edge);
    return edge;
  });

  const roofCrossRibs = Array.from({ length: Math.max(8, Math.floor(ridgeCount * 0.72)) }, (_, index) => {
    const rib = box(THREE, palette.frame, `A1 ${label} roof corrugation ${index + 1}`, width * 0.88, 0.04, 0.06);
    rib.position.y = 1.18;
    root.add(rib);
    return rib;
  });

  const lowerPanelBands = [-1, 1].map((side) => {
    const band = box(THREE, palette.lowerPanel, `A1 ${label} recessed lower panel band ${side}`, 0.052, 0.42, 1);
    band.position.set(side * (width / 2 + 0.015), -0.68, 0);
    root.add(band);
    return band;
  });

  const update = (length) => {
    const safeLength = Math.max(1.8, Number(length) || 1.8);
    const margin = 0.38;
    sideRidges.forEach((ridge, index) => {
      const localIndex = index % ridgeCount;
      const t = ridgeCount === 1 ? 0.5 : localIndex / (ridgeCount - 1);
      ridge.position.z = -safeLength / 2 + margin + Math.max(0.1, safeLength - margin * 2) * t;
      ridge.visible = safeLength > 2.2;
    });
    for (const entry of [...lowerRails, ...roofEdges, ...lowerPanelBands]) entry.scale.z = safeLength;
    roofCrossRibs.forEach((rib, index) => {
      const t = roofCrossRibs.length === 1 ? 0.5 : index / (roofCrossRibs.length - 1);
      rib.position.z = -safeLength / 2 + margin + Math.max(0.1, safeLength - margin * 2) * t;
      rib.visible = safeLength > 2.2;
    });
  };

  root.userData.detailAuthority = "phx-light-corrugated-shell-yellow-lower-rail-v12";
  root.userData.sideRidgeCount = sideRidges.length;
  root.userData.roofRibCount = roofCrossRibs.length;
  return update;
}

function installCabinDetail(THREE, root, palette) {
  const cabinRoot = root.getObjectByName("A1 AIR_Jetway01 aircraft cabin moving root");
  if (!cabinRoot) throw new Error("A1 v12 cabin root is missing");
  const detail = new THREE.Group();
  detail.name = "A1 PHX aircraft cabin simulator detail V12";
  cabinRoot.add(detail);

  const roofCap = box(THREE, palette.roof, "A1 PHX cabin raised roof cap", 2.38, 0.13, 2.04);
  roofCap.position.set(0, 1.17, -0.02);
  detail.add(roofCap);

  for (const side of [-1, 1]) {
    const lowerSkirt = box(THREE, palette.lowerPanel, `A1 PHX cabin lower skirt ${side}`, 0.06, 0.44, 1.94);
    lowerSkirt.position.set(side * 1.235, -0.77, -0.02);
    detail.add(lowerSkirt);
    for (const z of [-0.72, -0.36, 0, 0.36, 0.72]) {
      const ridge = box(THREE, palette.frame, `A1 PHX cabin lower corrugation ${side} ${z}`, 0.045, 0.48, 0.04);
      ridge.position.set(side * 1.255, -0.74, z);
      detail.add(ridge);
    }
    const roofRail = roundBeam(THREE, palette.galvanized, `A1 PHX cabin roof safety rail ${side}`, 0.027, 14);
    roofRail.position.set(side * 0.86, 1.48, -0.08);
    roofRail.rotation.x = Math.PI / 2;
    roofRail.scale.y = 1.74;
    detail.add(roofRail);
    for (const z of [-0.76, 0, 0.76]) {
      const post = roundBeam(THREE, palette.galvanized, `A1 PHX cabin roof rail post ${side} ${z}`, 0.024, 12);
      post.position.set(side * 0.86, 1.34, z - 0.08);
      post.scale.y = 0.3;
      detail.add(post);
    }
  }

  const frontSill = box(THREE, palette.safetyYellow, "A1 PHX cabin yellow aircraft threshold", 2.16, 0.11, 0.13);
  frontSill.position.set(0, -1.02, 1.17);
  detail.add(frontSill);

  const rainGutter = box(THREE, palette.frame, "A1 PHX cabin front rain gutter", 2.16, 0.07, 0.08);
  rainGutter.position.set(0, 0.93, 1.18);
  detail.add(rainGutter);

  const emergencyBox = box(THREE, palette.safetyYellow, "A1 PHX cabin emergency control box", 0.18, 0.25, 0.14);
  emergencyBox.position.set(1.18, -0.22, 0.66);
  detail.add(emergencyBox);
  const emergencyButton = mesh(
    THREE,
    new THREE.CylinderGeometry(0.055, 0.055, 0.04, 18),
    palette.marker,
    "A1 PHX cabin emergency stop button",
  );
  emergencyButton.rotation.z = Math.PI / 2;
  emergencyButton.position.set(1.27, -0.16, 0.72);
  detail.add(emergencyButton);

  const placard = box(THREE, palette.placard, "A1 PHX cabin operating placard", 0.018, 0.24, 0.34);
  placard.position.set(1.265, 0.36, 0.42);
  detail.add(placard);

  detail.userData.detailAuthority = "phx-cabin-roof-rail-corrugated-skirt-threshold-controls-v12";
  return detail;
}

function installCompactServiceStair(THREE, root, palette, layout, controller) {
  const stairRoot = root.getObjectByName("A1 AIR_Jetway01 moving open service stair");
  if (!stairRoot) throw new Error("A1 v12 service stair root is missing");
  for (const child of [...stairRoot.children]) {
    child.traverse?.((entry) => entry.geometry?.dispose?.());
    stairRoot.remove(child);
  }

  const stepCount = 11;
  const stepRun = 0.285;
  const totalRun = (stepCount - 1) * stepRun;
  const treadWidth = 0.94;
  const treadDepth = 0.255;
  const bottomHeight = 0.15;
  const thresholdGap = 0.18;
  const railHeight = 0.84;

  const treads = [];
  const nosings = [];
  for (let index = 0; index < stepCount; index += 1) {
    const tread = box(THREE, palette.stairTread, `A1 PHX compact stair tread ${index + 1}`, treadWidth, 0.052, treadDepth);
    const nosing = box(THREE, palette.safetyYellow, `A1 PHX compact stair yellow nosing ${index + 1}`, treadWidth + 0.018, 0.024, 0.038);
    stairRoot.add(tread, nosing);
    treads.push(tread);
    nosings.push(nosing);
  }

  const landing = box(THREE, palette.stairTread, "A1 PHX compact cabin stair landing", treadWidth, 0.07, 0.52);
  const landingEdge = box(THREE, palette.safetyYellow, "A1 PHX compact landing yellow edge", treadWidth + 0.02, 0.07, 0.06);
  const feet = [-1, 1].map((side) => {
    const foot = box(THREE, palette.galvanized, `A1 PHX stair ramp foot ${side}`, 0.2, 0.065, 0.28);
    stairRoot.add(foot);
    return foot;
  });
  stairRoot.add(landing, landingEdge);

  const stringers = [-1, 1].map((side) => {
    const beam = roundBeam(THREE, palette.galvanized, `A1 PHX compact stair stringer ${side}`, 0.038, 14);
    stairRoot.add(beam);
    return beam;
  });
  const handrails = [-1, 1].map((side) => {
    const beam = roundBeam(THREE, palette.safetyYellow, `A1 PHX compact yellow handrail ${side}`, 0.033, 14);
    stairRoot.add(beam);
    return beam;
  });
  const posts = [-1, 1].map((side) => Array.from({ length: 6 }, (_, index) => {
    const post = roundBeam(THREE, palette.safetyYellow, `A1 PHX compact rail post ${side} ${index + 1}`, 0.028, 12);
    stairRoot.add(post);
    return post;
  }));
  const landingRails = [-1, 1].map((side) => {
    const post = roundBeam(THREE, palette.safetyYellow, `A1 PHX compact landing post ${side}`, 0.03, 12);
    const rail = roundBeam(THREE, palette.safetyYellow, `A1 PHX compact landing rail ${side}`, 0.03, 12);
    stairRoot.add(post, rail);
    return { post, rail };
  });
  const gate = roundBeam(THREE, palette.safetyYellow, "A1 PHX compact landing safety gate", 0.03, 12);
  stairRoot.add(gate);

  stairRoot.position.x = -1.58;
  stairRoot.position.z = -3.18;
  const attachedCabinY = layout.cabinY;
  const parkedCabinY = clamp(attachedCabinY + 0.72, 2.35, 5.75);

  const update = (deployment) => {
    const extensionDeployment = smoothstep(0, 0.78, deployment);
    const cabinY = lerp(parkedCabinY, attachedCabinY, extensionDeployment);
    const topHeight = Math.max(2.25, cabinY - thresholdGap);
    const rise = topHeight - bottomHeight;
    stairRoot.position.y = -cabinY + 0.022;

    for (let index = 0; index < stepCount; index += 1) {
      const t = index / (stepCount - 1);
      const y = bottomHeight + rise * t;
      const z = totalRun * t;
      treads[index].position.set(0, y, z);
      nosings[index].position.set(0, y + 0.038, z + treadDepth / 2 - 0.022);
    }
    landing.position.set(0, topHeight, totalRun + 0.2);
    landingEdge.position.set(0, topHeight + 0.01, totalRun + 0.47);
    feet[0].position.set(-0.35, 0.035, -0.05);
    feet[1].position.set(0.35, 0.035, -0.05);

    for (const [index, side] of [-1, 1].entries()) {
      const x = side * 0.41;
      positionBeamBetween(THREE, stringers[index], new THREE.Vector3(x, bottomHeight - 0.08, 0), new THREE.Vector3(x, topHeight - 0.08, totalRun));
      positionBeamBetween(THREE, handrails[index], new THREE.Vector3(x, bottomHeight + railHeight, 0), new THREE.Vector3(x, topHeight + railHeight, totalRun));
      posts[index].forEach((post, postIndex) => {
        const t = postIndex / (posts[index].length - 1);
        const y = bottomHeight + rise * t;
        const z = totalRun * t;
        positionBeamBetween(THREE, post, new THREE.Vector3(x, y + 0.02, z), new THREE.Vector3(x, y + railHeight, z));
      });
      positionBeamBetween(THREE, landingRails[index].post, new THREE.Vector3(x, topHeight + 0.02, totalRun + 0.4), new THREE.Vector3(x, topHeight + railHeight, totalRun + 0.4));
      positionBeamBetween(THREE, landingRails[index].rail, new THREE.Vector3(x, topHeight + railHeight, totalRun - 0.02), new THREE.Vector3(x, topHeight + railHeight, totalRun + 0.43));
    }
    positionBeamBetween(THREE, gate, new THREE.Vector3(-0.39, topHeight + 0.67, totalRun + 0.42), new THREE.Vector3(0.39, topHeight + 0.67, totalRun + 0.42));

    stairRoot.userData.rampContact = "compact-phx-open-tread-yellow-rail-v12";
    stairRoot.userData.stepCount = stepCount;
    stairRoot.userData.currentCabinHeightMeters = cabinY;
  };
  update(controller.getDeployment());
  return update;
}

function installDynamicHoseBundle(THREE, root, palette) {
  const cabinRoot = root.getObjectByName("A1 AIR_Jetway01 aircraft cabin moving root");
  const bogieRoot = root.getObjectByName("A1 AIR_Jetway01 lift and wheel bogie moving root");
  if (!cabinRoot || !bogieRoot) throw new Error("A1 v12 hose bundle requires cabin and bogie roots");
  const hoses = Array.from({ length: 7 }, (_, index) => {
    const hose = roundBeam(THREE, palette.rubber, `A1 PHX hydraulic hose segment ${index + 1}`, 0.03, 12);
    root.add(hose);
    return hose;
  });

  const update = () => {
    const start = new THREE.Vector3(-0.92, cabinRoot.position.y - 0.62, cabinRoot.position.z - 0.62);
    const end = new THREE.Vector3(-0.78, bogieRoot.position.y + 0.86, bogieRoot.position.z + 0.18);
    const points = Array.from({ length: hoses.length + 1 }, (_, index) => {
      const t = index / hoses.length;
      return new THREE.Vector3(
        lerp(start.x, end.x, t) - Math.sin(t * Math.PI) * 0.3,
        lerp(start.y, end.y, t) - Math.sin(t * Math.PI) * 0.5,
        lerp(start.z, end.z, t),
      );
    });
    hoses.forEach((hose, index) => positionBeamBetween(THREE, hose, points[index], points[index + 1]));
  };
  return update;
}

export function buildAnimatedA1Jetway(THREE, materials, layout) {
  const root = buildV11(THREE, materials, layout);
  root.name = "AIR_Jetway01_A1_AnimatedDepartureAssembly_V12";
  const controller = root.userData.controller;
  if (!controller) throw new Error("A1 v12 controller is missing from v11 base assembly");

  const palette = {
    outerShell: configuredMaterial(materials.shell, "A1 PHX light corrugated outer shell V12", 0xf1f1ed, 0.69, 0.08),
    innerShell: configuredMaterial(materials.innerShell, "A1 PHX light corrugated inner shell V12", 0xe5e7e5, 0.66, 0.1),
    cabinShell: configuredMaterial(materials.cabin, "A1 PHX light aircraft cabin shell V12", 0xf0f0ec, 0.68, 0.08),
    frame: configuredMaterial(materials.trim, "A1 PHX galvanized panel frame V12", 0x737b7f, 0.5, 0.52),
    galvanized: configuredMaterial(materials.metal, "A1 PHX galvanized structure V12", 0x858d90, 0.48, 0.58),
    roof: configuredMaterial(materials.innerShell, "A1 PHX pale roof cap V12", 0xf7f7f2, 0.72, 0.06),
    lowerPanel: configuredMaterial(materials.innerShell, "A1 PHX recessed lower cladding V12", 0xb7bec0, 0.7, 0.14),
    safetyYellow: configuredMaterial(materials.warning, "A1 PHX safety yellow V12", 0xe4ad16, 0.6, 0.12),
    bellows: configuredMaterial(materials.bellows, "A1 PHX charcoal aircraft bellows V12", 0x353a3d, 0.92, 0.02),
    rubber: configuredMaterial(materials.tire, "A1 PHX hydraulic rubber V12", 0x17191a, 0.95, 0.01),
    tire: configuredMaterial(materials.tire, "A1 PHX bogie tire V12", 0x151718, 0.96, 0.01),
    marker: configuredMaterial(materials.marker || materials.warning, "A1 PHX red emergency marker V12", 0xd0271e, 0.55, 0.08),
    placard: configuredMaterial(materials.glass, "A1 PHX operating placard V12", 0x20282c, 0.35, 0.08),
    stairTread: configuredMaterial(materials.stair, "A1 PHX galvanized stair tread V12", 0x737a7d, 0.64, 0.44),
  };

  const { outer, inner, outerDetails, innerDetails } = styleExistingAssembly(root, palette);
  const updateOuterDetail = installCorrugatedTunnelDetail(THREE, outerDetails, "outer", 2.44, palette, 18);
  const updateInnerDetail = installCorrugatedTunnelDetail(THREE, innerDetails, "inner", 2.18, palette, 14);
  const cabinDetail = installCabinDetail(THREE, root, palette);
  const updateStair = installCompactServiceStair(THREE, root, palette, layout, controller);
  const updateHoses = installDynamicHoseBundle(THREE, root, palette);

  const previousSetDeployment = controller.setDeployment.bind(controller);
  controller.setDeployment = (value) => {
    previousSetDeployment(value);
    updateOuterDetail(outer.scale.z);
    updateInnerDetail(inner.scale.z);
    updateStair(controller.getDeployment());
    updateHoses();
  };

  root.userData.animationAuthority = "independent-source-scale-rotunda-telescope-lift-hood-bogie-runtime-assembly-v12";
  root.userData.detailAuthority = `${root.userData.detailAuthority} phx-light-corrugated-shell-yellow-undercarriage-compact-stair-cabin-roof-rail-hose-bundle-v12`;
  root.userData.simulatorVisualAuthority = "phx-reference-light-corrugated-metal-yellow-safety-undercarriage-v12";
  root.userData.corrugatedDetailCount = 18 * 2 + 14 * 2;
  root.userData.compactServiceStairAuthority = "compact-phx-open-tread-yellow-rail-v12";
  root.userData.cabinDetailAuthority = cabinDetail.userData.detailAuthority;
  controller.setDeployment(controller.getDeployment());
  return root;
}
