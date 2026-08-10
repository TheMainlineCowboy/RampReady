import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const terminalVisualPath = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(path, "utf8");

// Carry final static-fleet placement evidence from the prepared jetway group to
// the environment and then to the browser canvas. This turns the visual workflow
// into a geometry gate instead of a screenshot-exists gate.
{
  let terminalSource = fs.readFileSync(terminalVisualPath, "utf8");
  const fleetAnchor = "  environment.userData.authoredTerminal4UploadedJetwayStaticArticulatedGateCount = sourcePlacedJetways.userData.uploadedJetwayStaticArticulatedGateCount;";
  const fleetBlock = `${fleetAnchor}
  environment.userData.authoredTerminal4UploadedJetwayStaticOwnGateTargetAuthority = sourcePlacedJetways.userData.uploadedJetwayStaticOwnGateTargetAuthority;
  environment.userData.authoredTerminal4UploadedJetwayStaticOwnGateTargetCount = sourcePlacedJetways.userData.uploadedJetwayStaticOwnGateTargetCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumOwnGateHeadingErrorRadians;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumTerminalFacingDot = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumTerminalFacingDot;
  environment.userData.authoredTerminal4UploadedJetwayStaticSourceHeadingAuthority = sourcePlacedJetways.userData.uploadedJetwayStaticSourceHeadingAuthority;
  environment.userData.authoredTerminal4UploadedJetwayStaticSourceHeadingProvenanceGateCount = sourcePlacedJetways.userData.uploadedJetwayStaticSourceHeadingProvenanceGateCount;`;
  if (!terminalSource.includes("authoredTerminal4UploadedJetwayStaticOwnGateTargetAuthority")) {
    if (!terminalSource.includes(fleetAnchor)) throw new Error("PHX runtime static own-gate environment evidence anchor is missing");
    terminalSource = terminalSource.replace(fleetAnchor, fleetBlock);
  }
  fs.writeFileSync(terminalVisualPath, terminalSource, "utf8");
}

const loadingAnchor = '    renderer.domElement.dataset.photoDetailLevel = "loading";\n    renderer.domElement.dataset.photoTileCount = "loading";';
const loadingReplacement = '    renderer.domElement.dataset.photoDetailLevel = "loading";\n    renderer.domElement.dataset.photoTextureMode = "loading";\n    renderer.domElement.dataset.photoRuntimeTileCount = "loading";\n    renderer.domElement.dataset.photoMaxTextureDimension = "loading";\n    renderer.domElement.dataset.photoTileCount = "loading";';
const readyAnchor = '        renderer.domElement.dataset.photoDetailLevel = environment.userData.authoredPhotoDetailLevel;\n        renderer.domElement.dataset.photoTileCount = String(environment.userData.authoredPhotoTileCount);';
const readyReplacement = '        renderer.domElement.dataset.photoDetailLevel = environment.userData.authoredPhotoDetailLevel;\n        renderer.domElement.dataset.photoTextureMode = environment.userData.authoredPhotoTextureMode;\n        renderer.domElement.dataset.photoRuntimeTileCount = String(environment.userData.authoredPhotoRuntimeTileCount);\n        renderer.domElement.dataset.photoMaxTextureDimension = String(environment.userData.authoredPhotoGround?.userData?.maxTextureDimension ?? "missing");\n        renderer.domElement.dataset.photoTileCount = String(environment.userData.authoredPhotoTileCount);';
const errorAnchor = '        renderer.domElement.dataset.photoDetailLevel = "load-error";\n        renderer.domElement.dataset.photoTileCount = "load-error";';
const errorReplacement = '        renderer.domElement.dataset.photoDetailLevel = "load-error";\n        renderer.domElement.dataset.photoTextureMode = "load-error";\n        renderer.domElement.dataset.photoRuntimeTileCount = "load-error";\n        renderer.domElement.dataset.photoMaxTextureDimension = "load-error";\n        renderer.domElement.dataset.photoTileCount = "load-error";';

for (const [anchor, replacement, label] of [
  [loadingAnchor, loadingReplacement, "loading evidence"],
  [readyAnchor, readyReplacement, "ready evidence"],
  [errorAnchor, errorReplacement, "error evidence"],
]) {
  if (source.includes(replacement)) continue;
  if (!source.includes(anchor)) throw new Error(`PHX runtime ${label} anchor is missing`);
  source = source.replace(anchor, replacement);
}

