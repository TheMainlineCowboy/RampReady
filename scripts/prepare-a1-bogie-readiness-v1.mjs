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
          const bogieGroundContactAuthority = group.userData.uploadedJetwayBogieGroundContactAuthority || "missing";`;
if (source.includes(declarationAnchor) && !source.includes("const bogieGroundClearance =")) {
  source = source.replace(declarationAnchor, declarations);
}

const staleGates = `            || Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6
            || !(bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1)`;
const measuredGates = `            || !Number.isFinite(fleetGroundOffset)
            || !Number.isFinite(bogieTireCorrection)
            || Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6
            || Math.abs(fleetGroundOffset) > 0.5
            || Math.abs(bogieGroundClearance) > 0.005
            || bogieGroundContactAuthority !== "${authority}"`;
if (source.includes(staleGates)) {
  source = source.replace(staleGates, measuredGates);
} else if (!source.includes(`bogieGroundContactAuthority !== "${authority}"`)) {
  throw new Error(`${readinessPath}: stale fixed bogie correction gates are missing`);
}

source = source.replace(
  "installation=${installationAuthority}/${fleetGroundOffset}/${bogieTireCorrection}/${a1TerminalConnectionAuthority}",
  "installation=${installationAuthority}/${fleetGroundOffset}/${bogieTireCorrection}/${bogieGroundClearance}/${bogieGroundContactAuthority}/${a1TerminalConnectionAuthority}",
);

const authoredAnchor = `  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = sourcePlacedJetways.userData.uploadedJetwayA1PartCentersMeters;`;
const authoredEvidence = `${authoredAnchor}
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayBogieGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactAuthority = sourcePlacedJetways.userData.uploadedJetwayBogieGroundContactAuthority;`;
authored = replaceRequired(
  authored,
  authoredAnchor,
  authoredEvidence,
  authoredPath,
  "uploaded jetway authored-environment evidence",
);

const loadingAnchor = `    renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "loading";`;
const loadingEvidence = `${loadingAnchor}
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactAuthority = "loading";`;
trainer = replaceRequired(trainer, loadingAnchor, loadingEvidence, trainerPath, "bogie loading evidence");

const readyAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters || "missing";`;
const readyEvidence = `${readyAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayBogieGroundClearanceMeters)
          ? environment.userData.authoredTerminal4UploadedJetwayBogieGroundClearanceMeters.toFixed(6)
          : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactAuthority = environment.userData.authoredTerminal4UploadedJetwayBogieGroundContactAuthority || "missing";`;
trainer = replaceRequired(trainer, readyAnchor, readyEvidence, trainerPath, "bogie ready evidence");

const errorAnchor = `        renderer.domElement.dataset.terminal4UploadedJetwayA1PartCentersMeters = "load-error";`;
const errorEvidence = `${errorAnchor}
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayBogieGroundContactAuthority = "load-error";`;
trainer = replaceRequired(trainer, errorAnchor, errorEvidence, trainerPath, "bogie load-error evidence");

for (const [path, text, tokens] of [
  [readinessPath, source, [
    "const bogieGroundClearance = Number(group.userData.uploadedJetwayBogieGroundClearanceMeters",
    "const bogieGroundContactAuthority = group.userData.uploadedJetwayBogieGroundContactAuthority",
    "Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6",
    "Math.abs(bogieGroundClearance) > 0.005",
    `bogieGroundContactAuthority !== "${authority}"`,
  ]],
  [authoredPath, authored, [
    "authoredTerminal4UploadedJetwayBogieGroundClearanceMeters",
    "authoredTerminal4UploadedJetwayBogieGroundContactAuthority",
  ]],
  [trainerPath, trainer, [
    "terminal4UploadedJetwayBogieGroundClearanceMeters",
    "terminal4UploadedJetwayBogieGroundContactAuthority",
    "authoredTerminal4UploadedJetwayBogieGroundClearanceMeters.toFixed(6)",
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
console.log("Validated and published exact measured A1 ramp clearance and contact authority through readiness, Terminal 4 environment, and browser evidence.");
