// Ground-crew actions are an opt-in *visual simulation* for Gate A1, not
// certified ramp procedures. The LEKTRO/nose-gear/jetway runtime is authoritative.
//
// Timeline is pure so a real NPC and a future authored/animated GLB can use
// the same safety and timing rules without coupling to Three.js.
export const A1_CREW_TIMING = Object.freeze({
  serviceEnd: 1.8,
  loaderLowered: 4.2,
  loaderDeparted: 12.2,
  marshalOnStation: 15.0,
});
export const A1_CREW_PATH = Object.freeze({
  // Aircraft-local metres: right-hand service zone; the path stays away from
  // the tug approach line at local x=0 and nose at negative z.
  start: Object.freeze({ x: 4.3, z: 3.6 }),
  finish: Object.freeze({ x: 16.2, z: 6.2 }),
  marshalStart: Object.freeze({ x: -7.0, z: -7.1 }),
  marshalFinish: Object.freeze({ x: -3.7, z: -7.1 }),
});

const clamp01 = n => Math.min(1, Math.max(0, n));
const smooth = t => { const k=clamp01(t); return k*k*(3-2*k); };
export function computeA1CrewSnapshot(timeSeconds, { tugNoseDistance = 20, pushbackStage = 0 } = {}) {
  const t = Math.max(0, Number.isFinite(timeSeconds) ? timeSeconds : 0);
  const {serviceEnd,loaderLowered,loaderDeparted,marshalOnStation} = A1_CREW_TIMING;
  const lower = smooth((t-serviceEnd)/(loaderLowered-serviceEnd));
  const drive = smooth((t-loaderLowered)/(loaderDeparted-loaderLowered));
  const marshalWalk = smooth((t-(loaderDeparted-0.5))/(marshalOnStation-(loaderDeparted-0.5)));
  const equipmentClear = t >= loaderDeparted;
  const ready = equipmentClear && t >= marshalOnStation;
  const phase = t < serviceEnd ? 'servicing'
    : t < loaderLowered ? 'lowering'
    : t < loaderDeparted ? 'loader-departing'
    : t < marshalOnStation ? 'marshal-positioning'
    : 'ready';
  const signal = !ready ? 'hold'
    : pushbackStage > 1 ? 'standby'
    : tugNoseDistance <= 2.5 ? 'stop'
    : 'approach';
  return {
    elapsed: t, phase, lowerProgress: lower, loaderProgress: drive,
    marshalWalkProgress: marshalWalk,
    loaderX: A1_CREW_PATH.start.x + (A1_CREW_PATH.finish.x - A1_CREW_PATH.start.x)*drive,
    loaderZ: A1_CREW_PATH.start.z + (A1_CREW_PATH.finish.z - A1_CREW_PATH.start.z)*drive,
    marshalX: A1_CREW_PATH.marshalStart.x + (A1_CREW_PATH.marshalFinish.x - A1_CREW_PATH.marshalStart.x)*marshalWalk,
    marshalZ: A1_CREW_PATH.marshalFinish.z,
    equipmentClear, ready, signal,
  };
}

export function createA1CrewClock() {
  let elapsed = 0;
  let snapshot = computeA1CrewSnapshot(0);
  return {
    get snapshot() { return snapshot; },
    step(delta, options={}) {
      // Paused tabs must not skip straight to a cleared aircraft.
      elapsed += Math.min(.08, Math.max(0, Number.isFinite(delta) ? delta : 0));
      snapshot = computeA1CrewSnapshot(elapsed, options);
      return snapshot;
    },
    reset() { elapsed=0; snapshot=computeA1CrewSnapshot(0); return snapshot; },
  };
}
