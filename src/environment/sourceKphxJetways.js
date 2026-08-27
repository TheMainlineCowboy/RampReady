const WED_JETWAY_URL = "models/kphx/wed-jetways.exact.json";
const EXPECTED_FACADE_RESOURCE = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";
const EXPECTED_PLACEMENT_COUNT = 108;
const A1_FACADE_OBJECT_ID = 104804;

export const SOURCE_KPHX_JETWAY_AUTHORITY = Object.freeze({
  source: "KPHX 1.75.1 earth.wed.xml",
  placementArtifact: WED_JETWAY_URL,
  placementCount: EXPECTED_PLACEMENT_COUNT,
  visibleGeometryResource: EXPECTED_FACADE_RESOURCE,
  visibleGeometryStatus: "blocked-missing-exact-xplane-Jetway_1_solid.fac",
  substitutionPolicy: "forbidden",
  detailLevel: "exact-WED-footprints-anchors-only-visible-geometry-fail-closed-v1",
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
  if (!ids.has(A1_FACADE_OBJECT_ID)) throw new Error(`Exact WED A1 jetway facade ${A1_FACADE_OBJECT_ID} is missing`);
  return manifest;
}

export async function installSourceKphxWEDJetways(THREE, environment, sourceAirportFrame) {
  if (!environment?.isGroup || !sourceAirportFrame?.isGroup) throw new Error("Exact KPHX WED jetway authority requires the source airport frame");
  environment.userData.authoredTerminal4UploadedJetwayLoadState = "loading-exact-WED-placement-authority";
  const manifest = await loadManifest();

  // Preserve the exact authored WED footprints/anchors in the live airport frame,
  // but intentionally create no visible jetway mesh until the actual X-Plane
  // Jetway_1_solid.fac resource is available. Airport_Jetway.glb and any other
  // model are not source-equivalent substitutes for this package resource.
  const group = new THREE.Group();
  group.name = "KPHX_1_75_1_WED_JetwayPlacementAuthority";
  group.userData.sourceAuthority = "KPHX-1.75.1-earth.wed.xml";
  group.userData.placementArtifact = manifestUrl();
  group.userData.placementCount = manifest.placements.length;
  group.userData.a1FacadeObjectId = A1_FACADE_OBJECT_ID;
  group.userData.visibleGeometryResource = EXPECTED_FACADE_RESOURCE;
  group.userData.visibleGeometryStatus = SOURCE_KPHX_JETWAY_AUTHORITY.visibleGeometryStatus;
  group.userData.substitutionPolicy = SOURCE_KPHX_JETWAY_AUTHORITY.substitutionPolicy;
  sourceAirportFrame.add(group);
  sourceAirportFrame.updateMatrixWorld(true);

  environment.userData.authoredTerminal4Jetways = group;
  environment.userData.authoredTerminal4A1JetwayController = null;
  environment.userData.authoredTerminal4A1JetwayAnimationAuthority = null;
  environment.userData.authoredTerminal4UploadedJetwayLoadState = SOURCE_KPHX_JETWAY_AUTHORITY.visibleGeometryStatus;
  environment.userData.authoredTerminal4UploadedJetwayPlacementCount = EXPECTED_PLACEMENT_COUNT;
  environment.userData.authoredTerminal4UploadedJetwayCount = 0;
  environment.userData.authoredTerminal4UploadedJetwayVerifiedModelCount = 0;
  environment.userData.authoredTerminal4UploadedJetwayConnectorCount = 0;
  environment.userData.authoredTerminal4UploadedJetwayReadyAuthority = "exact-KPHX-WED-placement-only-visible-geometry-unresolved";
  environment.userData.authoredTerminal4UploadedJetwayArticulationAuthority = "blocked-until-exact-X-Plane-facade-geometry-is-ingested";
  environment.userData.authoredTerminal4JetwaySourceGeometryMode = "fail-closed-missing-lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";
  environment.userData.authoredTerminal4RequiresOriginalJetwayMesh = true;
  environment.userData.authoredTerminal4TerminalConnectedJetwayCount = 0;
  environment.userData.authoredTerminal4JetwayDetailLevel = SOURCE_KPHX_JETWAY_AUTHORITY.detailLevel;
  environment.userData.sourceJetwayCount = EXPECTED_PLACEMENT_COUNT;
  environment.userData.terminal4JetwayCount = EXPECTED_PLACEMENT_COUNT;
  environment.userData.exactKphxJetwayUnresolvedResource = EXPECTED_FACADE_RESOURCE;
  environment.userData.exactKphxJetwaySubstitutionAllowed = false;
  return group;
}
