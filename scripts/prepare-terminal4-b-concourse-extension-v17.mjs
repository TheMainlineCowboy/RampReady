import fs from "node:fs";

const authoredPath = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(authoredPath, "utf8");

const extensionImport = 'import { installTerminal4BConcourseExtensionV17 } from "./terminal4BConcourseExtensionV17.js";';
const detailImport = 'import { installTerminal4BConcourseDetailV18 } from "./terminal4BConcourseDetailV18.js";';
if (!source.includes(extensionImport)) {
  const anchor = 'import { buildSourcePlacedTerminal4Jetways } from "./sourcePlacedTerminal4Jetways.js";';
  if (!source.includes(anchor)) throw new Error(`${authoredPath}: missing source-placed jetway import anchor for B concourse`);
  source = source.replace(anchor, `${anchor}\n${extensionImport}`);
}
if (!source.includes(detailImport)) {
  if (!source.includes(extensionImport)) throw new Error(`${authoredPath}: missing B-concourse extension import for detail`);
  source = source.replace(extensionImport, `${extensionImport}\n${detailImport}`);
}

const extensionCall = "  const terminal4BConcourseExtension = installTerminal4BConcourseExtensionV17(sourcePlacedJetways);";
if (!source.includes(extensionCall)) {
  const polishCall = "  applyTerminal4JetwaySimulatorPolish(sourcePlacedJetways);";
  const fallback = "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);";
  const anchor = source.includes(polishCall) ? polishCall : fallback;
  if (!source.includes(anchor)) throw new Error(`${authoredPath}: missing source-placed jetway construction/polish anchor for B concourse`);
  source = source.replace(anchor, `${anchor}\n${extensionCall}`);
}

const detailCall = `  const [bMainXMin, bMainXMax, bMainZMin, bMainZMax] = terminal4BConcourseExtension.userData.mainPierBounds;
  const [b15XMin, b15XMax, b15ZMin, b15ZMax] = terminal4BConcourseExtension.userData.b15PierBounds;
  const terminal4BConcourseDetail = installTerminal4BConcourseDetailV18(terminal4BConcourseExtension, {
    mainXMin: bMainXMin,
    mainXMax: bMainXMax,
    mainZMin: bMainZMin,
    mainZMax: bMainZMax,
    b15XMin,
    b15XMax,
    b15ZMin,
    b15ZMax,
  });`;
if (!source.includes("installTerminal4BConcourseDetailV18(terminal4BConcourseExtension")) {
  if (!source.includes(extensionCall)) throw new Error(`${authoredPath}: missing B-concourse extension call for detail`);
  source = source.replace(extensionCall, `${extensionCall}\n${detailCall}`);
}

const sourceEvidence = `  sourcePlacedJetways.userData.terminal4BConcourseExtensionAuthority = terminal4BConcourseExtension.userData.authority;
  sourcePlacedJetways.userData.terminal4BConcourseDetailAuthority = terminal4BConcourseDetail.userData.authority;
  sourcePlacedJetways.userData.terminal4BConcourseSourceAerialAuthority = terminal4BConcourseExtension.userData.sourceAerialAuthority;
  sourcePlacedJetways.userData.terminal4BConcourseSourceGateAuthority = terminal4BConcourseExtension.userData.sourceGateAuthority;
  sourcePlacedJetways.userData.terminal4BConcourseMainPierBounds = terminal4BConcourseExtension.userData.mainPierBounds;
  sourcePlacedJetways.userData.terminal4B15PierBounds = terminal4BConcourseExtension.userData.b15PierBounds;
  sourcePlacedJetways.userData.terminal4B15AttachedRotundas = terminal4BConcourseExtension.userData.b15AttachedRotundas;
  sourcePlacedJetways.userData.terminal4BConcourseDisclosure = terminal4BConcourseExtension.userData.syntheticEquivalentDisclosure;`;
