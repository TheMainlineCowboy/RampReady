import { SOURCE_KPHX_A1_ORIGIN } from "./sourceKphxTerminal4.js";

const EARTH_RADIUS_METERS = 6378137;
const EXACT_WED_GROUND_URL = "models/kphx/wed-ground.exact.json";
const A1_APRON_WED_OBJECT_ID = 45506;
const A1_APRON_RESOURCE = "ZDP_Library/ground_textures/concrete/flat/Flat_New_Uniform.pol";

export const AUTHORED_KPHX_GROUND_PROFILE = Object.freeze({
  source: "KPHX 1.75.1 earth.wed.xml",
  packageVersion: "1.75.1",
  anchorGate: "A1",
  anchorHeadingDegrees: SOURCE_KPHX_A1_ORIGIN.headingDegrees,
  coordinateFrame: "exact WED geospatial frame anchored at source Gate A1",
  sceneOffset: SOURCE_KPHX_A1_ORIGIN.browserPosition,
  detailLevel: "exact-kphx-1.75.1-wed-ground-readiness-v1",
  surfaceMaterialMode: "exact-WED-geometry; visible source materials fail-closed until resource ingest",
  sourceJetwayCount: 108,
  terminal4JetwayCount: 76,
  terminal4ParkingCount: 84,
});

function sourceLocalFromWED(latitude, longitude) {
  const latitude0 = SOURCE_KPHX_A1_ORIGIN.latitude * Math.PI / 180;
  const east = (longitude - SOURCE_KPHX_A1_ORIGIN.longitude) * Math.PI / 180
    * EARTH_RADIUS_METERS * Math.cos(latitude0);
  const north = (latitude - SOURCE_KPHX_A1_ORIGIN.latitude) * Math.PI / 180
    * EARTH_RADIUS_METERS;
  return { x: east, z: -north };
}

async function loadExactWedGroundManifest() {
  const url = `${import.meta.env.BASE_URL}${EXACT_WED_GROUND_URL}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Exact KPHX WED ground returned HTTP ${response.status}`);
  const payload = await response.json();
  if (
    payload?.authority !== "KPHX-1.75.1-earth.wed.xml-ground"
    || payload?.source?.bytes !== 24885640
    || payload?.source?.sha256 !== "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498"
    || payload?.counts?.WED_PolygonPlacement !== 302
    || payload?.counts?.WED_LinePlacement !== 1158
    || payload?.counts?.WED_DrapedOrthophoto !== 955
    || payload?.counts?.WED_Taxiway !== 5
    || payload?.counts?.WED_Runway !== 3
  ) throw new Error("Exact KPHX WED ground manifest failed source identity checks");
  return { url, payload };
}

function ringsFromPlacement(placement) {
  const rings = [];
  const visit = (chain) => {
    if (Array.isArray(chain?.nodes) && chain.nodes.length >= 3) rings.push(chain.nodes);
    for (const child of chain?.children || []) visit(child);
  };
  for (const chain of placement?.geometry || []) visit(chain);
  return rings;
}

function controlPoint(node, suffix) {
  const point = node.point;
  const latitude = Number(point.latitude) + Number(point[`ctrl_latitude_${suffix}`] || 0);
  const longitude = Number(point.longitude) + Number(point[`ctrl_longitude_${suffix}`] || 0);
  return sourceLocalFromWED(latitude, longitude);
}

function appendRingPath(path, ring) {
  const firstPoint = ring[0].point;
  const first = sourceLocalFromWED(Number(firstPoint.latitude), Number(firstPoint.longitude));
  path.moveTo(first.x, first.z);
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const currentPoint = current.point;
    const nextPoint = next.point;
    const target = sourceLocalFromWED(Number(nextPoint.latitude), Number(nextPoint.longitude));
    const curved = [
      currentPoint.ctrl_latitude_hi,
      currentPoint.ctrl_longitude_hi,
      nextPoint.ctrl_latitude_lo,
      nextPoint.ctrl_longitude_lo,
    ].some((value) => Math.abs(Number(value || 0)) > 0);
    if (curved) {
      const control1 = controlPoint(current, "hi");
      const control2 = controlPoint(next, "lo");
      path.bezierCurveTo(control1.x, control1.z, control2.x, control2.z, target.x, target.z);
    } else {
      path.lineTo(target.x, target.z);
    }
  }
  path.closePath();
}

