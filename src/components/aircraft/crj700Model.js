import { buildCRJ700NoseGear } from "./crj700NoseGear.js";
import { createAmericanEagleSurfaceMaterial } from "./crj700AmericanEagleMarkings.js";
import { loadSelectedAircraftRuntime } from "./aircraftRuntimeLoader.js";

const EXPECTED_LENGTH_METERS = 32.5;
const EXPECTED_WINGSPAN_METERS = 23.64;
const LEGACY_PARENT_SCALE = 0.82;
const PROCEDURAL_INTERNAL_SCALE = 1.35;

function applyVisibleBaseLivery(THREE, realModel) {
  const airframeMaterial = createAmericanEagleSurfaceMaterial(THREE);
  let meshCount = 0;
  realModel.traverse((child) => {
    if (!child.isMesh) return;
    meshCount += 1;
    child.userData.originalMaterialName = Array.isArray(child.material)
      ? child.material.map((material) => material?.name || "").join(",")
      : child.material?.name || "";
    child.material = airframeMaterial;
    if (child.geometry && !child.geometry.getAttribute("normal")) child.geometry.computeVertexNormals();
  });

  realModel.userData.liveryState = airframeMaterial.userData.liveryState;
  realModel.userData.liveryMeshCount = meshCount;
  realModel.userData.liveryAttachment = "real-model-material";
}

async function loadRealCRJ700(THREE, aircraftRoot) {
  aircraftRoot.userData.aircraftAssetState = "loading";
  aircraftRoot.userData.renderedAircraftSource = "procedural-fallback";

  try {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const result = await loadSelectedAircraftRuntime({
      THREE,
      loader: new GLTFLoader(),
      applyFallbackMaterial: (model) => applyVisibleBaseLivery(THREE, model),
    });
    const realModel = result.model;
    const sourceId = result.candidate.id;
    realModel.name = result.preserveMaterials
      ? "User-authored American Eagle CRJ"
      : "Prepared CRJ700 fallback";
    realModel.scale.setScalar(1 / (LEGACY_PARENT_SCALE * PROCEDURAL_INTERNAL_SCALE));
    aircraftRoot.add(realModel);

    for (const child of aircraftRoot.children) {
      if (child === realModel) continue;
      const role = child.userData.retainedProceduralRole;
      const keep = role === "operational-light"
        || role === "training-capture-marker"
        || (!result.preserveMaterials && role === "supplemental-landing-gear");
      child.visible = keep;
    }

    aircraftRoot.userData.aircraftAssetState = "ready";
    aircraftRoot.userData.aircraftAssetUrl = result.candidate.resolvedUrl;
    aircraftRoot.userData.renderedAircraftSource = sourceId;
    aircraftRoot.userData.realAircraftObject = realModel;
    aircraftRoot.userData.liveryState = result.preserveMaterials
      ? "authored-materials-preserved"
      : realModel.userData.liveryState;
    aircraftRoot.userData.aircraftDimensionsMeters = result.dimensions;
    aircraftRoot.userData.noseGearCaptureOrigin = [...result.captureOrigin];
    aircraftRoot.userData.aircraftAssetAttempts = result.attempts;
    aircraftRoot.userData.authoredMaterialsPreserved = result.preserveMaterials;
    aircraftRoot.dispatchEvent({
      type: "aircraft-model-ready",
      source: sourceId,
      dimensions: result.dimensions,
      liveryState: aircraftRoot.userData.liveryState,
      preserveMaterials: result.preserveMaterials,
    });
  } catch (error) {
    aircraftRoot.userData.aircraftAssetState = "error";
    aircraftRoot.userData.renderedAircraftSource = "procedural-fallback";
    aircraftRoot.userData.aircraftAssetError = error instanceof Error ? error.message : String(error);
    aircraftRoot.dispatchEvent({ type: "aircraft-model-error", error });
    console.error("RampReady CRJ700 asset load failed; procedural fallback remains visible.", error);
  }
}

