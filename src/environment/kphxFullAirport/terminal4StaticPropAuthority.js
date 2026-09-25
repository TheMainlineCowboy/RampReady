export const KPHX_T4_EXACT_STATIC_PROP_AUTHORITY = Object.freeze({
  authority: "KPHX-1.75.1-WED-T4-authored-static-props-exact-materialized-v1",
  sourceWedSha256: "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498",
  expectedPlacementCount: 154,
  expectedUniqueResourceCount: 8,
  packageLights: Object.freeze({
    manifestUrl: "/models/kphx-full-airport/manifest.json",
    expectedPlacementCount: 78,
    expectedUniqueResourceCount: 2,
    resources: Object.freeze([
    "Lights/AirportLight.obj",
    "Lights/AirportLightNoPole.obj"
]),
  }),
  misterXRamps: Object.freeze({
    manifestUrl: "/models/kphx-full-airport/batches/t4-misterx.manifest.json",
    expectedPlacementCount: 62,
    expectedUniqueResourceCount: 4,
    resources: Object.freeze([
    "MisterX_Library/Airport/Ramps/Ramp_1_Stripes_nL.obj",
    "MisterX_Library/Airport/Ramps/Ramp_1_nL.obj",
    "MisterX_Library/Airport/Ramps/Ramp_Southwest_Med.obj",
    "MisterX_Library/Airport/Ramps/Ramp_Southwest_Med_nL.obj"
]),
  }),
  misterXConstruction: Object.freeze({
    manifestUrl: "/models/kphx-full-airport/batches/t4-misterx.manifest.json",
    expectedPlacementCount: 1,
    expectedUniqueResourceCount: 1,
    resources: Object.freeze([
    "MisterX_Library/Objects/Construction/Garbage_Container_Red.obj"
]),
  }),
  zdpStopMarkers: Object.freeze({
    manifestUrl: "/models/kphx-full-airport/batches/t4-zdp.manifest.json",
    expectedPlacementCount: 13,
    expectedUniqueResourceCount: 1,
    resources: Object.freeze([
    "ZDP_Library/markings/aircraft_stop_markers/SDF_code_C_AAL.obj"
]),
  }),
  exclusions: Object.freeze({
    gse: true,
    staticAircraft: true,
    people: true,
    unresolvedLaminarLibrary: true,
    unresolvedOpenSceneryX: true,
  }),
});