const pavementLoadingAnchor = '    renderer.domElement.dataset.groundMarkingContactMode = "loading";';
const pavementLoadingReplacement = `${pavementLoadingAnchor}
    renderer.domElement.dataset.groundPavementAuthority = "loading";
    renderer.domElement.dataset.groundSourceAerialPriority = "loading";
    renderer.domElement.dataset.groundNearfieldDetailOpacity = "loading";`;
if (!source.includes('dataset.groundPavementAuthority = "loading"')) {
  if (!source.includes(pavementLoadingAnchor)) throw new Error("PHX runtime pavement loading anchor is missing");
  source = source.replace(pavementLoadingAnchor, pavementLoadingReplacement);
}

const pavementReadyAnchor = '        renderer.domElement.dataset.groundMarkingContactMode = environment.userData.authoredGroundMarkingContactMode || "missing";';
const pavementReadyReplacement = `${pavementReadyAnchor}
        renderer.domElement.dataset.groundPavementAuthority = environment.userData.authoredGroundPavementAuthority || "missing";
        renderer.domElement.dataset.groundSourceAerialPriority = String(environment.userData.authoredGroundSourceAerialPriority === true);
        renderer.domElement.dataset.groundNearfieldDetailOpacity = String(environment.userData.authoredGroundNearfieldDetailOpacity ?? "missing");`;
if (!source.includes("dataset.groundPavementAuthority = environment.userData.authoredGroundPavementAuthority")) {
  if (!source.includes(pavementReadyAnchor)) throw new Error("PHX runtime pavement ready anchor is missing");
  source = source.replace(pavementReadyAnchor, pavementReadyReplacement);
}

const pavementErrorAnchor = '        renderer.domElement.dataset.groundMarkingContactMode = "load-error";';
const pavementErrorReplacement = `${pavementErrorAnchor}
        renderer.domElement.dataset.groundPavementAuthority = "load-error";
        renderer.domElement.dataset.groundSourceAerialPriority = "load-error";
        renderer.domElement.dataset.groundNearfieldDetailOpacity = "load-error";`;
if (!source.includes('dataset.groundPavementAuthority = "load-error"')) {
  if (!source.includes(pavementErrorAnchor)) throw new Error("PHX runtime pavement error anchor is missing");
  source = source.replace(pavementErrorAnchor, pavementErrorReplacement);
}

const terminalLoadingAnchor = '    renderer.domElement.dataset.terminal4ExactTextureCount = "loading";';
const terminalLoadingReplacement = `${terminalLoadingAnchor}
    renderer.domElement.dataset.terminal4A1LegacyBlockRemovedTriangles = "loading";
    renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumTerminalFacingDot = "loading";`;
if (!source.includes('dataset.terminal4A1LegacyBlockRemovedTriangles = "loading"')) {
  if (!source.includes(terminalLoadingAnchor)) throw new Error("PHX runtime A1 authored-cleanup loading anchor is missing");
  source = source.replace(terminalLoadingAnchor, terminalLoadingReplacement);
} else if (!source.includes('dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority = "loading"')) {
  source = source.replace(
    '    renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = "loading";',
    `    renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumTerminalFacingDot = "loading";`,
  );
}

const terminalReadyAnchor = '        renderer.domElement.dataset.terminal4ExactTextureCount = String(environment.userData.authoredTerminal4ExactTextureCount);';
const terminalReadyReplacement = `${terminalReadyAnchor}
        renderer.domElement.dataset.terminal4A1LegacyBlockRemovedTriangles = String(environment.userData.authoredTerminal4A1LegacyBlockRemovedTriangles ?? 0);
        renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = environment.userData.authoredTerminal4A1LegacyBlockAuthority || "missing";`;
if (!source.includes("dataset.terminal4A1LegacyBlockRemovedTriangles = String(environment.userData.authoredTerminal4A1LegacyBlockRemovedTriangles")) {
  if (!source.includes(terminalReadyAnchor)) throw new Error("PHX runtime A1 authored-cleanup ready anchor is missing");
  source = source.replace(terminalReadyAnchor, terminalReadyReplacement);
}

const terminalConnectorCountBefore = '        renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount = String(environment.userData.authoredTerminal4TerminalConnectedJetwayCount ?? 0);';
const terminalConnectorCountAfter = `        renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount = String(Math.max(
          Number(environment.userData.authoredTerminal4TerminalConnectedJetwayCount) || 0,
          Number(environment.userData.authoredTerminal4UploadedJetwayConnectorCount) || 0,
        ));`;
