import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const authoredPath = "src/environment/authoredTerminal4Visual.js";
const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(readinessPath, "utf8");
let authored = fs.readFileSync(authoredPath, "utf8");
let trainer = fs.readFileSync(trainerPath, "utf8");

const authority = "exact-authored-a1-lowest-geometry-ramp-contact-v1";

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
          const bogieGroundHorizontalContactSpan = Number(group.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters ?? -1);`;
if (source.includes(declarationAnchor) && !source.includes("const bogieGroundContactPointCount =")) {
  source = source.replace(declarationAnchor, declarations);
}

const staleGates = `            || Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6
            || !(bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1)`;
const earlierMeasuredGates = `            || !Number.isFinite(fleetGroundOffset)
            || !Number.isFinite(bogieTireCorrection)
            || Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6
            || Math.abs(fleetGroundOffset) > 0.5
            || Math.abs(bogieGroundClearance) > 0.005
            || bogieGroundContactAuthority !== "${authority}"`;
const measuredGates = `            || !Number.isFinite(fleetGroundOffset)
            || !Number.isFinite(bogieTireCorrection)
            || Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6
            || Math.abs(fleetGroundOffset) > 3
            || Math.abs(bogieGroundClearance) > 0.005
            || bogieGroundContactAuthority !== "${authority}"
            || bogieGroundContactPointCount < 8
            || bogieGroundContactClusterCount < 2
            || !Number.isFinite(bogieGroundContactSpanX)
            || !Number.isFinite(bogieGroundContactSpanZ)
            || bogieGroundHorizontalContactSpan < 1.2`;
if (source.includes(staleGates)) {
  source = source.replace(staleGates, measuredGates);
} else if (source.includes(earlierMeasuredGates)) {
  source = source.replace(earlierMeasuredGates, measuredGates);
} else if (!source.includes("bogieGroundContactClusterCount < 2")) {
  throw new Error(`${readinessPath}: A1 measured bogie readiness gates are missing`);
}

source = source.replace(
  "installation=${installationAuthority}/${fleetGroundOffset}/${bogieTireCorrection}/${a1TerminalConnectionAuthority}",
  "installation=${installationAuthority}/${fleetGroundOffset}/${bogieTireCorrection}/${bogieGroundClearance}/${bogieGroundContactAuthority}/${bogieGroundContactPointCount}/${bogieGroundContactClusterCount}/${bogieGroundContactSpanX}/${bogieGroundContactSpanZ}/${bogieGroundHorizontalContactSpan}/${a1TerminalConnectionAuthority}",
);

const authoredAnchor = `  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = sourcePlacedJetways.userData.uploadedJetwayA1PartCentersMeters;`;
const authoredEvidence = `${authoredAnchor}
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayBogieGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactAuthority = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactAuthority;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactPointCount = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactPointCount;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactClusterCount = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactClusterCount;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactSpanX = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactSpanX;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactSpanZ = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactSpanZ;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters = sourcePlacedJetways.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters;`;
authored = replaceRequired(
  authored,
  authoredAnchor,
  authoredEvidence,
  authoredPath,
  "uploaded jetway authored-environment ground evidence",
);

const loadingAnchor = `    renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "loading";`;
const loadingEvidence = `${loadingAnchor}
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactPointCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactClusterCount = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanX = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanZ = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters = "loading";`;
trainer = replaceRequired(trainer, loadingAnchor, loadingEvidence, trainerPath, "bogie loading evidence");

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
          : "missing";`;
trainer = replaceRequired(trainer, readyAnchor, readyEvidence, trainerPath, "bogie ready evidence");

const errorAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "load-error";`;
const errorEvidence = `${errorAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactPointCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactClusterCount = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanX = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactSpanZ = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters = "load-error";`;
trainer = replaceRequired(trainer, errorAnchor, errorEvidence, trainerPath, "bogie load-error evidence");

for (const [path, text, tokens] of [
  [readinessPath, source, [
    "const bogieGroundClearance = Number(group.userData.uploadedJetwayBogieGroundClearanceMeters",
    "const bogieGroundContactPointCount = Number(group.userData.uploadedJetwayBogieGroundContactPointCount",
    "bogieGroundContactClusterCount < 2",
    "bogieGroundHorizontalContactSpan < 1.2",
    "Math.abs(bogieGroundClearance) > 0.005",
    `bogieGroundContactAuthority !== "${authority}"`,
  ]],
  [authoredPath, authored, [
    "authoredTerminal4UploadedJetwayBogieGroundClearanceMeters",
    "authoredTerminal4UploadedJetwayBogieGroundContactClusterCount",
    "authoredTerminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  ]],
  [trainerPath, trainer, [
    "terminal4UploadedJetwayBogieGroundClearanceMeters",
    "terminal4UploadedJetwayBogieGroundContactPointCount",
    "terminal4UploadedJetwayBogieGroundContactClusterCount",
    "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  ]],
]) {
  for (const token of tokens) {
    if (!text.includes(token)) throw new Error(`${path}: measured bogie evidence is missing ${token}`);
  }
}
if (source.includes("bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1")) {
  throw new Error(`${readinessPath}: obsolete fixed bogie correction range remains`);
}

fs.writeFileSync(readinessPath, source, "utf8");
fs.writeFileSync(authoredPath, authored, "utf8");
fs.writeFileSync(trainerPath, trainer, "utf8");
console.log("Required and published a separated multi-point authored A1 ramp footprint, exact post-offset clearance, and measured parent translation through readiness and browser evidence.");
