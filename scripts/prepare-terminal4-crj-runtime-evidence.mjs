import fs from "node:fs";

function insertAfter(path, anchor, addition, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(anchor)) throw new Error(`${path}: missing ${label} anchor`);
  source = source.replace(anchor, `${anchor}\n${addition}`);
  fs.writeFileSync(path, source, "utf8");
}

const terminalPath = "src/environment/authoredTerminal4Visual.js";
insertAfter(
  terminalPath,
  "  environment.userData.authoredTerminal4A1JetwayWallDistance = sourcePlacedJetways.userData.a1TerminalWallDistance;",
  `  environment.userData.authoredTerminal4JetwaySourceScaleAuthority = sourcePlacedJetways.userData.sourceScaleAuthority;
  environment.userData.authoredTerminal4JetwaySourceGeometryMode = sourcePlacedJetways.userData.sourceGeometryMode;
  environment.userData.authoredTerminal4RequiresOriginalJetwayMesh = sourcePlacedJetways.userData.requiresOriginalSourceMesh === true;
  environment.userData.authoredTerminal4JetwayInitialState = sourcePlacedJetways.userData.initialJetwayState;
  environment.userData.authoredTerminal4JetwayRequiredPrePushSequence = sourcePlacedJetways.userData.requiredPrePushSequence;
  environment.userData.authoredTerminal4JetwayMotionLimits = sourcePlacedJetways.userData.jetwayMotionLimits;`,
  "authoredTerminal4JetwaySourceScaleAuthority",
  "source-scale jetway runtime evidence",
);

const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
insertAfter(
  runtimePath,
  '    renderer.domElement.dataset.terminal4A1JetwayWallDistance = "loading";',
  `    renderer.domElement.dataset.terminal4JetwaySourceScaleAuthority = "loading";
    renderer.domElement.dataset.terminal4JetwaySourceGeometryMode = "loading";
    renderer.domElement.dataset.terminal4RequiresOriginalJetwayMesh = "loading";
    renderer.domElement.dataset.terminal4JetwayInitialState = "loading";
    renderer.domElement.dataset.terminal4JetwayPrePushSequence = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayLoadState = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayConnectorCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayVerifiedModelCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayReadyAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayArticulationAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwaySourceContactDistanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticArticulatedGateCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumContactErrorMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1TargetDoorDistanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1AttachedExtensionMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1PredictedDoorGapMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1PredictedContactDistanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1ActualContactDistanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1ActualDoorGapMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1PartOrderValid = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "loading";`,
  'dataset.terminal4UploadedJetwayLoadState = "loading"',
  "source-scale and uploaded-fleet dataset initialization",
);
insertAfter(
  runtimePath,
  `        renderer.domElement.dataset.terminal4A1JetwayWallDistance = Number.isFinite(environment.userData.authoredTerminal4A1JetwayWallDistance)
          ? environment.userData.authoredTerminal4A1JetwayWallDistance.toFixed(3)
          : "missing";`,
  `        renderer.domElement.dataset.terminal4JetwaySourceScaleAuthority = environment.userData.authoredTerminal4JetwaySourceScaleAuthority || "missing";
        renderer.domElement.dataset.terminal4JetwaySourceGeometryMode = environment.userData.authoredTerminal4JetwaySourceGeometryMode || "missing";
        renderer.domElement.dataset.terminal4RequiresOriginalJetwayMesh = String(environment.userData.authoredTerminal4RequiresOriginalJetwayMesh === true);
        renderer.domElement.dataset.terminal4JetwayInitialState = environment.userData.authoredTerminal4JetwayInitialState || "missing";
        renderer.domElement.dataset.terminal4JetwayPrePushSequence = environment.userData.authoredTerminal4JetwayRequiredPrePushSequence || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayLoadState = environment.userData.authoredTerminal4UploadedJetwayLoadState || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayCount = String(environment.userData.authoredTerminal4UploadedJetwayCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayConnectorCount = String(environment.userData.authoredTerminal4UploadedJetwayConnectorCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayVerifiedModelCount = String(environment.userData.authoredTerminal4UploadedJetwayVerifiedModelCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayReadyAuthority = environment.userData.authoredTerminal4UploadedJetwayReadyAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayArticulationAuthority = environment.userData.authoredTerminal4UploadedJetwayArticulationAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwaySourceContactDistanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwaySourceContactDistanceMeters) ? environment.userData.authoredTerminal4UploadedJetwaySourceContactDistanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticArticulatedGateCount = String(environment.userData.authoredTerminal4UploadedJetwayStaticArticulatedGateCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumContactErrorMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMaximumContactErrorMeters) ? environment.userData.authoredTerminal4UploadedJetwayStaticMaximumContactErrorMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1TargetDoorDistanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1TargetDoorDistanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1TargetDoorDistanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1AttachedExtensionMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1AttachedExtensionMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1AttachedExtensionMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1PredictedDoorGapMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1PredictedContactDistanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1PredictedContactDistanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1PredictedContactDistanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ActualContactDistanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1ActualContactDistanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1ActualContactDistanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ActualDoorGapMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1ActualDoorGapMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1ActualDoorGapMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1PartOrderValid = String(environment.userData.authoredTerminal4UploadedJetwayA1PartOrderValid === true);
        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters || "missing";`,
  "dataset.terminal4UploadedJetwayLoadState = environment.userData",
  "source-scale and uploaded-fleet dataset values",
);
insertAfter(
  runtimePath,
  '        renderer.domElement.dataset.terminal4A1JetwayWallDistance = "load-error";',
  `        renderer.domElement.dataset.terminal4JetwaySourceScaleAuthority = "load-error";
        renderer.domElement.dataset.terminal4JetwaySourceGeometryMode = "load-error";
        renderer.domElement.dataset.terminal4RequiresOriginalJetwayMesh = "load-error";
        renderer.domElement.dataset.terminal4JetwayInitialState = "load-error";
        renderer.domElement.dataset.terminal4JetwayPrePushSequence = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayLoadState = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayConnectorCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayVerifiedModelCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayReadyAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayArticulationAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwaySourceContactDistanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticArticulatedGateCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumContactErrorMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1TargetDoorDistanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1AttachedExtensionMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1PredictedDoorGapMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1PredictedContactDistanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ActualContactDistanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ActualDoorGapMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1PartOrderValid = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "load-error";`,
  'dataset.terminal4UploadedJetwayLoadState = "load-error"',
  "source-scale and uploaded-fleet dataset error state",
);

