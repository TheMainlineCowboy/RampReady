import fs from "node:fs";

function insertAfter(path, anchor, addition, marker) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(anchor)) throw new Error(`${path}: missing full-3D evidence anchor ${anchor}`);
  source = source.replace(anchor, `${anchor}\n${addition}`);
  fs.writeFileSync(path, source, "utf8");
}

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
insertAfter(
  path,
  '    renderer.domElement.dataset.terminal4A1JetwayWallDistance = "loading";',
  `    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumCabHeightErrorMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMinimumStairGroundClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumStairGroundClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMinimumBogieGroundClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumBogieGroundClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticPartOrderValid = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1CabNormalErrorDegrees = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1CabHeightErrorMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1StairGroundClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1BogieGroundClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1AnchorYawDegrees = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1CabYawOffsetDegrees = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1ActualContactPoint = "loading";`,
  'dataset.terminal4UploadedJetwayA1CabNormalErrorDegrees = "loading"',
);
insertAfter(
  path,
  `        renderer.domElement.dataset.terminal4A1JetwayWallDistance = Number.isFinite(environment.userData.authoredTerminal4A1JetwayWallDistance)
          ? environment.userData.authoredTerminal4A1JetwayWallDistance.toFixed(3)
          : "missing";`,
  `        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees) ? environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumCabHeightErrorMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabHeightErrorMeters) ? environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabHeightErrorMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMinimumStairGroundClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMinimumStairGroundClearanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayStaticMinimumStairGroundClearanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumStairGroundClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMaximumStairGroundClearanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayStaticMaximumStairGroundClearanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMinimumBogieGroundClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMinimumBogieGroundClearanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayStaticMinimumBogieGroundClearanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumBogieGroundClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMaximumBogieGroundClearanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayStaticMaximumBogieGroundClearanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticPartOrderValid = String(environment.userData.authoredTerminal4UploadedJetwayStaticPartOrderValid === true);
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabNormalErrorDegrees = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1CabNormalErrorDegrees) ? environment.userData.authoredTerminal4UploadedJetwayA1CabNormalErrorDegrees.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabHeightErrorMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1CabHeightErrorMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1CabHeightErrorMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1StairGroundClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1StairGroundClearanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1StairGroundClearanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1BogieGroundClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1BogieGroundClearanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1BogieGroundClearanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1AnchorYawDegrees = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1AnchorYawDegrees) ? environment.userData.authoredTerminal4UploadedJetwayA1AnchorYawDegrees.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabYawOffsetDegrees = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1CabYawOffsetDegrees) ? environment.userData.authoredTerminal4UploadedJetwayA1CabYawOffsetDegrees.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ActualContactPoint = environment.userData.authoredTerminal4UploadedJetwayA1ActualContactPoint || "missing";`,
  "dataset.terminal4UploadedJetwayA1CabNormalErrorDegrees = Number.isFinite",
);
insertAfter(
  path,
  '        renderer.domElement.dataset.terminal4A1JetwayWallDistance = "load-error";',
  `        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumCabHeightErrorMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMinimumStairGroundClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumStairGroundClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMinimumBogieGroundClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumBogieGroundClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticPartOrderValid = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabNormalErrorDegrees = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabHeightErrorMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1StairGroundClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1BogieGroundClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1AnchorYawDegrees = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabYawOffsetDegrees = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1ActualContactPoint = "load-error";`,
  'dataset.terminal4UploadedJetwayA1CabNormalErrorDegrees = "load-error"',
);

const source = fs.readFileSync(path, "utf8");
for (const token of [
  "dataset.terminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees",
  "dataset.terminal4UploadedJetwayA1CabNormalErrorDegrees",
  "dataset.terminal4UploadedJetwayA1CabHeightErrorMeters",
  "dataset.terminal4UploadedJetwayA1StairGroundClearanceMeters",
  "dataset.terminal4UploadedJetwayA1BogieGroundClearanceMeters",
  "dataset.terminal4UploadedJetwayA1CabYawOffsetDegrees",
]) {
  if (!source.includes(token)) throw new Error(`${path}: missing full-3D runtime evidence ${token}`);
}
console.log("Prepared browser telemetry for full-3D supplied jetway contact, Cab normal, height and grounded stair/bogie checks.");
