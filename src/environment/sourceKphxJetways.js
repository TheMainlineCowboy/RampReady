import { installSourceKphxWedJetwayFleet } from "./sourceKphxWedJetwayFleet.js";

const WED_JETWAY_URL = "models/kphx/wed-jetways.exact.json";
const EXPECTED_FACADE_RESOURCE = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";
const EXPECTED_PLACEMENT_COUNT = 108;
const T4_VISIBLE_JETWAY_COUNT = 76;
const A1_FACADE_OBJECT_ID = 104804;

export const SOURCE_KPHX_JETWAY_AUTHORITY = Object.freeze({
  source: "KPHX 1.75.1 earth.wed.xml",
  placementArtifact: WED_JETWAY_URL,
  placementCount: EXPECTED_PLACEMENT_COUNT,
  sourceFacadeResource: EXPECTED_FACADE_RESOURCE,
  movableVisibleGeometry: "models/airport-jetway/Airport_Jetway.glb",
  movableVisibleGeometryAuthority: "exact-user-supplied-airport-jetway-glb",
  placementPolicy: "WED owns gate association, rotunda/cab axis and source-airport coordinates",
  geometryPolicy: "verified user-supplied exact movable bridge; no generated visible bridge replacement",
  detailLevel: "exact-WED-footprints-plus-user-supplied-exact-movable-jetway-v2",
});

function manifestUrl() {
  return `${import.meta.env.BASE_URL || "/"}${WED_JETWAY_URL}`;
}

async function loadManifest() {
  const response = await fetch(manifestUrl(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Exact WED jetway manifest returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest?.authority !== "KPHX-1.75.1-earth.wed.xml" || manifest?.jetwayFacadeCount !== EXPECTED_PLACEMENT_COUNT) {
    throw new Error("Exact WED jetway manifest failed its source contract");
  }
  if (!Array.isArray(manifest.placements) || manifest.placements.length !== EXPECTED_PLACEMENT_COUNT) {
    throw new Error(`Exact WED jetway placement count mismatch: ${manifest?.placements?.length ?? 0}`);
  }
  const ids = new Set();
  for (const placement of manifest.placements) {
    if (placement.resource !== EXPECTED_FACADE_RESOURCE) {
      throw new Error(`WED jetway ${placement.wedObjectId}: source facade changed to ${placement.resource}`);
    }
    if (!Number.isInteger(placement.wedObjectId) || ids.has(placement.wedObjectId)) {
      throw new Error(`WED jetway duplicate/invalid object id ${placement.wedObjectId}`);
    }
    ids.add(placement.wedObjectId);
    if (!Array.isArray(placement.rings) || placement.rings.length !== 1 || !placement.rings[0]?.nodes?.length) {
      throw new Error(`WED jetway ${placement.wedObjectId}: exact footprint ring is missing`);
    }
    for (const node of placement.rings[0].nodes) {
      if (!/^[-+]?\d+\.\d+$/.test(String(node.latitude)) || !/^[-+]?\d+\.\d+$/.test(String(node.longitude)) || !node.wallType) {
        throw new Error(`WED jetway ${placement.wedObjectId}: source footprint node data was not preserved`);
      }
    }
  }
  const a1 = manifest.placements.find((placement) => placement.wedObjectId === A1_FACADE_OBJECT_ID);
  if (!a1) throw new Error(`Exact WED A1 jetway facade ${A1_FACADE_OBJECT_ID} is missing`);
  if (a1.rings[0].nodes.length !== 7) throw new Error(`Exact WED A1 jetway must preserve seven nodes, received ${a1.rings[0].nodes.length}`);
  return manifest;
}

export async function installSourceKphxWEDJetways(THREE, environment, sourceAirportFrame) {
  if (!environment?.isGroup || !sourceAirportFrame?.isGroup) throw new Error("Exact KPHX WED jetway authority requires the source airport frame");
  environment.userData.authoredTerminal4UploadedJetwayLoadState = "loading-exact-WED-placement-and-supplied-GLB";
  const manifest = await loadManifest();

  const footprintAuthority = new THREE.Group();
  footprintAuthority.name = "KPHX_1_75_1_WED_JetwayPlacementAuthority";
  footprintAuthority.userData.sourceAuthority = "KPHX-1.75.1-earth.wed.xml";
  footprintAuthority.userData.placementArtifact = manifestUrl();
  footprintAuthority.userData.placementCount = manifest.placements.length;
  footprintAuthority.userData.a1FacadeObjectId = A1_FACADE_OBJECT_ID;
  footprintAuthority.userData.a1FacadeNodeCount = 7;
  footprintAuthority.userData.sourceFacadeResource = EXPECTED_FACADE_RESOURCE;
  footprintAuthority.userData.visibleMovableGeometryAuthority = SOURCE_KPHX_JETWAY_AUTHORITY.movableVisibleGeometryAuthority;
  footprintAuthority.userData.placementPolicy = SOURCE_KPHX_JETWAY_AUTHORITY.placementPolicy;
  sourceAirportFrame.add(footprintAuthority);

  const rendered = await installSourceKphxWedJetwayFleet(THREE, environment, sourceAirportFrame);
  if (rendered.map.jetwayCount !== T4_VISIBLE_JETWAY_COUNT) {
    throw new Error(`Exact T4 WED-mapped visible jetway count is ${rendered.map.jetwayCount}, expected ${T4_VISIBLE_JETWAY_COUNT}`);
  }
  sourceAirportFrame.updateMatrixWorld(true);

  environment.userData.sourceJetwayCount = EXPECTED_PLACEMENT_COUNT;
  environment.userData.terminal4JetwayCount = T4_VISIBLE_JETWAY_COUNT;
  environment.userData.exactKphxJetwaySourceFacadeResource = EXPECTED_FACADE_RESOURCE;
  environment.userData.exactKphxJetwayVisibleGeometryAuthority = SOURCE_KPHX_JETWAY_AUTHORITY.movableVisibleGeometryAuthority;
  environment.userData.exactKphxJetwayPlacementAuthority = SOURCE_KPHX_JETWAY_AUTHORITY.placementPolicy;
  environment.userData.exactKphxJetwaySubstitutionAllowed = false;
  environment.userData.exactKphxJetwayGeneratedVisibleGeometryCount = 0;
  environment.userData.authoredTerminal4JetwayDetailLevel = SOURCE_KPHX_JETWAY_AUTHORITY.detailLevel;
  return rendered.group;
}