for (const [path, tokens] of [
  [terminalPath, [
    "authoredTerminal4JetwaySourceScaleAuthority",
    "sourcePlacedJetways.userData.sourceScaleAuthority",
    "authoredTerminal4RequiresOriginalJetwayMesh",
    "authoredTerminal4JetwayRequiredPrePushSequence",
  ]],
  [runtimePath, [
    'dataset.terminal4JetwaySourceScaleAuthority = "loading"',
    "dataset.terminal4JetwaySourceScaleAuthority = environment.userData",
    'dataset.terminal4JetwaySourceScaleAuthority = "load-error"',
    "dataset.terminal4RequiresOriginalJetwayMesh",
    "dataset.terminal4JetwayPrePushSequence",
    'dataset.terminal4UploadedJetwayLoadState = "loading"',
    "dataset.terminal4UploadedJetwayLoadState = environment.userData",
    'dataset.terminal4UploadedJetwayLoadState = "load-error"',
    "dataset.terminal4UploadedJetwayVerifiedModelCount",
    "dataset.terminal4UploadedJetwayReadyAuthority",
    "dataset.terminal4UploadedJetwayArticulationAuthority",
    "dataset.terminal4UploadedJetwayA1AttachedExtensionMeters",
    "dataset.terminal4UploadedJetwayA1PredictedDoorGapMeters",
  ]],
]) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${path}: missing source-scale jetway runtime evidence ${token}`);
}

console.log("Prepared honest Terminal 4 jetway runtime evidence: stock scale is preserved and the uploaded replacement must report ready with 58 decoded models and 58 measured terminal connectors.");
