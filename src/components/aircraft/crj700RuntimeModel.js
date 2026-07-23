import { buildCRJ700Aircraft as buildLegacyCRJ700Aircraft } from "@legacy-crj700";
import { createAmericanEagleSurfaceMaterial } from "./crj700AmericanEagleMarkings.js";
import { loadSelectedAircraftRuntime } from "./aircraftRuntimeLoader.js";

const LEGACY_PARENT_SCALE = 0.82;
const PROCEDURAL_INTERNAL_SCALE = 1.35;

function applyFallbackMaterial(THREE, model) {
  const material = createAmericanEagleSurfaceMaterial(THREE);
  let meshCount = 0;
  model.traverse((child) => {
    if (!child.isMesh) return;
    meshCount += 1;
    child.userData.originalMaterialName = Array.isArray(child.material)
      ? child.material.map((entry) => entry?.name || "").join(",")
      : child.material?.name || "";
    child.material = material;
  });
  model.userData.liveryState = material.userData.liveryState;
  model.userData.liveryMeshCount = meshCount;
  model.userData.liveryAttachment = "fallback-runtime-material";
}

function setProceduralVisibility(root, selectedModel, preserveMaterials) {
  for (const child of root.children) {
    if (child === selectedModel) {
      child.visible = true;
      continue;
    }
    const role = child.userData?.retainedProceduralRole;
    child.visible = role === "training-capture-marker"
      || role === "operational-light"
      || (!preserveMaterials && role === "supplemental-landing-gear");
  }
}

async function installSelectedAircraft(THREE, root) {
  root.userData.aircraftAssetState = "loading-candidate";
  root.userData.renderedAircraftSource = "procedural-fallback";

  try {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const result = await loadSelectedAircraftRuntime({
      THREE,
      loader: new GLTFLoader(),
      applyFallbackMaterial: (model) => applyFallbackMaterial(THREE, model),
    });
    const { model, candidate, dimensions, captureOrigin, preserveMaterials, attempts } = result;
    model.scale.setScalar(1 / (LEGACY_PARENT_SCALE * PROCEDURAL_INTERNAL_SCALE));
    root.add(model);
    setProceduralVisibility(root, model, preserveMaterials);

    root.userData.aircraftAssetState = "ready";
    root.userData.renderedAircraftSource = candidate.id;
    root.userData.aircraftAssetCandidateId = candidate.id;
    root.userData.aircraftAssetUrl = candidate.resolvedUrl;
    root.userData.aircraftAssetAttempts = attempts.map((attempt) => ({
      id: attempt.candidate?.id || "unknown",
      available: Boolean(attempt.available),
      reason: attempt.reason || null,
    }));
    root.userData.realAircraftObject = model;
    root.userData.preserveAircraftMaterials = preserveMaterials;
    root.userData.noseGearCaptureOrigin = [...captureOrigin];
    root.userData.aircraftDimensionsMeters = { ...dimensions };
    root.userData.liveryState = preserveMaterials
      ? "authored-user-materials-preserved"
      : model.userData.liveryState;

    root.dispatchEvent({
      type: "aircraft-model-ready",
      source: candidate.id,
      url: candidate.resolvedUrl,
      dimensions: root.userData.aircraftDimensionsMeters,
      preserveMaterials,
      noseGearCaptureOrigin: root.userData.noseGearCaptureOrigin,
    });
  } catch (error) {
    root.userData.aircraftAssetState = "candidate-error";
    root.userData.aircraftAssetError = error instanceof Error ? error.message : String(error);
    root.dispatchEvent({ type: "aircraft-model-error", error });
    console.error("RampReady candidate-aware aircraft load failed; verified procedural/legacy fallback remains visible.", error);
  }
}

export function buildCRJ700Aircraft(THREE, mat, cyl) {
  const root = buildLegacyCRJ700Aircraft(THREE, mat, cyl);
  root.name = "CRJ700 candidate-aware aircraft root";
  root.userData.aircraftLoaderContract = "candidate-aware-v1";
  void installSelectedAircraft(THREE, root);
  return root;
}
