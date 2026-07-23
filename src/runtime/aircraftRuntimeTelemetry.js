import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { validateAircraftAssetMetadata } from "../components/aircraft/aircraftAssetContract.js";

const RUNTIME_KEY = "__RAMPREADY_RUNTIME__";
const PATCH_KEY = Symbol.for("rampready.aircraftRuntimeTelemetry");
const AUTHORED_UPGRADE_KEY = Symbol.for("rampready.authoredAircraftUpgrade");
const AUTHORED_SOURCE = "American-Eagle-CRJ-900-authored";
const EXPECTED_LENGTH_METERS = 32.5;
const EXPECTED_WINGSPAN_METERS = 23.64;
const EXPECTED_HEIGHT_METERS = 7.5;
const DIMENSION_TOLERANCE_METERS = 0.05;
const LEGACY_PARENT_SCALE = 0.82;
const PROCEDURAL_INTERNAL_SCALE = 1.35;

function publishAircraftState(state) {
  const nextState = Object.freeze({
    aircraftAssetState: state.aircraftAssetState,
    renderedAircraftSource: state.renderedAircraftSource,
    dimensions: state.dimensions ?? null,
    renderProof: state.renderProof ?? null,
    updatedAt: new Date().toISOString(),
  });

  window[RUNTIME_KEY] = nextState;
  document.documentElement.dataset.aircraftAssetState = nextState.aircraftAssetState;
  document.documentElement.dataset.aircraftSource = nextState.renderedAircraftSource;
}

function inspectAircraftReplacement(aircraftRoot) {
  const realModel = aircraftRoot?.userData?.realAircraftObject;
  let realMeshCount = 0;
  let visibleRealMeshCount = 0;

  realModel?.traverse((child) => {
    if (!child.isMesh) return;
    realMeshCount += 1;
    if (child.visible) visibleRealMeshCount += 1;
  });

  const proceduralChildren = (aircraftRoot?.children ?? []).filter((child) => child !== realModel);
  const hiddenProceduralChildCount = proceduralChildren.filter((child) => !child.visible).length;
  const retainedVisibleChildCount = proceduralChildren.filter((child) => child.visible).length;

  return Object.freeze({
    realModelAttached: Boolean(realModel && realModel.parent === aircraftRoot),
    realModelVisible: Boolean(realModel?.visible),
    realMeshCount,
    visibleRealMeshCount,
    hiddenProceduralChildCount,
    retainedVisibleChildCount,
  });
}

function dimensionsAreAuthoredAircraft(size) {
  return Math.abs(size.z - EXPECTED_LENGTH_METERS) <= DIMENSION_TOLERANCE_METERS
    && Math.abs(size.x - EXPECTED_WINGSPAN_METERS) <= DIMENSION_TOLERANCE_METERS
    && Math.abs(size.y - EXPECTED_HEIGHT_METERS) <= DIMENSION_TOLERANCE_METERS;
}

