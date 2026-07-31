import fs from "node:fs";

const authoredPath = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(authoredPath, "utf8");

const extensionImport = 'import { installTerminal4BConcourseExtensionV17 } from "./terminal4BConcourseExtensionV17.js";';
if (!source.includes(extensionImport)) {
  const anchor = 'import { buildSourcePlacedTerminal4Jetways } from "./sourcePlacedTerminal4Jetways.js";';
  if (!source.includes(anchor)) throw new Error(`${authoredPath}: missing source-placed jetway import anchor for B concourse`);
  source = source.replace(anchor, `${anchor}\n${extensionImport}`);
}

const extensionCall = "  const terminal4BConcourseExtension = installTerminal4BConcourseExtensionV17(sourcePlacedJetways);";
if (!source.includes(extensionCall)) {
  const polishCall = "  applyTerminal4JetwaySimulatorPolish(sourcePlacedJetways);";
  const fallback = "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);";
  const anchor = source.includes(polishCall) ? polishCall : fallback;
  if (!source.includes(anchor)) throw new Error(`${authoredPath}: missing source-placed jetway construction/polish anchor for B concourse`);
  source = source.replace(anchor, `${anchor}\n${extensionCall}`);
}

const sourceEvidence = `  sourcePlacedJetways.userData.terminal4BConcourseExtensionAuthority = terminal4BConcourseExtension.userData.authority;
  sourcePlacedJetways.userData.terminal4BConcourseSourceAerialAuthority = terminal4BConcourseExtension.userData.sourceAerialAuthority;
  sourcePlacedJetways.userData.terminal4BConcourseSourceGateAuthority = terminal4BConcourseExtension.userData.sourceGateAuthority;
  sourcePlacedJetways.userData.terminal4BConcourseMainPierBounds = terminal4BConcourseExtension.userData.mainPierBounds;
  sourcePlacedJetways.userData.terminal4B15PierBounds = terminal4BConcourseExtension.userData.b15PierBounds;
  sourcePlacedJetways.userData.terminal4B15AttachedRotundas = terminal4BConcourseExtension.userData.b15AttachedRotundas;
  sourcePlacedJetways.userData.terminal4BConcourseDisclosure = terminal4BConcourseExtension.userData.syntheticEquivalentDisclosure;`;
if (!source.includes("terminal4BConcourseExtensionAuthority = terminal4BConcourseExtension.userData.authority")) {
  if (!source.includes(extensionCall)) throw new Error(`${authoredPath}: missing B-concourse extension call for evidence`);
  source = source.replace(extensionCall, `${extensionCall}\n${sourceEvidence}`);
}

const environmentEvidence = `  environment.userData.authoredTerminal4BConcourseExtensionAuthority = sourcePlacedJetways.userData.terminal4BConcourseExtensionAuthority;
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
}

for (const token of [
  extensionImport,
  extensionCall,
  "terminal4BConcourseExtensionAuthority",
  "authoredTerminal4BConcourseExtensionAuthority",
  "authoredTerminal4B15AttachedRotundas",
  "package-aerial-and-gate-aligned-building-equivalent-for-missing-term4.BGL-extension",
]) {
  if (!source.includes(token)) throw new Error(`${authoredPath}: B-concourse extension preparation is missing ${token}`);
}

fs.writeFileSync(authoredPath, source, "utf8");
console.log("Prepared the missing Terminal 4 B-concourse from the supplied PHX aerial and B15-B28 source gate coordinates, with B15L/B15M intersecting the real pier facade instead of 88-112 m apron tunnels.");
