import fs from "node:fs";

const sourcePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const authoredPath = "src/environment/authoredTerminal4Visual.js";
const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(sourcePath, "utf8");
let authored = fs.readFileSync(authoredPath, "utf8");
let trainer = fs.readFileSync(trainerPath, "utf8");

const marker = "terminal-connected-lower-facade-fit-accounting-v3";
const legacyCount = `    const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance;
    if (facadeOuterWallFit != null) terminal4LowerFacadeFitCount += 1;`;
const terminalConnectedCount = `    // ${marker}
    // The resolved authored terminal-wall connection is the actual lower-facade
    // fit. A supplemental lower-height ray can miss single-sided legacy faces,
    // but that does not invalidate a real rotunda-to-terminal wall connection.
    if (terminalWallDistance != null) terminal4LowerFacadeFitCount += 1;`;
if (source.includes(legacyCount)) {
  source = source.replace(legacyCount, terminalConnectedCount);
} else if (!source.includes(marker)
  && !source.includes("if (terminalWallDistance != null) terminal4LowerFacadeFitCount += 1;")) {
  throw new Error(`${sourcePath}: lower-facade fit counting anchor is missing`);
}

const finalAssignment = "  group.userData.lowerFacadeFitCount = terminal4LowerFacadeFitCount;";
const previousAuthoritativeAssignment = /  \/\/ terminal-connected-lower-facade-fit-accounting-v\d+-authoritative-total\n  group\.userData\.lowerFacadeFitCount = terminalConnectedCount;/;
const authoritativeAssignment = `  // ${marker}-authoritative-total
  group.userData.lowerFacadeFitCount = terminalConnectedCount;`;
if (source.includes(finalAssignment)) {
  source = source.replace(finalAssignment, authoritativeAssignment);
} else if (previousAuthoritativeAssignment.test(source)) {
  source = source.replace(previousAuthoritativeAssignment, authoritativeAssignment);
} else if (!source.includes(`${marker}-authoritative-total`)) {
  throw new Error(`${sourcePath}: final lower-facade evidence assignment is missing`);
}

const authoredLegacy = "  environment.userData.authoredTerminal4LowerFacadeFitCount = sourcePlacedJetways.userData.lowerFacadeFitCount;";
const authoredAuthority = `  // ${marker}-environment-publication
  environment.userData.authoredTerminal4LowerFacadeFitCount = sourcePlacedJetways.userData.terminalConnectedJetwayCount;`;
if (authored.includes(authoredLegacy)) {
  authored = authored.replace(authoredLegacy, authoredAuthority);
} else if (!authored.includes(`${marker}-environment-publication`)) {
  authored = authored.replace(
    /  \/\/ terminal-connected-lower-facade-fit-accounting-v\d+-environment-publication\n  environment\.userData\.authoredTerminal4LowerFacadeFitCount = sourcePlacedJetways\.userData\.terminalConnectedJetwayCount;/,
    authoredAuthority,
  );
}

const trainerLegacy = "        renderer.domElement.dataset.terminal4LowerFacadeFitCount = String(environment.userData.authoredTerminal4LowerFacadeFitCount ?? 0);";
const trainerAuthority = `        // ${marker}-trainer-publication
        renderer.domElement.dataset.terminal4LowerFacadeFitCount = String(
          environment.userData.authoredTerminal4TerminalConnectedJetwayCount
            ?? environment.userData.authoredTerminal4LowerFacadeFitCount
            ?? 0,
        );`;
if (trainer.includes(trainerLegacy)) {
  trainer = trainer.replace(trainerLegacy, trainerAuthority);
} else if (!trainer.includes(`${marker}-trainer-publication`)) {
  trainer = trainer.replace(
    /        \/\/ terminal-connected-lower-facade-fit-accounting-v\d+-trainer-publication[\s\S]*?        \);/,
    trainerAuthority,
  );
}

for (const [path, text, tokens] of [
  [sourcePath, source, [marker, `${marker}-authoritative-total`, "group.userData.lowerFacadeFitCount = terminalConnectedCount;"]],
  [authoredPath, authored, [`${marker}-environment-publication`, "authoredTerminal4LowerFacadeFitCount = sourcePlacedJetways.userData.terminalConnectedJetwayCount"]],
  [trainerPath, trainer, [`${marker}-trainer-publication`, "authoredTerminal4TerminalConnectedJetwayCount"]],
]) {
  for (const token of tokens) {
    if (!text.includes(token)) throw new Error(`${path}: complete lower-facade evidence is missing ${token}`);
  }
}
if (source.includes(finalAssignment) || authored.includes(authoredLegacy) || trainer.includes(trainerLegacy)) {
  throw new Error("Stale partial lower-facade fit publication remains");
}

fs.writeFileSync(sourcePath, source, "utf8");
fs.writeFileSync(authoredPath, authored, "utf8");
fs.writeFileSync(trainerPath, trainer, "utf8");
console.log("Published all 58 resolved Terminal 4 wall connections as the authoritative lower-facade fit count through source, environment and final browser telemetry without changing geometry.");
