import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(path, "utf8");

const CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3";
const TARGET_AUTHORITY = "placement-bridgeEnd-shared-with-static-articulation-v1";
const marker = "static-cab-closure-readiness-v1";

const callAnchor = `          const staticPortalClosures = installStaticJetwayPortalClosures(THREE, fleet, placements);`;
const declarations = `${callAnchor}
          // ${marker}
          const staticCabClosureAuthority = staticPortalClosures.authority || "missing";
          const staticCabTargetAuthority = staticPortalClosures.targetAuthority || "missing";
          const staticBridgeEndFallbackCount = Number(staticPortalClosures.targetFallbackCount ?? -1);
          const staticCabClosurePanelCount = Number(staticPortalClosures.closurePanelCount ?? -1);
          const staticCabClosureWindowCount = Number(staticPortalClosures.closureWindowCount ?? -1);
          const staticCabClosureSurroundPieceCount = Number(staticPortalClosures.surroundPieceCount ?? -1);
          const staticCabClosureAuthoredNodeTransformCount = Number(staticPortalClosures.authoredNodeTransformCount ?? -1);
          const staticApronFacingOpenAreaMeters = Number(staticPortalClosures.apronFacingOpenAreaMeters ?? Infinity);`;
if (!source.includes(marker)) {
  if (!source.includes(callAnchor)) {
    throw new Error(`${path}: static closure installation call is missing`);
  }
  source = source.replace(callAnchor, declarations);
}

const oldGate = `            || staticPortalClosures.authority !== STATIC_PORTAL_AUTHORITY
            || staticPortalClosures.gateCount !== 57`;
const exactGate = `            || staticPortalClosures.authority !== STATIC_PORTAL_AUTHORITY
            || staticPortalClosures.gateCount !== 57
            || staticCabClosureAuthority !== "${CLOSURE_AUTHORITY}"
            || staticCabTargetAuthority !== "${TARGET_AUTHORITY}"
            || staticBridgeEndFallbackCount !== 0
            || staticCabClosurePanelCount !== 57
            || staticCabClosureWindowCount !== 57
            || staticCabClosureSurroundPieceCount !== 171
            || staticCabClosureAuthoredNodeTransformCount !== 0
            || Math.abs(staticApronFacingOpenAreaMeters) > 1e-9`;
if (source.includes(oldGate)) {
  source = source.replace(oldGate, exactGate);
} else if (!source.includes("staticCabClosurePanelCount !== 57")) {
  throw new Error(`${path}: static closure readiness gate is missing`);
}

const telemetryAnchor = `          group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority;
          group.userData.uploadedJetwayStaticPortalClosureGateCount = staticPortalClosures.gateCount;`;
const telemetry = `${telemetryAnchor}
          group.userData.uploadedJetwayStaticCabClosureAuthority = staticCabClosureAuthority;
          group.userData.uploadedJetwayStaticCabTargetAuthority = staticCabTargetAuthority;
          group.userData.uploadedJetwayStaticBridgeEndFallbackCount = staticBridgeEndFallbackCount;
          group.userData.uploadedJetwayStaticCabClosurePanelCount = staticCabClosurePanelCount;
          group.userData.uploadedJetwayStaticCabClosureWindowCount = staticCabClosureWindowCount;
          group.userData.uploadedJetwayStaticCabClosureSurroundPieceCount = staticCabClosureSurroundPieceCount;
          group.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticCabClosureAuthoredNodeTransformCount;
          group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = staticApronFacingOpenAreaMeters;`;
if (!source.includes("group.userData.uploadedJetwayStaticCabClosureAuthority")) {
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${path}: static closure telemetry anchor is missing`);
  }
  source = source.replace(telemetryAnchor, telemetry);
}

for (const token of [
  marker,
  "const staticCabClosureAuthority = staticPortalClosures.authority",
  "const staticCabTargetAuthority = staticPortalClosures.targetAuthority",
  "staticBridgeEndFallbackCount !== 0",
  "staticCabClosurePanelCount !== 57",
  "staticCabClosureWindowCount !== 57",
  "staticCabClosureSurroundPieceCount !== 171",
  "staticCabClosureAuthoredNodeTransformCount !== 0",
  "Math.abs(staticApronFacingOpenAreaMeters) > 1e-9",
  "group.userData.uploadedJetwayStaticCabClosureAuthority",
  "group.userData.uploadedJetwayStaticCabTargetAuthority",
  "group.userData.uploadedJetwayStaticBridgeEndFallbackCount",
  "group.userData.uploadedJetwayStaticCabClosurePanelCount",
  "group.userData.uploadedJetwayStaticCabClosureWindowCount",
  "group.userData.uploadedJetwayStaticCabClosureSurroundPieceCount",
  "group.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount",
  "group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters",
]) {
  if (!source.includes(token)) {
    throw new Error(`${path}: static closure readiness output is missing ${token}`);
  }
}

fs.writeFileSync(path, source, "utf8");
console.log("Required all 57 static Terminal 4 Cab closures, exact articulation-shared bridgeEnd targets, zero fallback, zero authored-node transforms and zero apron-facing open area; copied every metric to fleet telemetry.");
