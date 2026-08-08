import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const authoredPath = "src/environment/authoredTerminal4Visual.js";
const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";

let installation = fs.readFileSync(installationPath, "utf8");
let readiness = fs.readFileSync(readinessPath, "utf8");
let authored = fs.readFileSync(authoredPath, "utf8");
let trainer = fs.readFileSync(trainerPath, "utf8");

const VISUAL_AUTHORITY = "same-day-a1-continuous-source-measured-solid-closed-grounded-v2";
const ASSEMBLY_AUTHORITY = "exact-authored-five-part-chain-no-isolated-node-rotation-v2";
const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-source-measured-terminal-vestibule-v15";
const ROTUNDA_OPENING_AUTHORITY = "exact-authored-opposite-rotunda-to-tunnel-a-axis-v5";
const ROTUNDA_CLOSURE_AUTHORITY = "exact-rotunda-surface-small-bellows-joint-v2";
const MIN_VISIBLE_FIXED_LEG_METERS = 0.15;
const MAX_VISIBLE_FIXED_LEG_METERS = 44;

function replaceRequired(text, before, after, path, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`${path}: ${label} anchor is missing`);
  return text.replace(before, after);
}

const reportAnchor = `    connectorRibCount: connector.userData.corrugationRibCount,
    doubleSidedMaterialCount,`;
const reportEvidence = `    connectorRibCount: connector.userData.corrugationRibCount,
    apronFacingRotundaOpeningClosed: connector.userData.apronFacingRotundaOpeningClosed === true,
    rotundaVestibuleClosureAuthority: connector.userData.rotundaVestibuleClosureAuthority || "missing",
    noGeneratedGlassCorridor: connector.userData.noGeneratedGlassCorridor === true,
    visualAcceptanceAuthority: "${VISUAL_AUTHORITY}",
    doubleSidedMaterialCount,`;
installation = replaceRequired(
  installation,
  reportAnchor,
  reportEvidence,
  installationPath,
  "A1 installation report evidence",
);

const groupAnchor = `  group.userData.uploadedJetwayA1ConnectorRibCount = report.connectorRibCount;`;
const groupEvidence = `${groupAnchor}
  group.userData.uploadedJetwayA1ApronFacingRotundaOpeningClosed = report.apronFacingRotundaOpeningClosed;
  group.userData.uploadedJetwayA1RotundaVestibuleClosureAuthority = report.rotundaVestibuleClosureAuthority;
  group.userData.uploadedJetwayA1NoGeneratedGlassCorridor = report.noGeneratedGlassCorridor;
  group.userData.uploadedJetwayA1VisualAcceptanceAuthority = report.visualAcceptanceAuthority;`;
installation = replaceRequired(
  installation,
  groupAnchor,
  groupEvidence,
  installationPath,
  "A1 installation group evidence",
);

const readinessDeclarationAnchor = `          const connectorRibCount = Number(group.userData.uploadedJetwayA1ConnectorRibCount ?? -1);`;
const readinessDeclarations = `${readinessDeclarationAnchor}
          const connectorStyleAuthority = group.userData.uploadedJetwayA1ConnectorStyleAuthority || "missing";
          const rotundaOpeningAuthority = group.userData.uploadedJetwayA1RotundaOpeningAuthority || "missing";
          const apronFacingRotundaOpeningClosed = group.userData.uploadedJetwayA1ApronFacingRotundaOpeningClosed === true;
          const rotundaVestibuleClosureAuthority = group.userData.uploadedJetwayA1RotundaVestibuleClosureAuthority || "missing";
          const noGeneratedGlassCorridor = group.userData.uploadedJetwayA1NoGeneratedGlassCorridor === true;
          const visualAcceptanceAuthority = group.userData.uploadedJetwayA1VisualAcceptanceAuthority || "missing";`;
readiness = replaceRequired(
  readiness,
  readinessDeclarationAnchor,
  readinessDeclarations,
  readinessPath,
  "A1 readiness visual declarations",
);

const sourceMeasuredRange = `connectorVisibleLength > ${MIN_VISIBLE_FIXED_LEG_METERS} && connectorVisibleLength < ${MAX_VISIBLE_FIXED_LEG_METERS}`;
const readinessGatePattern = /            \|\| isolatedNodeRotationCount !== 0\n            \|\| !?\(?connectorVisibleLength[^\n]+\)?\n            \|\| connectorRibCount < \d+/;
const readinessGates = `            || isolatedNodeRotationCount !== 0
            || !(${sourceMeasuredRange})
            || connectorRibCount < 6
            || connectorStyleAuthority !== "${CONNECTOR_STYLE_AUTHORITY}"
            || rotundaOpeningAuthority !== "${ROTUNDA_OPENING_AUTHORITY}"
            || !apronFacingRotundaOpeningClosed
            || rotundaVestibuleClosureAuthority !== "${ROTUNDA_CLOSURE_AUTHORITY}"
            || !noGeneratedGlassCorridor
            || visualAcceptanceAuthority !== "${VISUAL_AUTHORITY}"`;