if (!source.includes("terminal4BConcourseExtensionAuthority = terminal4BConcourseExtension.userData.authority")) {
  if (!source.includes(detailCall)) throw new Error(`${authoredPath}: missing B-concourse detail call for evidence`);
  source = source.replace(detailCall, `${detailCall}\n${sourceEvidence}`);
} else if (!source.includes("terminal4BConcourseDetailAuthority")) {
  const evidenceAnchor = "  sourcePlacedJetways.userData.terminal4BConcourseExtensionAuthority = terminal4BConcourseExtension.userData.authority;";
  source = source.replace(evidenceAnchor, `${evidenceAnchor}\n  sourcePlacedJetways.userData.terminal4BConcourseDetailAuthority = terminal4BConcourseDetail.userData.authority;`);
}

const environmentEvidence = `  environment.userData.authoredTerminal4BConcourseExtensionAuthority = sourcePlacedJetways.userData.terminal4BConcourseExtensionAuthority;
  environment.userData.authoredTerminal4BConcourseDetailAuthority = sourcePlacedJetways.userData.terminal4BConcourseDetailAuthority;
  environment.userData.authoredTerminal4BConcourseSourceAerialAuthority = sourcePlacedJetways.userData.terminal4BConcourseSourceAerialAuthority;
  environment.userData.authoredTerminal4BConcourseSourceGateAuthority = sourcePlacedJetways.userData.terminal4BConcourseSourceGateAuthority;
  environment.userData.authoredTerminal4BConcourseMainPierBounds = sourcePlacedJetways.userData.terminal4BConcourseMainPierBounds;
  environment.userData.authoredTerminal4B15PierBounds = sourcePlacedJetways.userData.terminal4B15PierBounds;
  environment.userData.authoredTerminal4B15AttachedRotundas = sourcePlacedJetways.userData.terminal4B15AttachedRotundas;
  environment.userData.authoredTerminal4BConcourseDisclosure = sourcePlacedJetways.userData.terminal4BConcourseDisclosure;`;
if (!source.includes("authoredTerminal4BConcourseExtensionAuthority")) {
  const anchor = "  environment.userData.authoredTerminal4Jetways = sourcePlacedJetways;";
  if (!source.includes(anchor)) throw new Error(`${authoredPath}: missing authored Terminal 4 jetway evidence anchor for B concourse`);
  source = source.replace(anchor, `${anchor}\n${environmentEvidence}`);
} else if (!source.includes("authoredTerminal4BConcourseDetailAuthority")) {
  const evidenceAnchor = "  environment.userData.authoredTerminal4BConcourseExtensionAuthority = sourcePlacedJetways.userData.terminal4BConcourseExtensionAuthority;";
  source = source.replace(evidenceAnchor, `${evidenceAnchor}\n  environment.userData.authoredTerminal4BConcourseDetailAuthority = sourcePlacedJetways.userData.terminal4BConcourseDetailAuthority;`);
}

for (const token of [
  extensionImport,
  detailImport,
  extensionCall,
  "installTerminal4BConcourseDetailV18(terminal4BConcourseExtension",
  "terminal4BConcourseExtensionAuthority",
  "terminal4BConcourseDetailAuthority",
  "terminal4BConcourseDisclosure = terminal4BConcourseExtension.userData.syntheticEquivalentDisclosure",
  "authoredTerminal4BConcourseExtensionAuthority",
  "authoredTerminal4BConcourseDetailAuthority",
  "authoredTerminal4B15AttachedRotundas",
  "authoredTerminal4BConcourseDisclosure",
]) {
  if (!source.includes(token)) throw new Error(`${authoredPath}: B-concourse extension preparation is missing ${token}`);
}

fs.writeFileSync(authoredPath, source, "utf8");
console.log("Prepared the missing Terminal 4 B-concourse from the supplied PHX aerial and B15-B28 source gate coordinates, then added simulator-detail panel joints, framed B15 portals, ramp curbs, parapets and irregular rooftop equipment.");
