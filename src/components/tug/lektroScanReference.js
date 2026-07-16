export const LEKTRO_SCAN_REFERENCE = Object.freeze({
  sourceArchive: "796e1b5927744346991cbe3b8a01bd98.zip",
  sourceFiles: Object.freeze(["3DModel.obj", "3DModel.mtl", "3DModel.jpg"]),
  sourceGeometry: Object.freeze({
    vertices: 39377,
    triangles: 78790,
    bounds: Object.freeze({
      min: Object.freeze([-1.216637, -0.10136, -0.622343]),
      max: Object.freeze([1.002081, 0.339046, 1.460548]),
      extents: Object.freeze([2.218718, 0.440406, 2.082891]),
    }),
    texture: Object.freeze({ width: 4096, height: 4096, format: "JPEG" }),
  }),
  provisionalNormalization: Object.freeze({
    groundAxis: "+Y",
    groundMinimumYAtZero: true,
    centerHorizontally: true,
    targetLongestHorizontalExtentMeters: 5.5,
    scaleFactor: 2.4789089915888365,
    normalizedExtentsMeters: Object.freeze([5.5, 1.091723, 5.163354]),
  }),
  runtimeApproval: Object.freeze({
    approved: false,
    blocker: "Physical scale, orientation, cleanup, decimation, texture repair, and cradle alignment remain unverified.",
  }),
  requiredCleanup: Object.freeze([
    "remove pavement and scan background geometry",
    "repair holes and blurred or missing texture regions",
    "remove baked lighting and shadows",
    "confirm forward axis and operator orientation",
    "replace provisional scale with a confirmed physical dimension",
    "decimate for mobile and VR performance",
    "convert the cleaned result to GLB",
    "verify wheelbase, operator station, hood, deck, cradle, and nose-gear alignment in the simulator",
  ]),
});

export function assertLektroScanRuntimeReady(reference = LEKTRO_SCAN_REFERENCE) {
  if (!reference.runtimeApproval.approved) {
    throw new Error(`Lektro scan is reference-only: ${reference.runtimeApproval.blocker}`);
  }
  return reference;
}
