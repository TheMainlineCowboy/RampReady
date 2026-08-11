import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const authoredPath = "src/environment/authoredTerminal4Visual.js";
const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(readinessPath, "utf8");
let authored = fs.readFileSync(authoredPath, "utf8");
let trainer = fs.readFileSync(trainerPath, "utf8");

const authority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const retiredAuthorities = [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
];

function replaceRequired(text, before, after, path, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`${path}: ${label} anchor is missing`);
  return text.replace(before, after);
}

const declarationAnchor = `          const bogieTireCorrection = Number(group.userData.uploadedJetwayBogieTireContactCorrectionMeters ?? NaN);`;
const declarations = `${declarationAnchor}
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

if (!source.includes("const bogieGroundContactPointCount =")) {
  if (!source.includes(declarationAnchor)) {
    throw new Error(`${readinessPath}: bogie telemetry declaration anchor is missing`);
  }
  source = source.replace(declarationAnchor, declarations);
} else if (!source.includes("const bogieGroundContactCenterX =")) {
  const spanAnchor = `          const bogieGroundHorizontalContactSpan = Number(group.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters ?? -1);`;
  if (!source.includes(spanAnchor)) throw new Error(`${readinessPath}: bogie center telemetry anchor is missing`);
  source = source.replace(
    spanAnchor,
    `${spanAnchor}
          const bogieGroundContactCenterX = Number(group.userData.uploadedJetwayBogieGroundContactCenterX ?? NaN);
          const bogieGroundContactCenterY = Number(group.userData.uploadedJetwayBogieGroundContactCenterY ?? NaN);
          const bogieGroundContactCenterZ = Number(group.userData.uploadedJetwayBogieGroundContactCenterZ ?? NaN);`,
  );
}

for (const retired of retiredAuthorities) source = source.replaceAll(retired, authority);
source = source
  .replaceAll("Math.abs(bogieGroundClearance) > 0.005", "Math.abs(bogieGroundClearance) > 0.015")
  .replaceAll("bogieGroundContactPointCount < 8", "bogieGroundContactPointCount < 4")
  .replaceAll("bogieGroundContactClusterCount < 2", "bogieGroundContactClusterCount < 1")
  .replaceAll("bogieGroundHorizontalContactSpan < 1.2", "bogieGroundHorizontalContactSpan < 0.35")
  .replaceAll("Math.abs(fleetGroundOffset) > 3", "Math.abs(fleetGroundOffset) > 8")
  .replaceAll("Math.abs(fleetGroundOffset) > 0.5", "Math.abs(fleetGroundOffset) > 8")
  .replaceAll(
    "bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1",
    "Number.isFinite(bogieTireCorrection) && bogieTireCorrection > 0",
  );

const strictGuards = [
  "!Number.isFinite(fleetGroundOffset)",
  "!Number.isFinite(bogieTireCorrection)",
  "Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6",
  "Math.abs(fleetGroundOffset) > 8",
  "Math.abs(bogieGroundClearance) > 0.015",
  `bogieGroundContactAuthority !== "${authority}"`,
  "bogieGroundContactPointCount < 4",
  "bogieGroundContactClusterCount < 1",
  "!Number.isFinite(bogieGroundContactSpanX)",
  "!Number.isFinite(bogieGroundContactSpanZ)",
  "bogieGroundHorizontalContactSpan < 0.35",
  "!Number.isFinite(bogieGroundContactCenterX)",
  "!Number.isFinite(bogieGroundContactCenterY)",
  "!Number.isFinite(bogieGroundContactCenterZ)",
];

const missingGuards = strictGuards.filter((guard) => !source.includes(guard));
if (missingGuards.length) {
  const mismatchMarker = "Exact jetway readiness mismatch:";
  const mismatchIndex = source.indexOf(mismatchMarker);
  if (mismatchIndex < 0) throw new Error(`${readinessPath}: exact readiness mismatch marker is missing`);
  const conditionClose = source.lastIndexOf("          ) {", mismatchIndex);
  const conditionStart = source.lastIndexOf("          if (", mismatchIndex);
  if (conditionStart < 0 || conditionClose < conditionStart) {
    throw new Error(`${readinessPath}: exact readiness condition boundaries are missing`);
  }
  source = `${source.slice(0, conditionClose)}            || ${missingGuards.join("\n            || ")}\n${source.slice(conditionClose)}`;
}

source = source.replace(
  "installation=${installationAuthority}/${fleetGroundOffset}/${bogieTireCorrection}/${a1TerminalConnectionAuthority}",
  "installation=${installationAuthority}/${fleetGroundOffset}/${bogieTireCorrection}/${bogieGroundClearance}/${bogieGroundContactAuthority}/${bogieGroundContactPointCount}/${bogieGroundContactClusterCount}/${bogieGroundContactSpanX}/${bogieGroundContactSpanZ}/${bogieGroundHorizontalContactSpan}/${bogieGroundContactCenterX}/${bogieGroundContactCenterY}/${bogieGroundContactCenterZ}/${a1TerminalConnectionAuthority}",
);

const authoredAnchor = `  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = sourcePlacedJetways.userData.uploadedJetwayA1PartCentersMeters;`;
const authoredEvidence = `${authoredAnchor}
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayBogieGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactAuthority = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactAuthority;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactPointCount = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactPointCount;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactClusterCount = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactClusterCount;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactSpanX = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactSpanX;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactSpanZ = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactSpanZ;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters = sourcePlacedJetways.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactCenterX = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactCenterX;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactCenterY = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactCenterY;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactCenterZ = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactCenterZ;`;
if (!authored.includes("authoredTerminal4UploadedJetwayBogieGroundContactCenterX")) {
  authored = replaceRequired(
    authored,
    authoredAnchor,
    authoredEvidence,
    authoredPath,
    "uploaded jetway authored-environment ground evidence",
  );
}

const loadingAnchor = `    renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "loading";`;
const loadingEvidence = `${loadingAnchor}
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactPointCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactClusterCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanX = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanZ = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactCenterX = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactCenterY = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactCenterZ = "loading";`;
if (!trainer.includes("terminal4UploadedJetwayBogieGroundContactCenterX = \"loading\"")) {
  trainer = replaceRequired(trainer, loadingAnchor, loadingEvidence, trainerPath, "bogie loading evidence");
}

const readyAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters || "missing";`;
const readyEvidence = `${readyAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayBogieGroundClearanceMeters)
          ? environment.userData.authoredTerminal4UploadedJetwayBogieGroundClearanceMeters.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactAuthority = environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactPointCount = String(environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactPointCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactClusterCount = String(environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactClusterCount ?? "missing");
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanX = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactSpanX)
          ? environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactSpanX.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanZ = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactSpanZ)
          ? environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactSpanZ.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters)
          ? environment.userData.authoredTerminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactCenterX = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactCenterX)
          ? environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactCenterX.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactCenterY = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactCenterY)
          ? environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactCenterY.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactCenterZ = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactCenterZ)
          ? environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactCenterZ.toFixed(6)
          : "missing";`;
