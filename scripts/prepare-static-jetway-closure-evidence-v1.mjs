import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const authoredPath = "src/environment/authoredTerminal4Visual.js";
const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";

let readiness = fs.readFileSync(readinessPath, "utf8");
let authored = fs.readFileSync(authoredPath, "utf8");
let trainer = fs.readFileSync(trainerPath, "utf8");

const CAB_CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3";
const CAB_TARGET_AUTHORITY = "placement-bridgeEnd-shared-with-static-articulation-v1";
const STATIC_GATE_COUNT = 57;
const STATIC_SURROUND_PIECE_COUNT = STATIC_GATE_COUNT * 4;
const CAB_CAP_DEPTH_METERS = 1.45;
const EVIDENCE_AUTHORITY = "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1";

function replaceRequired(text, before, after, path, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`${path}: ${label} anchor is missing`);
  return text.replace(before, after);
}

const simpleReadinessImport = `import { installStaticJetwayPortalClosures } from "./staticJetwayPortalClosures.js";`;
const closureOnlyReadinessImport = `import {
  installStaticJetwayPortalClosures,
  STATIC_JETWAY_CAB_CLOSURE_AUTHORITY,
} from "./staticJetwayPortalClosures.js";`;
const completeReadinessImport = `import {
  installStaticJetwayPortalClosures,
  STATIC_JETWAY_CAB_CLOSURE_AUTHORITY,
  STATIC_JETWAY_CAB_TARGET_AUTHORITY,
} from "./staticJetwayPortalClosures.js";`;
if (!readiness.includes(completeReadinessImport)) {
  if (readiness.includes(simpleReadinessImport)) {
    readiness = readiness.replace(simpleReadinessImport, completeReadinessImport);
  } else if (readiness.includes(closureOnlyReadinessImport)) {
    readiness = readiness.replace(closureOnlyReadinessImport, completeReadinessImport);
  } else {
    throw new Error(`${readinessPath}: static Cab closure/target authority import is missing`);
  }
}

const baseReadinessGate = `            || staticPortalClosures.authority !== STATIC_PORTAL_AUTHORITY
            || staticPortalClosures.gateCount !== 57`;
const completeReadinessGate = `            || staticPortalClosures.authority !== STATIC_PORTAL_AUTHORITY
            || staticPortalClosures.gateCount !== ${STATIC_GATE_COUNT}
            || staticPortalClosures.cabClosureAuthority !== STATIC_JETWAY_CAB_CLOSURE_AUTHORITY
            || staticPortalClosures.cabTargetAuthority !== STATIC_JETWAY_CAB_TARGET_AUTHORITY
            || staticPortalClosures.bridgeEndFallbackCount !== 0
            || staticPortalClosures.cabPanelCount !== ${STATIC_GATE_COUNT}
            || staticPortalClosures.cabWindowCount !== ${STATIC_GATE_COUNT}
            || staticPortalClosures.cabSurroundPieceCount !== ${STATIC_SURROUND_PIECE_COUNT}
            || staticPortalClosures.authoredNodeTransformCount !== 0
            || Math.abs(staticPortalClosures.opaqueCabCapDepthMeters - ${CAB_CAP_DEPTH_METERS}) > 1e-6
            || Math.abs(staticPortalClosures.apronFacingOpenAreaMeters) > 1e-9`;
if (!readiness.includes("staticPortalClosures.cabTargetAuthority !== STATIC_JETWAY_CAB_TARGET_AUTHORITY")) {
  readiness = replaceRequired(
    readiness,
    baseReadinessGate,
    completeReadinessGate,
    readinessPath,
    "static Cab closure readiness gate",
  );
}

const publicationAnchor = `          group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority;
          group.userData.uploadedJetwayStaticPortalClosureGateCount = staticPortalClosures.gateCount;`;
const completePublication = `${publicationAnchor}
          group.userData.uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority;
          group.userData.uploadedJetwayStaticCabTargetAuthority = staticPortalClosures.cabTargetAuthority;
          group.userData.uploadedJetwayStaticBridgeEndFallbackCount = staticPortalClosures.bridgeEndFallbackCount;
          group.userData.uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount;
          group.userData.uploadedJetwayStaticCabClosureWindowCount = staticPortalClosures.cabWindowCount;
          group.userData.uploadedJetwayStaticCabClosureSurroundPieceCount = staticPortalClosures.cabSurroundPieceCount;
          group.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticPortalClosures.authoredNodeTransformCount;
          group.userData.uploadedJetwayStaticCabClosureDepthMeters = staticPortalClosures.opaqueCabCapDepthMeters;
          group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = staticPortalClosures.apronFacingOpenAreaMeters;
          group.userData.uploadedJetwayStaticCabClosureEvidenceAuthority = "${EVIDENCE_AUTHORITY}";`;
if (!readiness.includes("uploadedJetwayStaticCabTargetAuthority = staticPortalClosures.cabTargetAuthority")) {
  readiness = replaceRequired(
    readiness,
    publicationAnchor,
    completePublication,
    readinessPath,
    "static Cab closure ready publication",
  );
}

const authoredAnchor = `  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = sourcePlacedJetways.userData.uploadedJetwayA1PartCentersMeters;`;
const authoredPublication = `${authoredAnchor}
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureAuthority = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureAuthority;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabTargetAuthority = sourcePlacedJetways.userData.uploadedJetwayStaticCabTargetAuthority;
  environment.userData.authoredTerminal4UploadedJetwayStaticBridgeEndFallbackCount = sourcePlacedJetways.userData.uploadedJetwayStaticBridgeEndFallbackCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosurePanelCount = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosurePanelCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureWindowCount = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureWindowCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureSurroundPieceCount = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureSurroundPieceCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureDepthMeters = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureDepthMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticApronFacingOpenAreaMeters = sourcePlacedJetways.userData.uploadedJetwayStaticApronFacingOpenAreaMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureEvidenceAuthority = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureEvidenceAuthority;`;
