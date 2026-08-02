import fs from "node:fs";

function replaceRequired(source, oldText, newText, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(oldText)) throw new Error(`Missing ${label} anchor`);
  return source.replace(oldText, newText);
}

const polishPath = "src/environment/terminal4JetwaySimulatorPolishV13.js";
let polish = fs.readFileSync(polishPath, "utf8");
polish = replaceRequired(
  polish,
  'import * as THREE from "three";',
  'import * as THREE from "three";\nimport { installA1TerminalPortalSealV37 } from "./a1TerminalPortalSealV37.js";',
  'import { installA1TerminalPortalSealV37 } from "./a1TerminalPortalSealV37.js";',
  "A1 portal seal import",
);
polish = replaceRequired(
  polish,
  "  const fixedWalkwaySupportStationCount = installFixedWalkwayGroundSupports(group, walkwayRecords);",
  "  const fixedWalkwaySupportStationCount = installFixedWalkwayGroundSupports(group, walkwayRecords);\n  const a1TerminalPortalSeal = installA1TerminalPortalSealV37(group);",
  "const a1TerminalPortalSeal = installA1TerminalPortalSealV37(group);",
  "A1 portal seal installation",
);
polish = replaceRequired(
  polish,
  '  group.userData.fixedWalkwayGroundSupportAuthority = "source-placed-fixed-walkway-ground-supports-v14";',
  '  group.userData.fixedWalkwayGroundSupportAuthority = "source-placed-fixed-walkway-ground-supports-v14";\n  group.userData.a1TerminalPortalSealAuthority = a1TerminalPortalSeal.userData.authority;\n  group.userData.a1TerminalPortalSealOverlapMeters = a1TerminalPortalSeal.userData.portalOverlapMeters;\n  group.userData.a1TerminalPortalSealExactTexture = a1TerminalPortalSeal.userData.usesExactRecoveredJetwayTexture === true;',
  "group.userData.a1TerminalPortalSealExactTexture = a1TerminalPortalSeal.userData.usesExactRecoveredJetwayTexture === true;",
  "A1 portal seal evidence",
);
fs.writeFileSync(polishPath, polish, "utf8");

const visualPath = "src/environment/authoredTerminal4Visual.js";
let visual = fs.readFileSync(visualPath, "utf8");
visual = replaceRequired(
  visual,
  "  environment.userData.authoredTerminal4JetwayTerminalConnectionAuthority = sourcePlacedJetways.userData.terminalConnectionAuthority;",
  "  environment.userData.authoredTerminal4JetwayTerminalConnectionAuthority = sourcePlacedJetways.userData.terminalConnectionAuthority;\n  environment.userData.authoredTerminal4A1TerminalPortalSealAuthority = sourcePlacedJetways.userData.a1TerminalPortalSealAuthority;\n  environment.userData.authoredTerminal4A1TerminalPortalSealOverlapMeters = sourcePlacedJetways.userData.a1TerminalPortalSealOverlapMeters;\n  environment.userData.authoredTerminal4A1TerminalPortalSealExactTexture = sourcePlacedJetways.userData.a1TerminalPortalSealExactTexture === true;",
  "authoredTerminal4A1TerminalPortalSealExactTexture",
  "A1 portal seal environment evidence",
);
fs.writeFileSync(visualPath, visual, "utf8");

for (const [filePath, tokens] of [
  [polishPath, [
    'installA1TerminalPortalSealV37 } from "./a1TerminalPortalSealV37.js"',
    "const a1TerminalPortalSeal = installA1TerminalPortalSealV37(group);",
    "a1TerminalPortalSealOverlapMeters",
  ]],
  [visualPath, [
    "authoredTerminal4A1TerminalPortalSealAuthority",
    "authoredTerminal4A1TerminalPortalSealOverlapMeters",
    "authoredTerminal4A1TerminalPortalSealExactTexture",
  ]],
]) {
  const prepared = fs.readFileSync(filePath, "utf8");
  for (const token of tokens) {
    if (!prepared.includes(token)) throw new Error(`${filePath}: A1 portal seal preparation missing ${token}`);
  }
}

console.log("Prepared the A1 T4_WALK portal seal v37 with exact-source jetway shell overlap, a framed terminal doorway and runtime evidence.");
