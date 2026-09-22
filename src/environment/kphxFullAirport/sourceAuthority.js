const EARTH_RADIUS_METERS = 6378137;

export const KPHX_FULL_AIRPORT_SOURCE = Object.freeze({
  packageName: "KPHX - Phoenix Sky Harbor Intl",
  packageVersion: "1.75.1",
  authority: "expanded user-supplied KPHX 1.75.1 X-Plane package + earth.wed.xml",
  sourceGeometryFormat: "X-Plane OBJ8",
  sourceCoordinateConvention: Object.freeze({
    units: "meters",
    x: "east",
    y: "up",
    z: "south",
    heading: "clockwise around +Y",
  }),
  rampReadyCoordinateConvention: Object.freeze({
    x: "north",
    y: "up",
    z: "east",
  }),
  anchor: Object.freeze({
    name: "T4 Gate A1",
    wedObjectId: "27855",
    latitude: 33.436530675,
    longitude: -111.998921221,
    headingDegrees: -90.08,
    rampReadyPosition: Object.freeze([0, 0, 6.2]),
  }),
  geometryPolicy: "preserve-source-positions-normals-uvs-indices-no-remesh-no-decimation",
  placementPolicy: "derive-all-runtime-transforms-from-earth.wed.xml-relative-to-a1-and-match-verified-source-airport-frame",
});

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

export function kphxWedToRampReadyPosition(latitudeDegrees, longitudeDegrees, elevationMeters = 0) {
  const anchor = KPHX_FULL_AIRPORT_SOURCE.anchor;
  const latitude0 = degreesToRadians(anchor.latitude);
  const east = degreesToRadians(longitudeDegrees - anchor.longitude)
    * EARTH_RADIUS_METERS
    * Math.cos(latitude0);
  const north = degreesToRadians(latitudeDegrees - anchor.latitude)
    * EARTH_RADIUS_METERS;

  return [
    -north + anchor.rampReadyPosition[0],
    elevationMeters + anchor.rampReadyPosition[1],
    -east + anchor.rampReadyPosition[2],
  ];
}

export function kphxXPlaneHeadingToRampReadyYawRadians(headingDegrees = 0) {
  return degreesToRadians(90 - headingDegrees);
}

export function kphxObj8VectorToRampReady([x, y, z]) {
  return [z, y, -x];
}