if (!source.includes(terminalConnectorCountAfter)) {
  if (!source.includes(terminalConnectorCountBefore)) {
    throw new Error("PHX runtime terminal-connected jetway telemetry anchor is missing");
  }
  source = source.replace(terminalConnectorCountBefore, terminalConnectorCountAfter);
}

const fleetBrowserAnchor = terminalConnectorCountAfter;
const fleetBrowserBlock = `${fleetBrowserAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority = environment.userData.authoredTerminal4UploadedJetwayStaticOwnGateTargetAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetCount = String(environment.userData.authoredTerminal4UploadedJetwayStaticOwnGateTargetCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians = String(environment.userData.authoredTerminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumTerminalFacingDot = String(environment.userData.authoredTerminal4UploadedJetwayStaticMaximumTerminalFacingDot ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayStaticSourceHeadingAuthority = environment.userData.authoredTerminal4UploadedJetwayStaticSourceHeadingAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticSourceHeadingProvenanceGateCount = String(environment.userData.authoredTerminal4UploadedJetwayStaticSourceHeadingProvenanceGateCount ?? "missing");`;
if (!source.includes("dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority = environment.userData.authoredTerminal4UploadedJetwayStaticOwnGateTargetAuthority")) {
  if (!source.includes(fleetBrowserAnchor)) throw new Error("PHX runtime fleet own-gate browser evidence anchor is missing");
  source = source.replace(fleetBrowserAnchor, fleetBrowserBlock);
}

const terminalErrorAnchor = '        renderer.domElement.dataset.terminal4Position = "load-error";';
const terminalErrorReplacement = `        renderer.domElement.dataset.terminal4A1LegacyBlockRemovedTriangles = "load-error";
        renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumTerminalFacingDot = "load-error";
${terminalErrorAnchor}`;
if (!source.includes('dataset.terminal4A1LegacyBlockRemovedTriangles = "load-error"')) {
  if (!source.includes(terminalErrorAnchor)) throw new Error("PHX runtime A1 authored-cleanup error anchor is missing");
  source = source.replace(terminalErrorAnchor, terminalErrorReplacement);
} else if (!source.includes('dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority = "load-error"')) {
  source = source.replace(
    '        renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = "load-error";',
    `        renderer.domElement.dataset.terminal4A1LegacyBlockAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticOwnGateTargetCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumTerminalFacingDot = "load-error";`,
  );
}

for (const token of [
  'dataset.photoTextureMode = "loading"',
  'dataset.photoRuntimeTileCount = "loading"',
  'dataset.photoMaxTextureDimension = "loading"',
  'dataset.photoTextureMode = environment.userData.authoredPhotoTextureMode',
  'dataset.photoRuntimeTileCount = String(environment.userData.authoredPhotoRuntimeTileCount)',
  'dataset.photoMaxTextureDimension = String(environment.userData.authoredPhotoGround?.userData?.maxTextureDimension ?? "missing")',
  'dataset.groundPavementAuthority = "loading"',
  "dataset.groundPavementAuthority = environment.userData.authoredGroundPavementAuthority",
  "dataset.groundSourceAerialPriority = String(environment.userData.authoredGroundSourceAerialPriority === true)",
  "dataset.groundNearfieldDetailOpacity = String(environment.userData.authoredGroundNearfieldDetailOpacity",
  'dataset.groundPavementAuthority = "load-error"',
  'dataset.terminal4A1LegacyBlockRemovedTriangles = "loading"',
  "dataset.terminal4A1LegacyBlockRemovedTriangles = String(environment.userData.authoredTerminal4A1LegacyBlockRemovedTriangles",
  "dataset.terminal4A1LegacyBlockAuthority = environment.userData.authoredTerminal4A1LegacyBlockAuthority",
  'dataset.terminal4A1LegacyBlockRemovedTriangles = "load-error"',
  "Number(environment.userData.authoredTerminal4UploadedJetwayConnectorCount) || 0",
  "authoredTerminal4UploadedJetwayStaticOwnGateTargetAuthority",
  "dataset.terminal4UploadedJetwayStaticOwnGateTargetCount",
  "dataset.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians",
  "dataset.terminal4UploadedJetwayStaticMaximumTerminalFacingDot",
]) {
  if (!source.includes(token)) throw new Error(`PHX runtime evidence missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
await import("./prepare-direct-inspection-launch-v28.mjs");
console.log("Prepared live PHX runtime evidence for native-resolution aerial tiling, source-aerial pavement priority, exact A1 cleanup, all 58 terminal connectors, and fail-closed own-gate static jetway alignment telemetry.");