if (!authored.includes("authoredTerminal4UploadedJetwayStaticCabTargetAuthority")) {
  authored = replaceRequired(
    authored,
    authoredAnchor,
    authoredPublication,
    authoredPath,
    "static Cab closure environment publication",
  );
}

const loadingAnchor = `    renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "loading";`;
const loadingPublication = `${loadingAnchor}
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabTargetAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticBridgeEndFallbackCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosurePanelCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureWindowCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureDepthMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority = "loading";`;
if (!trainer.includes("terminal4UploadedJetwayStaticCabTargetAuthority = \"loading\"")) {
  trainer = replaceRequired(
    trainer,
    loadingAnchor,
    loadingPublication,
    trainerPath,
    "static Cab closure loading publication",
  );
}

const readyAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters || "missing";`;
const readyPublication = `${readyAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthority = environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabTargetAuthority = environment.userData.authoredTerminal4UploadedJetwayStaticCabTargetAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticBridgeEndFallbackCount = String(environment.userData.authoredTerminal4UploadedJetwayStaticBridgeEndFallbackCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosurePanelCount = String(environment.userData.authoredTerminal4UploadedJetwayStaticCabClosurePanelCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureWindowCount = String(environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureWindowCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount = String(environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureSurroundPieceCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount = String(environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureDepthMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureDepthMeters)
          ? environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureDepthMeters.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticApronFacingOpenAreaMeters)
          ? environment.userData.authoredTerminal4UploadedJetwayStaticApronFacingOpenAreaMeters.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority = environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureEvidenceAuthority || "missing";`;
if (!trainer.includes("terminal4UploadedJetwayStaticCabTargetAuthority = environment.userData.authoredTerminal4UploadedJetwayStaticCabTargetAuthority")) {
  trainer = replaceRequired(
    trainer,
    readyAnchor,
    readyPublication,
    trainerPath,
    "static Cab closure ready publication",
  );
}

const errorAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "load-error";`;
const errorPublication = `${errorAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabTargetAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticBridgeEndFallbackCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosurePanelCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureWindowCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureDepthMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority = "load-error";`;
if (!trainer.includes("terminal4UploadedJetwayStaticCabTargetAuthority = \"load-error\"")) {
  trainer = replaceRequired(
    trainer,
    errorAnchor,
    errorPublication,
    trainerPath,
    "static Cab closure error publication",
  );
}

for (const [path, text, tokens] of [
  [readinessPath, readiness, [
    "STATIC_JETWAY_CAB_CLOSURE_AUTHORITY",
    "STATIC_JETWAY_CAB_TARGET_AUTHORITY",
    `staticPortalClosures.cabPanelCount !== ${STATIC_GATE_COUNT}`,
    `staticPortalClosures.cabWindowCount !== ${STATIC_GATE_COUNT}`,
    `staticPortalClosures.cabSurroundPieceCount !== ${STATIC_SURROUND_PIECE_COUNT}`,
    "staticPortalClosures.cabTargetAuthority !== STATIC_JETWAY_CAB_TARGET_AUTHORITY",
    "staticPortalClosures.bridgeEndFallbackCount !== 0",
    "staticPortalClosures.authoredNodeTransformCount !== 0",
    "Math.abs(staticPortalClosures.apronFacingOpenAreaMeters) > 1e-9",
    "uploadedJetwayStaticCabTargetAuthority",
    "uploadedJetwayStaticBridgeEndFallbackCount",
    "uploadedJetwayStaticCabClosureEvidenceAuthority",
  ]],
  [authoredPath, authored, [
    "authoredTerminal4UploadedJetwayStaticCabClosureAuthority",
    "authoredTerminal4UploadedJetwayStaticCabTargetAuthority",
    "authoredTerminal4UploadedJetwayStaticBridgeEndFallbackCount",
    "authoredTerminal4UploadedJetwayStaticCabClosurePanelCount",
    "authoredTerminal4UploadedJetwayStaticApronFacingOpenAreaMeters",
    "authoredTerminal4UploadedJetwayStaticCabClosureEvidenceAuthority",
  ]],
  [trainerPath, trainer, [
    "terminal4UploadedJetwayStaticCabClosureAuthority",
    "terminal4UploadedJetwayStaticCabTargetAuthority",
    "terminal4UploadedJetwayStaticBridgeEndFallbackCount",
    "terminal4UploadedJetwayStaticCabClosurePanelCount",
    "terminal4UploadedJetwayStaticCabClosureWindowCount",
    "terminal4UploadedJetwayStaticCabClosureSurroundPieceCount",
    "terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount",
    "terminal4UploadedJetwayStaticCabClosureDepthMeters",
    "terminal4UploadedJetwayStaticApronFacingOpenAreaMeters",
    "terminal4UploadedJetwayStaticCabClosureEvidenceAuthority",
  ]],
]) {
  for (const token of tokens) {
    if (!text.includes(token)) throw new Error(`${path}: static Cab closure evidence is missing ${token}`);
  }
}

fs.writeFileSync(readinessPath, readiness, "utf8");
fs.writeFileSync(authoredPath, authored, "utf8");
fs.writeFileSync(trainerPath, trainer, "utf8");
console.log(`Required and published ${CAB_CLOSURE_AUTHORITY}, ${CAB_TARGET_AUTHORITY}, zero bridgeEnd fallback, 57 panels, 57 opaque windows, 228 surround pieces, zero authored-node transforms, and zero apron-facing open area.`);