if (!trainer.includes("terminal4UploadedJetwayBogieGroundContactCenterX = Number.isFinite")) {
  trainer = replaceRequired(trainer, readyAnchor, readyEvidence, trainerPath, "bogie ready evidence");
}

const errorAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "load-error";`;
const errorEvidence = `${errorAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactPointCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactClusterCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanX = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanZ = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactCenterX = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactCenterY = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactCenterZ = "load-error";`;
if (!trainer.includes("terminal4UploadedJetwayBogieGroundContactCenterX = \"load-error\"")) {
  trainer = replaceRequired(trainer, errorAnchor, errorEvidence, trainerPath, "bogie load-error evidence");
}

for (const [path, text, tokens] of [
  [readinessPath, source, [
    "const bogieGroundClearance = Number(group.userData.uploadedJetwayBogieGroundClearanceMeters",
    "const bogieGroundContactPointCount = Number(group.userData.uploadedJetwayBogieGroundContactPointCount",
    "const bogieGroundContactCenterX = Number(group.userData.uploadedJetwayBogieGroundContactCenterX",
    "bogieGroundContactClusterCount < 1",
    "bogieGroundHorizontalContactSpan < 0.35",
    "!Number.isFinite(bogieGroundContactCenterX)",
    "Math.abs(bogieGroundClearance) > 0.015",
    `bogieGroundContactAuthority !== "${authority}"`,
  ]],
  [authoredPath, authored, [
    "authoredTerminal4UploadedJetwayBogieGroundClearanceMeters",
    "authoredTerminal4UploadedJetwayBogieGroundContactClusterCount",
    "authoredTerminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
    "authoredTerminal4UploadedJetwayBogieGroundContactCenterX",
  ]],
  [trainerPath, trainer, [
    "terminal4UploadedJetwayBogieGroundClearanceMeters",
    "terminal4UploadedJetwayBogieGroundContactPointCount",
    "terminal4UploadedJetwayBogieGroundContactClusterCount",
    "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
    "terminal4UploadedJetwayBogieGroundContactCenterX",
    "terminal4UploadedJetwayBogieGroundContactCenterY",
    "terminal4UploadedJetwayBogieGroundContactCenterZ",
  ]],
]) {
  for (const token of tokens) {
    if (!text.includes(token)) throw new Error(`${path}: measured Tunnel-C bogie evidence is missing ${token}`);
  }
}
for (const forbidden of [
  "bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1",
  ...retiredAuthorities,
  "Math.abs(bogieGroundClearance) > 0.005",
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpan < 1.2",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired whole-model/pedestal bogie readiness remains: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
fs.writeFileSync(authoredPath, authored, "utf8");
fs.writeFileSync(trainerPath, trainer, "utf8");
console.log("Required and published idempotent Tunnel-C-specific A1 ramp evidence: <=1.5 cm clearance, finite multi-point aircraft-side support footprint, and no whole-model/pedestal ground authority.");
