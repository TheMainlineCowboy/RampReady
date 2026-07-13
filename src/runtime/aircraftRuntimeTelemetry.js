import * as THREE from "three";

const RUNTIME_KEY = "__RAMPREADY_RUNTIME__";
const PATCH_KEY = Symbol.for("rampready.aircraftRuntimeTelemetry");

function publishAircraftState(state) {
  const nextState = Object.freeze({
    aircraftAssetState: state.aircraftAssetState,
    renderedAircraftSource: state.renderedAircraftSource,
    dimensions: state.dimensions ?? null,
    updatedAt: new Date().toISOString(),
  });

  window[RUNTIME_KEY] = nextState;
  document.documentElement.dataset.aircraftAssetState = nextState.aircraftAssetState;
  document.documentElement.dataset.aircraftSource = nextState.renderedAircraftSource;
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
