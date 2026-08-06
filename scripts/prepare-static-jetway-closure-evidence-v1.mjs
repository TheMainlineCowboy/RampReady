import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const authoredPath = "src/environment/authoredTerminal4Visual.js";
const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";

let readiness = fs.readFileSync(readinessPath, "utf8");
let authored = fs.readFileSync(authoredPath, "utf8");
let trainer = fs.readFileSync(trainerPath, "utf8");

const CAB_CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3";
const STATIC_GATE_COUNT = 57;
const STATIC_SURROUND_PIECE_COUNT = STATIC_GATE_COUNT * 4;
const CAB_CAP_DEPTH_METERS = 1.45;
const EVIDENCE_AUTHORITY = "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1";

function replaceRequired(text, before, after, path, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`${path}: ${label} anchor is missing`);
  return text.replace(before, after);
}

readiness = replaceRequired(
  readiness,
  `import { installStaticJetwayPortalClosures } from "./staticJetwayPortalClosures.js";`,
  `import {
  installStaticJetwayPortalClosures,
  STATIC_JETWAY_CAB_CLOSURE_AUTHORITY,
} from "./staticJetwayPortalClosures.js";`,
  readinessPath,
  "static Cab closure authority import",
);

readiness = replaceRequired(
  readiness,
  `            || staticPortalClosures.authority !== STATIC_PORTAL_AUTHORITY
            || staticPortalClosures.gateCount !== 57`,
  `            || staticPortalClosures.authority !== STATIC_PORTAL_AUTHORITY
            || staticPortalClosures.gateCount !== ${STATIC_GATE_COUNT}
            || staticPortalClosures.cabClosureAuthority !== STATIC_JETWAY_CAB_CLOSURE_AUTHORITY
            || staticPortalClosures.cabPanelCount !== ${STATIC_GATE_COUNT}
            || staticPortalClosures.cabWindowCount !== ${STATIC_GATE_COUNT}
            || staticPortalClosures.cabSurroundPieceCount !== ${STATIC_SURROUND_PIECE_COUNT}
            || staticPortalClosures.authoredNodeTransformCount !== 0
            || Math.abs(staticPortalClosures.opaqueCabCapDepthMeters - ${CAB_CAP_DEPTH_METERS}) > 1e-6
            || staticPortalClosures.apronFacingOpenAreaMeters !== 0`,
  readinessPath,
  "static Cab closure readiness gate",
);

const publicationAnchor = `          group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority;
          group.userData.uploadedJetwayStaticPortalClosureGateCount = staticPortalClosures.gateCount;`;
readiness = replaceRequired(
  readiness,
  publicationAnchor,
  `${publicationAnchor}
          group.userData.uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority;
          group.userData.uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount;
          group.userData.uploadedJetwayStaticCabClosureWindowCount = staticPortalClosures.cabWindowCount;
          group.userData.uploadedJetwayStaticCabClosureSurroundPieceCount = staticPortalClosures.cabSurroundPieceCount;
          group.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticPortalClosures.authoredNodeTransformCount;
          group.userData.uploadedJetwayStaticCabClosureDepthMeters = staticPortalClosures.opaqueCabCapDepthMeters;
          group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = staticPortalClosures.apronFacingOpenAreaMeters;
          group.userData.uploadedJetwayStaticCabClosureEvidenceAuthority = "${EVIDENCE_AUTHORITY}";`,
  readinessPath,
  "static Cab closure ready publication",
);

const authoredAnchor = `  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = sourcePlacedJetways.userData.uploadedJetwayA1PartCentersMeters;`;
authored = replaceRequired(
  authored,
  authoredAnchor,
  `${authoredAnchor}
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureAuthority = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureAuthority;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosurePanelCount = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosurePanelCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureWindowCount = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureWindowCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureSurroundPieceCount = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureSurroundPieceCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureDepthMeters = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureDepthMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticApronFacingOpenAreaMeters = sourcePlacedJetways.userData.uploadedJetwayStaticApronFacingOpenAreaMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureEvidenceAuthority = sourcePlacedJetways.userData.uploadedJetwayStaticCabClosureEvidenceAuthority;`,
  authoredPath,
  "static Cab closure environment publication",
);

const loadingAnchor = `    renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "loading";`;
trainer = replaceRequired(
  trainer,
  loadingAnchor,
  `${loadingAnchor}
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosurePanelCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureWindowCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureDepthMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority = "loading";`,
  trainerPath,
  "static Cab closure loading publication",
);

const readyAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters || "missing";`;
trainer = replaceRequired(
  trainer,
  readyAnchor,
  `${readyAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthority = environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureAuthority || "missing";
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
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority = environment.userData.authoredTerminal4UploadedJetwayStaticCabClosureEvidenceAuthority || "missing";`,
  trainerPath,
  "static Cab closure ready publication",
);

const errorAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "load-error";`;
trainer = replaceRequired(
  trainer,
  errorAnchor,
  `${errorAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosurePanelCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureWindowCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureDepthMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority = "load-error";`,
  trainerPath,
  "static Cab closure error publication",
);

for (const [path, text, tokens] of [
  [readinessPath, readiness, [
    "STATIC_JETWAY_CAB_CLOSURE_AUTHORITY",
    `staticPortalClosures.cabPanelCount !== ${STATIC_GATE_COUNT}`,
    `staticPortalClosures.cabWindowCount !== ${STATIC_GATE_COUNT}`,
    `staticPortalClosures.cabSurroundPieceCount !== ${STATIC_SURROUND_PIECE_COUNT}`,
    "staticPortalClosures.authoredNodeTransformCount !== 0",
    "staticPortalClosures.apronFacingOpenAreaMeters !== 0",
    "uploadedJetwayStaticCabClosureEvidenceAuthority",
  ]],
  [authoredPath, authored, [
    "authoredTerminal4UploadedJetwayStaticCabClosureAuthority",
    "authoredTerminal4UploadedJetwayStaticCabClosurePanelCount",
    "authoredTerminal4UploadedJetwayStaticApronFacingOpenAreaMeters",
    "authoredTerminal4UploadedJetwayStaticCabClosureEvidenceAuthority",
  ]],
  [trainerPath, trainer, [
    "terminal4UploadedJetwayStaticCabClosureAuthority",
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
console.log("Required and published 57 exact static Cab closure panels, 57 opaque windows, 228 surround pieces, zero authored-node transforms, and zero apron-facing open area at the same bridgeEnd targets used by static articulation.");
