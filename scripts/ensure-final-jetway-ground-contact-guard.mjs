import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const residualFailure = "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6";
const mismatchMarker = "Exact jetway readiness mismatch:";
const bogieAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
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
            || Math.abs(fleetGroundOffset) > 3
            || Math.abs(bogieGroundClearance) > 0.005
            || bogieGroundContactAuthority !== "${bogieAuthority}"
            || bogieGroundContactPointCount < 8
            || bogieGroundContactClusterCount < 2
            || !Number.isFinite(bogieGroundContactSpanX)
            || !Number.isFinite(bogieGroundContactSpanZ)
            || bogieGroundHorizontalContactSpan < 1.2
            || !Number.isFinite(bogieGroundContactCenterX)
            || !Number.isFinite(bogieGroundContactCenterY)
            || !Number.isFinite(bogieGroundContactCenterZ)`;

if (!source.includes("const fleetGroundOffset") || !source.includes(bogieDeclarationAnchor)) {
  throw new Error(`${readinessPath}: final fleet/bogie telemetry declarations are missing`);
}

// npm run verify intentionally normalizes the generated readiness module before
// some browser workflows invoke npm run build in the same checkout. Seed the
// complete measured bogie contract here so the later production preparer sees
// the same physical invariant instead of depending on the old literal guard.
if (!source.includes("const bogieGroundContactPointCount =")) {
  source = source.replace(bogieDeclarationAnchor, measuredDeclarations);
}

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

if (!source.includes("bogieGroundContactClusterCount < 2")) {
  const residualIndex = source.indexOf(residualFailure, conditionStart);
  if (residualIndex < 0 || residualIndex > mismatchIndex) {
    throw new Error(`${readinessPath}: cannot attach measured bogie readiness gates to the final residual guard`);
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
  "bogieGroundContactClusterCount < 2",
  `bogieGroundContactAuthority !== "${bogieAuthority}"`,
  "bogieGroundHorizontalContactSpan < 1.2",
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final measured bogie guard is missing ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Ensured regeneration-safe final exact-model bogie readiness: zero residual plus measured multi-point grounded-contact evidence.");
await import(`./normalize-final-jetway-readiness-after-runtime.mjs?ground-contact-guard=${Date.now()}`);