export function buildCRJ700Aircraft(THREE, mat, cyl) {
  const group = new THREE.Group();
  group.name = "CRJ700 aircraft root";
  const retainedProceduralChildren = new Set();

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

  const retain = (mesh, role) => {
    mesh.userData.retainedProceduralRole = role;
    retainedProceduralChildren.add(mesh);
    return mesh;
  };

  function box(w, h, d, material, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return add(mesh);
  }

  function loftFuselage(profiles, material) {
    const radialSegments = 32;
    const vertices = [];
    const indices = [];
    for (const [z, radius, centerY = 2.64, verticalScale = 0.94] of profiles) {
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const angle = (segment / radialSegments) * Math.PI * 2;
        vertices.push(Math.cos(angle) * radius, centerY + Math.sin(angle) * radius * verticalScale, z);
      }
    }
    for (let ring = 0; ring < profiles.length - 1; ring += 1) {
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const next = (segment + 1) % radialSegments;
        const a = ring * radialSegments + segment;
        const b = ring * radialSegments + next;
        const c = (ring + 1) * radialSegments + next;
        const d = (ring + 1) * radialSegments + segment;
        indices.push(a, b, c, a, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return add(new THREE.Mesh(geometry, material));
  }

  function verticalFin(material) {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -0.1, 2.9, 20.8, 0.1, 2.9, 20.8, -0.1, 6.35, 23.2, 0.1, 6.35, 23.2,
      -0.1, 3.0, 24.3, 0.1, 3.0, 24.3,
    ]);
    const indices = [0, 2, 4, 1, 5, 3, 0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 1, 4, 1, 0];
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return add(new THREE.Mesh(geometry, material));
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

  // Procedural body remains available only while the selected GLB loads or if loading fails.
  loftFuselage([
    [-5.25, 0.08, 2.58, 0.9], [-4.8, 0.48, 2.61, 0.92], [-3.9, 0.82, 2.65, 0.94],
    [-2.5, 0.98], [0, 1.0], [16.8, 1.0], [19.2, 0.92], [21.2, 0.7, 2.72, 0.96],
    [23.1, 0.34, 2.82, 1], [24.15, 0.08, 2.9, 1],
  ], white);

  box(0.68, 0.34, 0.72, glass, -0.58, 3.05, -3.62, -0.08, -0.18, -0.08);
  box(0.68, 0.34, 0.72, glass, 0.58, 3.05, -3.62, -0.08, 0.18, 0.08);
  box(0.035, 0.13, 20.0, mat(0x1d4e89, 0.42, 0.02), -0.985, 2.86, 7.4);
  box(0.035, 0.13, 20.0, mat(0x1d4e89, 0.42, 0.02), 0.985, 2.86, 7.4);
  box(1.52, 0.12, 17.8, bellyBlue, 0, 1.76, 9.2);
  for (const side of [-1, 1]) {
    box(0.025, 0.92, 0.55, mat(0xd9dee4, 0.5, 0.02), side * 0.985, 2.58, -0.75);
    box(0.025, 0.92, 0.55, mat(0xd9dee4, 0.5, 0.02), side * 0.985, 2.58, 17.45);
  }

  taperedWing(10.8, 3.6, 1.35, white, 10.7, 2.33, 1.2, 1);
  taperedWing(10.8, 3.6, 1.35, white, 10.7, 2.33, 1.2, -1);
  box(1.8, 0.22, 2.7, white, 0, 2.38, 10.9);
  box(0.16, 0.92, 1.05, white, -10.55, 2.77, 12.0, 0.08, 0, -0.18);
  box(0.16, 0.92, 1.05, white, 10.55, 2.77, 12.0, 0.08, 0, 0.18);

  for (const side of [-1, 1]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.48, 2.25, 36), white);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(side * 1.34, 2.72, 19.75);
    add(nacelle);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 36), dark);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(side * 1.34, 2.72, 18.61);
    add(intake);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.22, 28), dark);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * 1.34, 2.72, 20.94);
    add(exhaust);
    box(0.34, 0.12, 1.18, gearMetal, side * 0.78, 2.78, 19.8, 0, 0, side * 0.08);
  }

  verticalFin(white);
  taperedWing(4.3, 1.7, 1.0, white, 24.3, 5.78, 0.15, 1);
  taperedWing(4.3, 1.7, 1.0, white, 24.3, 5.78, 0.15, -1);

  const detailedNoseGear = buildCRJ700NoseGear(THREE);
  group.add(detailedNoseGear);
  retain(detailedNoseGear, "supplemental-landing-gear");
  group.userData.noseGearDetailState = detailedNoseGear.userData.detailState;
  group.userData.noseGearCaptureOrigin = detailedNoseGear.userData.noseGearCaptureOrigin;

  retain(add(cyl(0.26, 0.22, 0x101114, -1.9, 0.32, 12.1, 0, 0, Math.PI / 2, 28)), "supplemental-landing-gear");
  retain(add(cyl(0.26, 0.22, 0x101114, 1.9, 0.32, 12.1, 0, 0, Math.PI / 2, 28)), "supplemental-landing-gear");
  retain(box(0.08, 1.05, 0.08, gearMetal, -1.9, 0.9, 12.1), "supplemental-landing-gear");
  retain(box(0.08, 1.05, 0.08, gearMetal, 1.9, 0.9, 12.1), "supplemental-landing-gear");

  for (let z = 0.4; z < 18.8; z += 1.08) {
    box(0.035, 0.12, 0.22, glass, -0.92, 3.03, z, 0, 0.02, 0);
    box(0.035, 0.12, 0.22, glass, 0.92, 3.03, z, 0, -0.02, 0);
  }

  const redLight = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  const greenLight = new THREE.MeshBasicMaterial({ color: 0x35ff79 });
  const beacon = new THREE.MeshBasicMaterial({ color: 0xff5a2d });
  retain(add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), redLight)), "operational-light").position.set(-10.62, 2.78, 12.05);
  retain(add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), greenLight)), "operational-light").position.set(10.62, 2.78, 12.05);
  retain(add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), beacon)), "operational-light").position.set(0, 3.66, 8.5);

  const target = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  target.rotation.x = Math.PI / 2;
  target.position.y = 0.055;
  group.add(target);
  retain(target, "training-capture-marker");

  group.scale.setScalar(PROCEDURAL_INTERNAL_SCALE);
  group.userData.aircraftDimensionsMeters = { length: EXPECTED_LENGTH_METERS, wingspan: EXPECTED_WINGSPAN_METERS };
  group.userData.orientation = { up: "+Y", forward: "-Z" };
  group.userData.liveryState = "procedural-fallback-only-until-selected-model-loads";
  group.userData.retainedProceduralRoles = [
    "supplemental-landing-gear",
    "operational-light",
    "training-capture-marker",
  ];
  void loadRealCRJ700(THREE, group);

  return group;
}
