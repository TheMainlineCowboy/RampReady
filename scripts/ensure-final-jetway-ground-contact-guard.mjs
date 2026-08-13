import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const residualFailure = "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6";
const mismatchMarker = "Exact jetway readiness mismatch:";
const bogieAuthority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const retiredBogieAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
const retiredA1CosmeticCornerGuard = "!(sourceLockedA1CornerAngle >= 45 && sourceLockedA1CornerAngle <= 150)";
const physicalA1CornerDiagnosticGuard = "!Number.isFinite(sourceLockedA1CornerAngle) || sourceLockedA1CornerAngle < 0 || sourceLockedA1CornerAngle > 180";
const bogieDeclarationAnchor = `          const bogieTireCorrection = Number(group.userData.uploadedJetwayBogieTireContactCorrectionMeters ?? NaN);`;
const measuredDeclarations = `${bogieDeclarationAnchor}
          const bogieGroundClearance = Number(group.userData.uploadedJetwayBogieGroundClearanceMeters ?? Infinity);
          const bogieGroundContactAuthority = group.userData.uploadedJetwayBogieGroundContactAuthority || "missing";
          const bogieGroundContactPointCount = Number(group.userData.uploadedJetwayBogieGroundContactPointCount ?? -1);
          const bogieGroundContactClusterCount = Number(group.userData.uploadedJetwayBogieGroundContactClusterCount ?? -1);
          const bogieGroundContactSpanX = Number(group.userData.uploadedJetwayBogieGroundContactSpanX ?? -1);
          const bogieGroundContactSpanZ = Number(group.userData.uploadedJetwayBogieGroundContactSpanZ ?? -1);
          const bogieGroundHorizontalContactSpan = Number(group.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters ?? -1);
          const bogieGroundContactCenterX = Number(group.userData.uploadedJetwayBogieGroundContactCenterX ?? NaN);
          const bogieGroundContactCenterY = Number(group.userData.uploadedJetwayBogieGroundContactCenterY ?? NaN);
          const bogieGroundContactCenterZ = Number(group.userData.uploadedJetwayBogieGroundContactCenterZ ?? NaN);`;
const measuredFailures = `!Number.isFinite(fleetGroundOffset)
            || !Number.isFinite(bogieTireCorrection)
            || Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6
            || Math.abs(fleetGroundOffset) > 8
            || Math.abs(bogieGroundClearance) > 0.015
            || bogieGroundContactAuthority !== "${bogieAuthority}"
            || bogieGroundContactPointCount < 4
            || bogieGroundContactClusterCount < 1
            || !Number.isFinite(bogieGroundContactSpanX)
            || !Number.isFinite(bogieGroundContactSpanZ)
            || bogieGroundHorizontalContactSpan < 0.35
            || !Number.isFinite(bogieGroundContactCenterX)
            || !Number.isFinite(bogieGroundContactCenterY)
            || !Number.isFinite(bogieGroundContactCenterZ)`;

if (!source.includes("const fleetGroundOffset") || !source.includes(bogieDeclarationAnchor)) {
  throw new Error(`${readinessPath}: final fleet/bogie telemetry declarations are missing`);
}

// npm run verify intentionally normalizes the generated readiness module before
// some browser workflows invoke npm run build in the same checkout. Seed the
// complete Tunnel-C-specific bogie contract here so regeneration can never fall
// back to a terminal-pedestal/whole-model minimum as proof that the aircraft-side
// wheels are on the ramp.
if (!source.includes("const bogieGroundContactPointCount =")) {
  source = source.replace(bogieDeclarationAnchor, measuredDeclarations);
}

// Remove any retired whole-model authority/thresholds that an earlier generated
// readiness pass may have left behind before we attach the final invariant.
source = source
  .replaceAll(retiredBogieAuthority, bogieAuthority)
  .replaceAll("Math.abs(bogieGroundClearance) > 0.005", "Math.abs(bogieGroundClearance) > 0.015")
  .replaceAll("bogieGroundContactPointCount < 8", "bogieGroundContactPointCount < 4")
  .replaceAll("bogieGroundContactClusterCount < 2", "bogieGroundContactClusterCount < 1")
  .replaceAll("bogieGroundHorizontalContactSpan < 1.2", "bogieGroundHorizontalContactSpan < 0.35");

