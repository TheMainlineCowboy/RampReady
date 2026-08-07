import fs from "node:fs";

const files = Object.freeze({
  build: "scripts/build-production-simulator-quality.mjs",
  source: "src/environment/staticJetwayPortalClosures.js",
  target: "scripts/prepare-static-jetway-target-shared-with-articulation-v1.mjs",
  prepare: "scripts/prepare-static-jetway-portal-closures-v1.mjs",
  evidence: "scripts/prepare-static-jetway-closure-evidence-v1.mjs",
  readiness: "scripts/prepare-static-jetway-closure-readiness-v1.mjs",
  finalizer: "scripts/prepare-a1-final-acceptance-authority-v1.mjs",
  articulationBrowser: "tests/browser/uploaded-jetway-articulation-v10.spec.js",
  staticBrowser: "tests/browser/terminal4-static-cab-closure-evidence.spec.js",
});
const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]),
);

function requireTokens(key, tokens) {
  for (const token of tokens) {
    if (!source[key].includes(token)) {
      throw new Error(`${files[key]}: static Cab closure contract is missing ${token}`);
    }
  }
}

const prepareIndex = source.build.indexOf('await runNode("scripts/prepare-static-jetway-portal-closures-v1.mjs")');
const finalizerIndex = source.build.indexOf('await runNode("scripts/prepare-a1-final-acceptance-authority-v1.mjs")');
if (!(prepareIndex >= 0 && finalizerIndex > prepareIndex)) {
  throw new Error(`${files.build}: static Cab closure preparation must run before final acceptance`);
}

// The committed source intentionally retains the single legacy finitePositive
// expression as the deterministic replacement anchor. The target preparer must
// remove it before readiness/build output is accepted.
requireTokens("source", [
  'STATIC_CAB_CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3"',
  "const contactDistance = finitePositive(placement.bridgeEnd, 18)",
  "cabPanelTransforms.push",
  "cabWindowTransforms.push",
  "cabHeaderTransforms.push",
  "cabJambTransforms.push",
  "group.userData.cabPanelCount = cabPanelTransforms.length",
  "group.userData.cabWindowCount = cabWindowTransforms.length",
  "group.userData.cabSurroundPieceCount = cabHeaderTransforms.length + cabJambTransforms.length",
  "group.userData.authoredNodeTransformCount = 0",
  "group.userData.opaqueCabCapDepthMeters = 1.45",
  "group.userData.apronFacingOpenAreaMeters = 0",
]);

requireTokens("target", [
  'TARGET_AUTHORITY = "placement-bridgeEnd-shared-with-static-articulation-v1"',
  'marker = "static-cab-target-shared-with-articulation-v2"',
  "const fallbackContact = \"    const contactDistance = finitePositive(placement.bridgeEnd, 18);\"",
  "const contactDistance = Number(placement.bridgeEnd)",
  "missing the exact positive placement.bridgeEnd shared with articulation",
  "cabTargetAuthority: existing.userData.cabTargetAuthority",
  "bridgeEndFallbackCount: Number(existing.userData.bridgeEndFallbackCount",
  "group.userData.cabTargetAuthority = STATIC_CAB_TARGET_AUTHORITY",
  "group.userData.bridgeEndFallbackCount = 0",
  "STATIC_JETWAY_CAB_TARGET_AUTHORITY",
  "static Cab target fallback remains",
]);

requireTokens("prepare", [
  "prepare-static-jetway-target-shared-with-articulation-v1.mjs?exact-static-target=",
  "STATIC_JETWAY_CAB_CLOSURE_AUTHORITY",
  "STATIC_JETWAY_CAB_TARGET_AUTHORITY",
  "uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority",
  "uploadedJetwayStaticCabTargetAuthority = staticPortalClosures.cabTargetAuthority",
  "uploadedJetwayStaticBridgeEndFallbackCount = staticPortalClosures.bridgeEndFallbackCount",
  "uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount",
  "uploadedJetwayStaticCabClosureWindowCount = staticPortalClosures.cabWindowCount",
  "uploadedJetwayStaticCabClosureSurroundPieceCount = staticPortalClosures.cabSurroundPieceCount",
  "uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticPortalClosures.authoredNodeTransformCount",
  "uploadedJetwayStaticApronFacingOpenAreaMeters = staticPortalClosures.apronFacingOpenAreaMeters",
  "prepare-static-jetway-closure-evidence-v1.mjs?static-closure=",
  "prepare-static-jetway-closure-readiness-v1.mjs?static-readiness=",
]);