async function upgradeToAuthoredAircraft(aircraftRoot) {
  if (!aircraftRoot || aircraftRoot[AUTHORED_UPGRADE_KEY]) return;
  aircraftRoot[AUTHORED_UPGRADE_KEY] = "probing";

  try {
    const metadataUrl = new URL("models/crj700-user.asset.json", document.baseURI).href;
    const metadataResponse = await fetch(metadataUrl, { cache: "no-store" });
    if (!metadataResponse.ok) {
      aircraftRoot[AUTHORED_UPGRADE_KEY] = "unavailable";
      return;
    }

    const metadata = await metadataResponse.json();
    const validation = validateAircraftAssetMetadata(metadata);
    if (!validation.valid) throw new Error(`Authored aircraft metadata rejected: ${validation.failures.join("; ")}`);

    aircraftRoot[AUTHORED_UPGRADE_KEY] = "loading";
    const assetUrl = new URL("models/crj700-user.glb", document.baseURI).href;
    const gltf = await new GLTFLoader().loadAsync(assetUrl);
    const authoredModel = gltf.scene;
    authoredModel.name = "American Eagle CRJ900 authored aircraft";
    authoredModel.updateMatrixWorld(true);

    const rawBounds = new THREE.Box3().setFromObject(authoredModel);
    const rawSize = rawBounds.getSize(new THREE.Vector3());
    if (!dimensionsAreAuthoredAircraft(rawSize)) {
      throw new Error(`Unexpected authored aircraft dimensions ${rawSize.z.toFixed(3)} m long x ${rawSize.x.toFixed(3)} m span x ${rawSize.y.toFixed(3)} m high`);
    }

    let meshCount = 0;
    authoredModel.traverse((child) => {
      if (!child.isMesh) return;
      meshCount += 1;
      if (child.geometry && !child.geometry.getAttribute("normal")) child.geometry.computeVertexNormals();
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = true;
      child.userData.aircraftAssetSource = AUTHORED_SOURCE;
    });
    if (meshCount < 1) throw new Error("Authored aircraft contains no renderable meshes");

    authoredModel.scale.setScalar(1 / (LEGACY_PARENT_SCALE * PROCEDURAL_INTERNAL_SCALE));
    authoredModel.userData.noseGearCaptureOrigin = [0, 0, 0];
    authoredModel.userData.orientation = { up: "+Y", forward: "-Z" };
    authoredModel.userData.liveryState = "authored-american-eagle-materials-preserved";
    authoredModel.userData.liveryAttachment = "embedded-gltf-materials";

    const previousRealModel = aircraftRoot.userData.realAircraftObject;
    if (previousRealModel?.parent === aircraftRoot) aircraftRoot.remove(previousRealModel);
    aircraftRoot.add(authoredModel);

    for (const child of aircraftRoot.children) {
      if (child === authoredModel) continue;
      const retainedRole = child.userData?.retainedProceduralRole;
      child.visible = retainedRole === "operational-light" || retainedRole === "training-capture-marker";
    }

    aircraftRoot.userData.aircraftAssetState = "ready";
    aircraftRoot.userData.aircraftAssetUrl = assetUrl;
    aircraftRoot.userData.renderedAircraftSource = AUTHORED_SOURCE;
    aircraftRoot.userData.realAircraftObject = authoredModel;
    aircraftRoot.userData.liveryState = authoredModel.userData.liveryState;
    aircraftRoot.userData.aircraftDimensionsMeters = {
      length: Number(rawSize.z.toFixed(3)),
      wingspan: Number(rawSize.x.toFixed(3)),
      height: Number(rawSize.y.toFixed(3)),
    };
    aircraftRoot[AUTHORED_UPGRADE_KEY] = "ready";
    aircraftRoot.dispatchEvent({
      type: "aircraft-model-ready",
      source: AUTHORED_SOURCE,
      dimensions: aircraftRoot.userData.aircraftDimensionsMeters,
      liveryState: aircraftRoot.userData.liveryState,
    });
  } catch (error) {
    aircraftRoot[AUTHORED_UPGRADE_KEY] = "failed";
    aircraftRoot.userData.authoredAircraftUpgradeError = error instanceof Error ? error.message : String(error);
    console.warn("RampReady authored aircraft upgrade failed; verified fallback remains active.", error);
  }
}

if (!THREE.EventDispatcher.prototype[PATCH_KEY]) {
  const originalDispatchEvent = THREE.EventDispatcher.prototype.dispatchEvent;

  Object.defineProperty(THREE.EventDispatcher.prototype, PATCH_KEY, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  THREE.EventDispatcher.prototype.dispatchEvent = function dispatchRampReadyEvent(event) {
    if (event?.type === "aircraft-model-ready" && (event.source === "CRJ700.stl" || event.source === AUTHORED_SOURCE)) {
      publishAircraftState({
        aircraftAssetState: "ready",
        renderedAircraftSource: event.source,
        dimensions: event.dimensions,
        renderProof: inspectAircraftReplacement(this),
      });
      if (event.source === "CRJ700.stl") void upgradeToAuthoredAircraft(this);
    } else if (event?.type === "aircraft-model-error") {
      publishAircraftState({
        aircraftAssetState: "error",
        renderedAircraftSource: "procedural-fallback",
      });
    }

    return originalDispatchEvent.call(this, event);
  };
}

publishAircraftState({
  aircraftAssetState: "loading",
  renderedAircraftSource: "procedural-fallback",
});
