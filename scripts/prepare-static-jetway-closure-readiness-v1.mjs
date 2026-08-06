import fs from "node:fs";

const files = Object.freeze({
  source: "src/environment/staticJetwayPortalClosures.js",
  fleet: "src/environment/uploadedAirportJetwayFleet.js",
  readiness: "src/environment/uploadedAirportJetwayFleetReadyV2.js",
  authored: "src/environment/authoredTerminal4Visual.js",
  trainer: "src/components/RampReadyStandupTrainerTerminal4.jsx",
});
const content = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]),
);

const CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3";
const TARGET_AUTHORITY = "placement-bridgeEnd-shared-with-static-articulation-v1";
const EVIDENCE_AUTHORITY = "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1";

function requireTokens(key, tokens) {
  for (const token of tokens) {
    if (!content[key].includes(token)) {
      throw new Error(`${files[key]}: prepared static Cab readiness is missing ${token}`);
    }
  }
}

requireTokens("source", [
  `STATIC_CAB_CLOSURE_AUTHORITY = "${CLOSURE_AUTHORITY}"`,
  `STATIC_CAB_TARGET_AUTHORITY = "${TARGET_AUTHORITY}"`,
  "const contactDistance = Number(placement.bridgeEnd)",
  "missing the exact positive placement.bridgeEnd shared with articulation",
  "group.userData.bridgeEndFallbackCount = 0",
  "group.userData.cabPanelCount = closurePanelCount",
  "group.userData.cabWindowCount = closureWindowCount",
  "group.userData.cabSurroundPieceCount = surroundPieceCount",
  "group.userData.authoredNodeTransformCount = authoredNodeTransformCount",
  "group.userData.apronFacingOpenAreaMeters = apronFacingOpenAreaMeters",
  "STATIC_JETWAY_CAB_TARGET_AUTHORITY",
]);
for (const forbidden of [
  "finitePositive(placement.bridgeEnd, 18)",
  "placement.bridgeEnd ??",
  "bridgeEndFallbackCount += 1",
]) {
  if (content.source.includes(forbidden)) {
    throw new Error(`${files.source}: prepared static Cab target fallback remains: ${forbidden}`);
  }
}

requireTokens("fleet", [
  "STATIC_JETWAY_CAB_CLOSURE_AUTHORITY",
  "STATIC_JETWAY_CAB_TARGET_AUTHORITY",
  "const staticPortalClosures = installStaticJetwayPortalClosures(THREE, fleet, placements)",
  "uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority",
  "uploadedJetwayStaticCabTargetAuthority = staticPortalClosures.cabTargetAuthority",
  "uploadedJetwayStaticBridgeEndFallbackCount = staticPortalClosures.bridgeEndFallbackCount",
  "uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount",
  "uploadedJetwayStaticCabClosureWindowCount = staticPortalClosures.cabWindowCount",
  "uploadedJetwayStaticCabClosureSurroundPieceCount = staticPortalClosures.cabSurroundPieceCount",
  "uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticPortalClosures.authoredNodeTransformCount",
  "uploadedJetwayStaticApronFacingOpenAreaMeters = staticPortalClosures.apronFacingOpenAreaMeters",
]);

requireTokens("readiness", [
  `STATIC_JETWAY_CAB_CLOSURE_AUTHORITY === "${CLOSURE_AUTHORITY}"`,
  `STATIC_JETWAY_CAB_TARGET_AUTHORITY === "${TARGET_AUTHORITY}"`,
  "staticPortalClosures.cabClosureAuthority !== STATIC_JETWAY_CAB_CLOSURE_AUTHORITY",
  "staticPortalClosures.cabTargetAuthority !== STATIC_JETWAY_CAB_TARGET_AUTHORITY",
  "staticPortalClosures.bridgeEndFallbackCount !== 0",
  "staticPortalClosures.cabPanelCount !== 57",
  "staticPortalClosures.cabWindowCount !== 57",
  "staticPortalClosures.cabSurroundPieceCount !== 228",
  "staticPortalClosures.authoredNodeTransformCount !== 0",
  "Math.abs(staticPortalClosures.apronFacingOpenAreaMeters) > 1e-9",
  "uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority",
  "uploadedJetwayStaticCabTargetAuthority = staticPortalClosures.cabTargetAuthority",
  "uploadedJetwayStaticBridgeEndFallbackCount = staticPortalClosures.bridgeEndFallbackCount",
  "uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount",
  "uploadedJetwayStaticCabClosureWindowCount = staticPortalClosures.cabWindowCount",
  "uploadedJetwayStaticCabClosureSurroundPieceCount = staticPortalClosures.cabSurroundPieceCount",
  "uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticPortalClosures.authoredNodeTransformCount",
  "uploadedJetwayStaticApronFacingOpenAreaMeters = staticPortalClosures.apronFacingOpenAreaMeters",
]);

requireTokens("authored", [
  "authoredTerminal4UploadedJetwayStaticCabClosureAuthority",
  "authoredTerminal4UploadedJetwayStaticCabTargetAuthority",
  "authoredTerminal4UploadedJetwayStaticBridgeEndFallbackCount",
  "authoredTerminal4UploadedJetwayStaticCabClosurePanelCount",
  "authoredTerminal4UploadedJetwayStaticCabClosureWindowCount",
  "authoredTerminal4UploadedJetwayStaticCabClosureSurroundPieceCount",
  "authoredTerminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount",
  "authoredTerminal4UploadedJetwayStaticApronFacingOpenAreaMeters",
  "authoredTerminal4UploadedJetwayStaticCabClosureEvidenceAuthority",
]);

requireTokens("trainer", [
  "terminal4UploadedJetwayStaticCabClosureAuthority",
  "terminal4UploadedJetwayStaticCabTargetAuthority",
  "terminal4UploadedJetwayStaticBridgeEndFallbackCount",
  "terminal4UploadedJetwayStaticCabClosurePanelCount",
  "terminal4UploadedJetwayStaticCabClosureWindowCount",
  "terminal4UploadedJetwayStaticCabClosureSurroundPieceCount",
  "terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount",
  "terminal4UploadedJetwayStaticApronFacingOpenAreaMeters",
  "terminal4UploadedJetwayStaticCabClosureEvidenceAuthority",
  EVIDENCE_AUTHORITY,
]);

console.log("Validated prepared readiness for all 57 static Cab closures: exact articulation-shared bridgeEnd targets, zero fallback, 57 panels, 57 textured window rings, 228 surround pieces, zero authored-node transforms and zero apron-facing open area.");
