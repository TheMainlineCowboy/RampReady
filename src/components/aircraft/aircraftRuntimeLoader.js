import {
  CRJ700_EXPECTED_DIMENSIONS,
  selectAircraftAssetCandidate,
} from "./aircraftAssetContract.js";

function withinTolerance(actual, expected, tolerance = CRJ700_EXPECTED_DIMENSIONS.toleranceMeters) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

function configureMeshes(root, sourceId) {
  let meshCount = 0;
  root.traverse((child) => {
    if (!child.isMesh) return;
    meshCount += 1;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = true;
    child.userData.aircraftAssetSource = sourceId;
    if (child.geometry && !child.geometry.getAttribute("normal")) child.geometry.computeVertexNormals();
  });
  return meshCount;
}

export async function loadSelectedAircraftRuntime({
  THREE,
  loader,
  baseUri = document.baseURI,
  fetchImpl = fetch,
  applyFallbackMaterial,
} = {}) {
  if (!THREE) throw new Error("THREE is required");
  if (!loader?.loadAsync) throw new Error("GLTF loader is required");

  const selection = await selectAircraftAssetCandidate({ baseUri, fetchImpl });
  if (!selection.available) throw new Error(selection.reason || "No aircraft asset candidate available");

  const { candidate, metadata } = selection;
  const gltf = await loader.loadAsync(candidate.resolvedUrl);
  const model = gltf.scene;
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const dimensions = { length: size.z, wingspan: size.x };
  if (!withinTolerance(dimensions.length, CRJ700_EXPECTED_DIMENSIONS.lengthMeters)
    || !withinTolerance(dimensions.wingspan, CRJ700_EXPECTED_DIMENSIONS.wingspanMeters)) {
    throw new Error(`Unexpected CRJ700 dimensions ${dimensions.length.toFixed(2)} m long x ${dimensions.wingspan.toFixed(2)} m span`);
  }

  if (!candidate.preserveMaterials && typeof applyFallbackMaterial === "function") {
    applyFallbackMaterial(model);
  }

  const meshCount = configureMeshes(model, candidate.id);
  const captureOrigin = metadata?.noseGearCaptureOrigin || [0, 0, 0];
  model.name = candidate.id;
  model.userData.aircraftAssetCandidateId = candidate.id;
  model.userData.aircraftAssetUrl = candidate.resolvedUrl;
  model.userData.preserveMaterials = candidate.preserveMaterials;
  model.userData.noseGearCaptureOrigin = [...captureOrigin];
  model.userData.orientation = metadata?.orientation || { up: "+Y", forward: "-Z" };
  model.userData.aircraftDimensionsMeters = {
    length: Number(dimensions.length.toFixed(3)),
    wingspan: Number(dimensions.wingspan.toFixed(3)),
  };
  model.userData.aircraftMeshCount = meshCount;

  return {
    model,
    candidate,
    metadata,
    attempts: selection.attempts,
    dimensions: model.userData.aircraftDimensionsMeters,
    captureOrigin: model.userData.noseGearCaptureOrigin,
    preserveMaterials: candidate.preserveMaterials,
  };
}
