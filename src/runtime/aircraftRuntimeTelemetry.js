import * as THREE from "three";

const RUNTIME_KEY = "__RAMPREADY_RUNTIME__";
const PATCH_KEY = Symbol.for("rampready.aircraftRuntimeTelemetry");

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

if (!THREE.EventDispatcher.prototype[PATCH_KEY]) {
  const originalDispatchEvent = THREE.EventDispatcher.prototype.dispatchEvent;

  Object.defineProperty(THREE.EventDispatcher.prototype, PATCH_KEY, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  THREE.EventDispatcher.prototype.dispatchEvent = function dispatchRampReadyEvent(event) {
    if (event?.type === "aircraft-model-ready" && event.source === "CRJ700.stl") {
      publishAircraftState({
        aircraftAssetState: "ready",
        renderedAircraftSource: "CRJ700.stl",
        dimensions: event.dimensions,
        renderProof: inspectAircraftReplacement(this),
      });
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
