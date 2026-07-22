export const CONNECTION_PHASES = Object.freeze({
  APPROACH: "approach",
  ALIGNED: "aligned",
  CAPTURING: "capturing",
  SECURED: "secured",
  TOWING: "towing",
  LOWERING: "lowering",
  RELEASED: "released",
  CLEAR: "clear",
});

export const CONNECTION_LIMITS = Object.freeze({
  distance: 0.42,
  lateral: 0.2,
  heading: (6 * Math.PI) / 180,
  speed: 0.12,
  captureSeconds: 1.1,
  lowerSeconds: 0.9,
  clearDistance: 2.2,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function createConnectionState(overrides = {}) {
  return {
    phase: CONNECTION_PHASES.APPROACH,
    progress: 0,
    locked: false,
    releaseBaselineDistance: null,
    clearTravel: 0,
    reason: "Approach and align with the nose gear.",
    ...overrides,
  };
}

export function evaluateAlignment(metrics, limits = CONNECTION_LIMITS) {
  const distance = Math.abs(finite(metrics?.distance, Infinity));
  const lateral = Math.abs(finite(metrics?.lateral, Infinity));
  const heading = Math.abs(finite(metrics?.heading, Infinity));
  const speed = Math.abs(finite(metrics?.speed, Infinity));
  const fromFront = metrics?.fromFront !== false;

  if (!fromFront) return { ready: false, reason: "Approach from directly in front of the nose gear." };
  if (speed > limits.speed) return { ready: false, reason: "Stop the tug before capture." };
  if (heading > limits.heading) return { ready: false, reason: "Straighten the tug with the aircraft." };
  if (lateral > limits.lateral) return { ready: false, reason: "Center the cradle under the nose gear." };
  if (distance > limits.distance) return { ready: false, reason: `Close the final ${(distance - limits.distance).toFixed(1)} m.` };
  return { ready: true, reason: "Alignment confirmed. Capture is available." };
}

export function requestCapture(state, metrics, limits = CONNECTION_LIMITS) {
  const alignment = evaluateAlignment(metrics, limits);
  if (state.phase !== CONNECTION_PHASES.APPROACH && state.phase !== CONNECTION_PHASES.ALIGNED) {
    return { ...state, reason: "Capture is unavailable in the current connection phase." };
  }
  if (!alignment.ready) return { ...state, phase: CONNECTION_PHASES.APPROACH, reason: alignment.reason };
  return { ...state, phase: CONNECTION_PHASES.CAPTURING, progress: 0, locked: false, reason: "Capturing nose gear. Hold position." };
}

export function beginTow(state) {
  if (state.phase !== CONNECTION_PHASES.SECURED) return { ...state, reason: "Secure the nose gear before towing." };
  return { ...state, phase: CONNECTION_PHASES.TOWING, locked: true, reason: "Nose gear secured. Tow enabled." };
}

export function requestLower(state, speed, articulation = 0) {
  if (state.phase !== CONNECTION_PHASES.TOWING && state.phase !== CONNECTION_PHASES.SECURED) {
    return { ...state, reason: "Lowering is unavailable in the current phase." };
  }
  if (Math.abs(finite(speed)) > 0.05) return { ...state, reason: "Stop completely before lowering the cradle." };
  if (Math.abs(finite(articulation)) > (8 * Math.PI) / 180) return { ...state, reason: "Straighten tug and aircraft before lowering." };
  return { ...state, phase: CONNECTION_PHASES.LOWERING, progress: 0, reason: "Lowering cradle. Hold position." };
}

export function stepConnection(state, input = {}, dt = 1 / 60, limits = CONNECTION_LIMITS) {
  const safeDt = clamp(finite(dt, 0), 0, 0.1);
  const speed = Math.abs(finite(input.speed));
  const alignment = evaluateAlignment(input.metrics, limits);

  if (state.phase === CONNECTION_PHASES.APPROACH || state.phase === CONNECTION_PHASES.ALIGNED) {
    return {
      ...state,
      phase: alignment.ready ? CONNECTION_PHASES.ALIGNED : CONNECTION_PHASES.APPROACH,
      progress: 0,
      locked: false,
      reason: alignment.reason,
    };
  }

  if (state.phase === CONNECTION_PHASES.CAPTURING) {
    if (!alignment.ready || speed > limits.speed) {
      return createConnectionState({ reason: "Capture aborted because alignment or speed moved outside limits." });
    }
    const progress = clamp(state.progress + safeDt / limits.captureSeconds, 0, 1);
    if (progress >= 1) return { ...state, phase: CONNECTION_PHASES.SECURED, progress: 1, locked: true, reason: "Nose gear lifted and secured." };
    return { ...state, progress, locked: false };
  }

  if (state.phase === CONNECTION_PHASES.LOWERING) {
    if (speed > 0.05) return { ...state, reason: "Movement detected. Stop before continuing release." };
    const progress = clamp(state.progress + safeDt / limits.lowerSeconds, 0, 1);
    if (progress >= 1) {
      return {
        ...state,
        phase: CONNECTION_PHASES.RELEASED,
        progress: 1,
        locked: false,
        releaseBaselineDistance: null,
        clearTravel: 0,
        reason: "Nose gear released. Drive clear.",
      };
    }
    return { ...state, progress };
  }

  if (state.phase === CONNECTION_PHASES.RELEASED) {
    const separation = Math.abs(finite(input.clearDistance));
    if (!Number.isFinite(state.releaseBaselineDistance)) {
      return {
        ...state,
        releaseBaselineDistance: separation,
        clearTravel: 0,
        reason: `Nose gear released. Drive ${limits.clearDistance.toFixed(1)} m clear.`,
      };
    }
    const clearTravel = Math.abs(separation - state.releaseBaselineDistance);
    if (clearTravel >= limits.clearDistance) {
      return { ...state, phase: CONNECTION_PHASES.CLEAR, clearTravel, reason: "Tug clear of aircraft." };
    }
    return {
      ...state,
      clearTravel,
      reason: `Drive another ${Math.max(0, limits.clearDistance - clearTravel).toFixed(1)} m clear.`,
    };
  }

  return state;
}

export function connectionAllowsMotion(state) {
  return [CONNECTION_PHASES.APPROACH, CONNECTION_PHASES.ALIGNED, CONNECTION_PHASES.TOWING, CONNECTION_PHASES.RELEASED, CONNECTION_PHASES.CLEAR].includes(state.phase);
}

export function connectionHasAircraft(state) {
  return [CONNECTION_PHASES.SECURED, CONNECTION_PHASES.TOWING, CONNECTION_PHASES.LOWERING].includes(state.phase);
}