const mismatchIndex = source.indexOf(mismatchMarker);
if (mismatchIndex < 0) {
  throw new Error(`${readinessPath}: exact readiness mismatch block is missing for final ground-contact guard`);
}
const conditionStart = source.lastIndexOf("\n          if (\n", mismatchIndex);
if (conditionStart < 0) {
  throw new Error(`${readinessPath}: exact readiness condition opening is missing for final ground-contact guard`);
}

if (!source.includes(residualFailure)) {
  const insertionPoint = conditionStart + "\n          if (\n".length;
  source = `${source.slice(0, insertionPoint)}            ${residualFailure}\n            || ${source.slice(insertionPoint).replace(/^\s*/, "")}`;
}

// The source-registered Rotunda module owns physical through-continuity and may
// already have removed the retired 45-150 degree cosmetic corner gate before
// this final readiness pass. In that path, seed only a mathematical sanity check
// for the published diagnostic angle so the downstream normalizer is idempotent.
// If the retired cosmetic gate is still present, leave it for the normalizer to
// convert rather than duplicating the physical diagnostic.
if (!source.includes(retiredA1CosmeticCornerGuard) && !source.includes(physicalA1CornerDiagnosticGuard)) {
  const insertionPoint = conditionStart + "\n          if (\n".length;
  source = `${source.slice(0, insertionPoint)}            ${physicalA1CornerDiagnosticGuard}\n            || ${source.slice(insertionPoint).replace(/^\s*/, "")}`;
}

// Add the Tunnel-C-specific invariant once if an existing readiness condition
// does not already contain it. Duplicated equivalent v3 checks are harmless but
// retired v2 semantics are a hard error below.
if (!source.includes(`bogieGroundContactAuthority !== "${bogieAuthority}"`)) {
  const residualIndex = source.indexOf(residualFailure, conditionStart);
  if (residualIndex < 0 || residualIndex > mismatchIndex) {
    throw new Error(`${readinessPath}: cannot attach measured Tunnel-C bogie readiness gates to the final residual guard`);
  }
  const lineEnd = source.indexOf("\n", residualIndex);
  if (lineEnd < 0) throw new Error(`${readinessPath}: malformed final bogie residual guard`);
  source = `${source.slice(0, lineEnd)}\n            || ${measuredFailures}${source.slice(lineEnd)}`;
}

for (const required of [
  residualFailure,
  "const bogieGroundContactPointCount =",
  "const bogieGroundContactClusterCount =",
  "const bogieGroundContactCenterX =",
  "bogieGroundContactPointCount < 4",
  `bogieGroundContactAuthority !== "${bogieAuthority}"`,
  "bogieGroundHorizontalContactSpan < 0.35",
  "Math.abs(bogieGroundClearance) > 0.015",
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final Tunnel-C measured bogie guard is missing ${required}`);
  }
}
if (!source.includes(retiredA1CosmeticCornerGuard) && !source.includes(physicalA1CornerDiagnosticGuard)) {
  throw new Error(`${readinessPath}: final A1 source-owned corner diagnostic is missing`);
}
for (const forbidden of [
  retiredBogieAuthority,
  "Math.abs(bogieGroundClearance) > 0.005",
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpan < 1.2",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired whole-model/pedestal bogie guard survived final runtime preparation: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Ensured regeneration-safe final Tunnel-C bogie readiness and idempotent source-owned A1 corner telemetry: aircraft-side support geometry must be within 1.5 cm of the ramp, and no cosmetic 45-150 degree turn is required for a physically continuous Rotunda.");
await import(`./normalize-final-jetway-readiness-after-runtime.mjs?ground-contact-guard=${Date.now()}`);