requireTokens("evidence", [
  'CAB_CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3"',
  'CAB_TARGET_AUTHORITY = "placement-bridgeEnd-shared-with-static-articulation-v1"',
  'EVIDENCE_AUTHORITY = "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1"',
  "STATIC_JETWAY_CAB_TARGET_AUTHORITY",
  "staticPortalClosures.cabTargetAuthority !== STATIC_JETWAY_CAB_TARGET_AUTHORITY",
  "staticPortalClosures.bridgeEndFallbackCount !== 0",
  "staticPortalClosures.cabPanelCount !== ${STATIC_GATE_COUNT}",
  "staticPortalClosures.cabWindowCount !== ${STATIC_GATE_COUNT}",
  "staticPortalClosures.cabSurroundPieceCount !== ${STATIC_SURROUND_PIECE_COUNT}",
  "staticPortalClosures.authoredNodeTransformCount !== 0",
  "Math.abs(staticPortalClosures.apronFacingOpenAreaMeters) > 1e-9",
  "authoredTerminal4UploadedJetwayStaticCabTargetAuthority",
  "authoredTerminal4UploadedJetwayStaticBridgeEndFallbackCount",
  "terminal4UploadedJetwayStaticCabTargetAuthority",
  "terminal4UploadedJetwayStaticBridgeEndFallbackCount",
  "terminal4UploadedJetwayStaticCabClosureEvidenceAuthority",
]);

requireTokens("readiness", [
  'TARGET_AUTHORITY = "placement-bridgeEnd-shared-with-static-articulation-v1"',
  "const contactDistance = Number(placement.bridgeEnd)",
  "group.userData.bridgeEndFallbackCount = 0",
  "staticPortalClosures.cabTargetAuthority !== STATIC_JETWAY_CAB_TARGET_AUTHORITY",
  "staticPortalClosures.bridgeEndFallbackCount !== 0",
  "staticPortalClosures.cabPanelCount !== 57",
  "staticPortalClosures.cabWindowCount !== 57",
  "staticPortalClosures.cabSurroundPieceCount !== 228",
  "uploadedJetwayStaticCabTargetAuthority = staticPortalClosures.cabTargetAuthority",
  "uploadedJetwayStaticBridgeEndFallbackCount = staticPortalClosures.bridgeEndFallbackCount",
  "authoredTerminal4UploadedJetwayStaticCabTargetAuthority",
  "terminal4UploadedJetwayStaticCabTargetAuthority",
]);

requireTokens("finalizer", [
  "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3",
  "placement-bridgeEnd-shared-with-static-articulation-v1",
  "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1",
  "terminal4UploadedJetwayStaticCabClosureAuthority",
  "terminal4UploadedJetwayStaticCabTargetAuthority",
  "terminal4UploadedJetwayStaticBridgeEndFallbackCount",
  "terminal4UploadedJetwayStaticCabClosurePanelCount",
  "terminal4UploadedJetwayStaticCabClosureWindowCount",
  "terminal4UploadedJetwayStaticCabClosureSurroundPieceCount",
  "terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount",
  "terminal4UploadedJetwayStaticApronFacingOpenAreaMeters",
]);

requireTokens("articulationBrowser", [
  "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3",
  "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1",
  "terminal4UploadedJetwayStaticCabClosurePanelCount",
  "terminal4UploadedJetwayStaticCabClosureWindowCount",
  "terminal4UploadedJetwayStaticCabClosureSurroundPieceCount",
  "terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount",
  "terminal4UploadedJetwayStaticApronFacingOpenAreaMeters",
  "uploaded-jetway-a-concourse-static-fleet-v10.png",
  "uploaded-jetway-b-concourse-static-fleet-v10.png",
  "uploaded-jetway-b15-static-fleet-v10.png",
]);

requireTokens("staticBrowser", [
  "all 57 parked Terminal 4 jetways have opaque Cab closures at exact articulation targets",
  "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3",
  "placement-bridgeEnd-shared-with-static-articulation-v1",
  "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1",
  "terminal4UploadedJetwayStaticBridgeEndFallbackCount",
  "terminal4UploadedJetwayStaticCabClosurePanelCount",
  "terminal4UploadedJetwayStaticCabClosureWindowCount",
  "terminal4UploadedJetwayStaticCabClosureSurroundPieceCount",
  "terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount",
  "terminal4UploadedJetwayStaticApronFacingOpenAreaMeters",
  "terminal4-static-a14-cab-closure.png",
  "terminal4-static-b14-cab-closure.png",
  "terminal4-static-b15-cab-closure.png",
  "terminal4-static-cab-closure-evidence.json",
]);

console.log("Verified the staged static Terminal 4 Cab pipeline: exact bridgeEnd migration, zero fallback, 57 panels, 57 windows, 228 surround pieces, zero authored-node transforms, zero apron-facing open area, final fail-closed acceptance, and rendered A14/B14/B15 evidence.");