if (readiness.includes(readinessGates)) {
  // already normalized
} else if (readinessGatePattern.test(readiness)) {
  readiness = readiness.replace(readinessGatePattern, readinessGates);
} else {
  throw new Error(`${readinessPath}: A1 readiness visual gate block is missing`);
}

readiness = readiness.replace(
  "connector=${connectorVisibleLength}/${connectorRibCount}, source=",
  "connector=${connectorVisibleLength}/${connectorRibCount}/${connectorStyleAuthority}/${rotundaOpeningAuthority}/${apronFacingRotundaOpeningClosed}/${rotundaVestibuleClosureAuthority}/${noGeneratedGlassCorridor}/${visualAcceptanceAuthority}, source=",
);

const authoredAnchor = `  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = sourcePlacedJetways.userData.uploadedJetwayA1PartCentersMeters;`;
const authoredEvidence = `${authoredAnchor}
  environment.userData.authoredTerminal4UploadedJetwayA1AssemblyContinuityAuthority = sourcePlacedJetways.userData.uploadedJetwayA1AssemblyContinuityAuthority;
  environment.userData.authoredTerminal4UploadedJetwayA1AssemblyPartCount = sourcePlacedJetways.userData.uploadedJetwayA1AssemblyPartCount;
  environment.userData.authoredTerminal4UploadedJetwayA1AssemblyTransformError = sourcePlacedJetways.userData.uploadedJetwayA1AssemblyTransformError;
  environment.userData.authoredTerminal4UploadedJetwayA1IsolatedNodeRotationCount = sourcePlacedJetways.userData.uploadedJetwayA1IsolatedNodeRotationCount;
  environment.userData.authoredTerminal4UploadedJetwayA1ConnectorStyleAuthority = sourcePlacedJetways.userData.uploadedJetwayA1ConnectorStyleAuthority;
  environment.userData.authoredTerminal4UploadedJetwayA1RotundaOpeningAuthority = sourcePlacedJetways.userData.uploadedJetwayA1RotundaOpeningAuthority;
  environment.userData.authoredTerminal4UploadedJetwayA1VisibleVestibuleLengthMeters = sourcePlacedJetways.userData.uploadedJetwayA1VisibleVestibuleLengthMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1ConnectorRibCount = sourcePlacedJetways.userData.uploadedJetwayA1ConnectorRibCount;
  environment.userData.authoredTerminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed = sourcePlacedJetways.userData.uploadedJetwayA1ApronFacingRotundaOpeningClosed;
  environment.userData.authoredTerminal4UploadedJetwayA1RotundaVestibuleClosureAuthority = sourcePlacedJetways.userData.uploadedJetwayA1RotundaVestibuleClosureAuthority;
  environment.userData.authoredTerminal4UploadedJetwayA1NoGeneratedGlassCorridor = sourcePlacedJetways.userData.uploadedJetwayA1NoGeneratedGlassCorridor;
  environment.userData.authoredTerminal4UploadedJetwayA1VisualAcceptanceAuthority = sourcePlacedJetways.userData.uploadedJetwayA1VisualAcceptanceAuthority;`;
authored = replaceRequired(
  authored,
  authoredAnchor,
  authoredEvidence,
  authoredPath,
  "A1 authored environment visual evidence",
);

const loadingAnchor = `    renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "loading";`;
const loadingEvidence = `${loadingAnchor}
    renderer.domElement.dataset.terminal4UploadedJetwayA1AssemblyContinuityAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1AssemblyPartCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1AssemblyTransformError = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1IsolatedNodeRotationCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1ConnectorStyleAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1RotundaOpeningAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1ConnectorRibCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1RotundaVestibuleClosureAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1NoGeneratedGlassCorridor = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1VisualAcceptanceAuthority = "loading";`;
trainer = replaceRequired(trainer, loadingAnchor, loadingEvidence, trainerPath, "A1 visual loading evidence");

const readyAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters || "missing";`;
const readyEvidence = `${readyAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayA1AssemblyContinuityAuthority = environment.userData.authoredTerminal4UploadedJetwayA1AssemblyContinuityAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1AssemblyPartCount = String(environment.userData.authoredTerminal4UploadedJetwayA1AssemblyPartCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayA1AssemblyTransformError = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1AssemblyTransformError)
          ? environment.userData.authoredTerminal4UploadedJetwayA1AssemblyTransformError.toFixed(12)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1IsolatedNodeRotationCount = String(environment.userData.authoredTerminal4UploadedJetwayA1IsolatedNodeRotationCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayA1ConnectorStyleAuthority = environment.userData.authoredTerminal4UploadedJetwayA1ConnectorStyleAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1RotundaOpeningAuthority = environment.userData.authoredTerminal4UploadedJetwayA1RotundaOpeningAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1VisibleVestibuleLengthMeters)
          ? environment.userData.authoredTerminal4UploadedJetwayA1VisibleVestibuleLengthMeters.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ConnectorRibCount = String(environment.userData.authoredTerminal4UploadedJetwayA1ConnectorRibCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed = String(environment.userData.authoredTerminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed === true);
        renderer.domElement.dataset.terminal4UploadedJetwayA1RotundaVestibuleClosureAuthority = environment.userData.authoredTerminal4UploadedJetwayA1RotundaVestibuleClosureAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1NoGeneratedGlassCorridor = String(environment.userData.authoredTerminal4UploadedJetwayA1NoGeneratedGlassCorridor === true);
        renderer.domElement.dataset.terminal4UploadedJetwayA1VisualAcceptanceAuthority = environment.userData.authoredTerminal4UploadedJetwayA1VisualAcceptanceAuthority || "missing";`;
trainer = replaceRequired(trainer, readyAnchor, readyEvidence, trainerPath, "A1 visual ready evidence");

const errorAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "load-error";`;
const errorEvidence = `${errorAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayA1AssemblyContinuityAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1AssemblyPartCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1AssemblyTransformError = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1IsolatedNodeRotationCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ConnectorStyleAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1RotundaOpeningAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ConnectorRibCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1RotundaVestibuleClosureAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1NoGeneratedGlassCorridor = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1VisualAcceptanceAuthority = "load-error";`;
trainer = replaceRequired(trainer, errorAnchor, errorEvidence, trainerPath, "A1 visual error evidence");

for (const [path, text, tokens] of [
  [installationPath, installation, [
    "apronFacingRotundaOpeningClosed: connector.userData.apronFacingRotundaOpeningClosed === true",
    "uploadedJetwayA1ApronFacingRotundaOpeningClosed",
    `uploadedJetwayA1VisualAcceptanceAuthority = report.visualAcceptanceAuthority`,
  ]],
  [readinessPath, readiness, [
    `connectorStyleAuthority !== "${CONNECTOR_STYLE_AUTHORITY}"`,
    `rotundaOpeningAuthority !== "${ROTUNDA_OPENING_AUTHORITY}"`,
    `rotundaVestibuleClosureAuthority !== "${ROTUNDA_CLOSURE_AUTHORITY}"`,
    `visualAcceptanceAuthority !== "${VISUAL_AUTHORITY}"`,
    `!(${sourceMeasuredRange})`,
    "isolatedNodeRotationCount !== 0",
  ]],
  [authoredPath, authored, [
    "authoredTerminal4UploadedJetwayA1AssemblyContinuityAuthority",
    "authoredTerminal4UploadedJetwayA1VisibleVestibuleLengthMeters",
    "authoredTerminal4UploadedJetwayA1VisualAcceptanceAuthority",
  ]],
  [trainerPath, trainer, [
    "terminal4UploadedJetwayA1AssemblyContinuityAuthority",
    "terminal4UploadedJetwayA1VisibleVestibuleLengthMeters",
    "terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed",
    "terminal4UploadedJetwayA1NoGeneratedGlassCorridor",
    "terminal4UploadedJetwayA1VisualAcceptanceAuthority",
  ]],
]) {
  for (const token of tokens) {
    if (!text.includes(token)) throw new Error(`${path}: A1 visual acceptance evidence is missing ${token}`);
  }
}

for (const forbidden of [
  "Math.abs(connectorVisibleLength - 2.4)",
  "VISIBLE_VESTIBULE_METERS = 2.4",
  "same-day-a1-photo-visible-solid-terminal-vestibule-v12",
  "same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1",
  "no generated long corridor",
]) {
  if (readiness.includes(forbidden) || installation.includes(forbidden)) {
    throw new Error(`A1 visual acceptance still contains retired compact geometry: ${forbidden}`);
  }
}

fs.writeFileSync(installationPath, installation, "utf8");
fs.writeFileSync(readinessPath, readiness, "utf8");
fs.writeFileSync(authoredPath, authored, "utf8");
fs.writeFileSync(trainerPath, trainer, "utf8");
console.log("Published fail-closed A1 visual evidence for one continuous five-part authored assembly, a source-measured solid Terminal 4 fixed leg, connected exact-Rotunda seam, zero isolated node rotations, and no generated glass corridor.");
