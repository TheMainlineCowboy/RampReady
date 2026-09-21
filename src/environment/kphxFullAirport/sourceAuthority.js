const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

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

function geodeticToEcef(latitudeDegrees, longitudeDegrees) {
  const latitude = degreesToRadians(latitudeDegrees);
  const longitude = degreesToRadians(longitudeDegrees);
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const sinLongitude = Math.sin(longitude);
  const cosLongitude = Math.cos(longitude);
  const primeVerticalRadius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLatitude * sinLatitude);

  return [
    primeVerticalRadius * cosLatitude * cosLongitude,
    primeVerticalRadius * cosLatitude * sinLongitude,
    primeVerticalRadius * (1 - WGS84_E2) * sinLatitude,
  ];
}

const anchorEcef = geodeticToEcef(
  KPHX_FULL_AIRPORT_SOURCE.anchor.latitude,
  KPHX_FULL_AIRPORT_SOURCE.anchor.longitude,
);
const anchorLatitudeRadians = degreesToRadians(KPHX_FULL_AIRPORT_SOURCE.anchor.latitude);
const anchorLongitudeRadians = degreesToRadians(KPHX_FULL_AIRPORT_SOURCE.anchor.longitude);
const sinAnchorLatitude = Math.sin(anchorLatitudeRadians);
const cosAnchorLatitude = Math.cos(anchorLatitudeRadians);
const sinAnchorLongitude = Math.sin(anchorLongitudeRadians);
const cosAnchorLongitude = Math.cos(anchorLongitudeRadians);

export function kphxWedToRampReadyPosition(latitudeDegrees, longitudeDegrees, elevationMeters = 0) {
  const pointEcef = geodeticToEcef(latitudeDegrees, longitudeDegrees);
  const dx = pointEcef[0] - anchorEcef[0];
  const dy = pointEcef[1] - anchorEcef[1];
  const dz = pointEcef[2] - anchorEcef[2];

  const east = -sinAnchorLongitude * dx + cosAnchorLongitude * dy;
  const north = -sinAnchorLatitude * cosAnchorLongitude * dx
    - sinAnchorLatitude * sinAnchorLongitude * dy
    + cosAnchorLatitude * dz;

  return [
    -north + KPHX_FULL_AIRPORT_SOURCE.anchor.rampReadyPosition[0],
    elevationMeters + KPHX_FULL_AIRPORT_SOURCE.anchor.rampReadyPosition[1],
    -east + KPHX_FULL_AIRPORT_SOURCE.anchor.rampReadyPosition[2],
  ];
}

export function kphxXPlaneHeadingToRampReadyYawRadians(headingDegrees = 0) {
  return degreesToRadians(90 - headingDegrees);
}

export function kphxObj8VectorToRampReady([x, y, z]) {
  return [z, y, -x];
}