function buildExactA1ApronCollision(THREE, placement) {
  if (placement?.definition?.resource !== A1_APRON_RESOURCE) {
    throw new Error(`WED ${A1_APRON_WED_OBJECT_ID} resource changed: ${placement?.definition?.resource}`);
  }
  const rings = ringsFromPlacement(placement);
  if (rings.length !== 5 || rings[0].length !== 61) {
    throw new Error(`WED ${A1_APRON_WED_OBJECT_ID} ring structure changed`);
  }
  const shape = new THREE.Shape();
  appendRingPath(shape, rings[0]);
  for (const ring of rings.slice(1)) {
    const hole = new THREE.Path();
    appendRingPath(hole, ring);
    shape.holes.push(hole);
  }
  const geometry = new THREE.ShapeGeometry(shape, 16);
  geometry.rotateX(Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    name: "KPHX exact WED A1 apron collision only",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  material.colorWrite = false;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "KPHX_WED_45506_A1_Apron_CollisionAuthority";
  mesh.userData = {
    sourceAuthority: "KPHX-1.75.1-earth.wed.xml",
    wedObjectId: A1_APRON_WED_OBJECT_ID,
    sourceResource: A1_APRON_RESOURCE,
    ringCount: rings.length,
    outerNodeCount: rings[0].length,
    visibleMaterialStatus: "fail-closed-until-exact-ZDP-resource-ingest",
  };
  return mesh;
}

function buildGateMetadata() {
  return {
    b15Anchors: [],
    trainingCorridor: {
      startGate: "A1",
      endGates: [],
      distanceMeters: [],
      coordinateFrame: AUTHORED_KPHX_GROUND_PROFILE.coordinateFrame,
    },
  };
}

export async function installAuthoredKphxGround(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  environment.userData.groundSource = "loading-exact-kphx-1.75.1-wed";
  environment.userData.groundCoordinateFrame = AUTHORED_KPHX_GROUND_PROFILE.coordinateFrame;

  const { url, payload } = await loadExactWedGroundManifest();
  const placements = payload.placements?.WED_PolygonPlacement || [];
  const a1Apron = placements.find((placement) => placement.wedObjectId === A1_APRON_WED_OBJECT_ID);
  if (!a1Apron) throw new Error(`Exact WED A1 apron polygon ${A1_APRON_WED_OBJECT_ID} is missing`);

  const authored = new THREE.Group();
  authored.name = "KPHX_1_75_1_Exact_WED_GroundAuthority";
  authored.position.fromArray(SOURCE_KPHX_A1_ORIGIN.browserPosition);
  authored.rotation.y = THREE.MathUtils.degToRad(90);
  const collision = buildExactA1ApronCollision(THREE, a1Apron);
  authored.add(collision);
  environment.add(authored);
  authored.updateMatrixWorld(true);

  const metadata = buildGateMetadata();
  environment.userData.groundSource = "exact-kphx-1.75.1-wed-a1-apron-collision-authority";
  environment.userData.authoredGroundUrl = url;
  environment.userData.authoredGround = authored;
  environment.userData.authoredGroundSurfaceTextures = null;
  environment.userData.authoredGroundTexturedSurfaceMaterialCount = 0;
  environment.userData.authoredGroundEnhancedMarkingMaterialCount = 0;
  environment.userData.authoredGroundMarkingContactMode = "exact-WED-placement-pending-source-resource-materialization";
  environment.userData.authoredGroundGateMarkingCount = 0;
  environment.userData.authoredGroundStandMarkingDetailLevel = "replaced-by-exact-WED-gate-number-ingest";
  environment.userData.authoredGroundSurfaceMaterialMode = AUTHORED_KPHX_GROUND_PROFILE.surfaceMaterialMode;
  environment.userData.kphxVersion = AUTHORED_KPHX_GROUND_PROFILE.packageVersion;
  environment.userData.kphxDetailLevel = AUTHORED_KPHX_GROUND_PROFILE.detailLevel;
  environment.userData.sourceJetwayCount = AUTHORED_KPHX_GROUND_PROFILE.sourceJetwayCount;
  environment.userData.terminal4JetwayCount = AUTHORED_KPHX_GROUND_PROFILE.terminal4JetwayCount;
  environment.userData.terminal4ParkingCount = AUTHORED_KPHX_GROUND_PROFILE.terminal4ParkingCount;
  environment.userData.b15Anchors = metadata.b15Anchors;
  environment.userData.trainingCorridor = metadata.trainingCorridor;
  environment.userData.authoredGroundCounts = payload.counts;
  environment.userData.exactWedA1ApronCollision = collision;
  environment.userData.exactWedA1ApronObjectId = A1_APRON_WED_OBJECT_ID;
  environment.userData.exactWedGroundSourceSha256 = payload.source.sha256;
  return authored;
}