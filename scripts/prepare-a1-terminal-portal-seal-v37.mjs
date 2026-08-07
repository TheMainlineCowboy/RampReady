import fs from "node:fs";

function replaceRequired(source, oldText, newText, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(oldText)) throw new Error(`Missing ${label} anchor`);
  return source.replace(oldText, newText);
}

const polishPath = "src/environment/terminal4JetwaySimulatorPolishV13.js";
const disabledModulePath = "src/environment/a1TerminalPortalSealV37.js";
let polish = fs.readFileSync(polishPath, "utf8");

// Keep the historical hook only as a compatibility call into the disabled
// installer. The installer must never add A1 geometry at the elevated walkway.
polish = replaceRequired(
  polish,
  'import * as THREE from "three";',
  'import * as THREE from "three";\nimport { installA1TerminalPortalSealV37 } from "./a1TerminalPortalSealV37.js";',
  'import { installA1TerminalPortalSealV37 } from "./a1TerminalPortalSealV37.js";',
  "disabled A1 legacy portal compatibility import",
);
polish = replaceRequired(
  polish,
  "  const fixedWalkwaySupportStationCount = installFixedWalkwayGroundSupports(group, walkwayRecords);",
  "  const fixedWalkwaySupportStationCount = installFixedWalkwayGroundSupports(group, walkwayRecords);\n  const a1TerminalPortalSeal = installA1TerminalPortalSealV37(group);",
  "const a1TerminalPortalSeal = installA1TerminalPortalSealV37(group);",
  "disabled A1 legacy portal compatibility call",
);
polish = replaceRequired(
  polish,
  '  group.userData.fixedWalkwayGroundSupportAuthority = "source-placed-fixed-walkway-ground-supports-v14";',
  '  group.userData.fixedWalkwayGroundSupportAuthority = "source-placed-fixed-walkway-ground-supports-v14";\n  group.userData.a1TerminalPortalSealAuthority = a1TerminalPortalSeal.userData.authority;\n  group.userData.a1TerminalPortalSealOverlapMeters = a1TerminalPortalSeal.userData.portalOverlapMeters;\n  group.userData.a1TerminalPortalSealExactTexture = a1TerminalPortalSeal.userData.usesExactRecoveredJetwayTexture === true;',
  "group.userData.a1TerminalPortalSealExactTexture = a1TerminalPortalSeal.userData.usesExactRecoveredJetwayTexture === true;",
  "disabled A1 legacy portal telemetry",
);
fs.writeFileSync(polishPath, polish, "utf8");

const visualPath = "src/environment/authoredTerminal4Visual.js";
let visual = fs.readFileSync(visualPath, "utf8");
visual = replaceRequired(
  visual,
  "  environment.userData.authoredTerminal4JetwayTerminalConnectionAuthority = sourcePlacedJetways.userData.terminalConnectionAuthority;",
  "  environment.userData.authoredTerminal4JetwayTerminalConnectionAuthority = sourcePlacedJetways.userData.terminalConnectionAuthority;\n  environment.userData.authoredTerminal4A1TerminalPortalSealAuthority = sourcePlacedJetways.userData.a1TerminalPortalSealAuthority;\n  environment.userData.authoredTerminal4A1TerminalPortalSealOverlapMeters = sourcePlacedJetways.userData.a1TerminalPortalSealOverlapMeters;\n  environment.userData.authoredTerminal4A1TerminalPortalSealExactTexture = sourcePlacedJetways.userData.a1TerminalPortalSealExactTexture === true;",
  "authoredTerminal4A1TerminalPortalSealExactTexture",
  "disabled A1 legacy portal environment telemetry",
);
fs.writeFileSync(visualPath, visual, "utf8");

const disabledModule = fs.readFileSync(disabledModulePath, "utf8");
for (const required of [
  'legacy-a1-walkway-portal-disabled-real-terminal-wall-v38',
  'jetwayGroup.userData.a1TerminalPortalSealDisabled = true',
  'jetwayGroup.userData.a1TerminalPortalSealOverlapMeters = 0',
  'jetwayGroup.userData.a1TerminalPortalSealExactTexture = false',
]) {
  if (!disabledModule.includes(required)) {
    throw new Error(`${disabledModulePath}: disabled legacy A1 portal contract missing ${required}`);
  }
}
for (const forbidden of [
  'A1_SOURCE_PORTAL',
  'exact-T4_WALK-source-shell-overlap-and-framed-portal-v37',
  'jetwayGroup.add(root)',
  'A1_T4_WALK_SourceTexturedOverlapShell_V37',
  'A1_T4_WALK_PortalFrame_V37',
]) {
  if (disabledModule.includes(forbidden)) {
    throw new Error(`${disabledModulePath}: obsolete elevated-walkway A1 geometry remains: ${forbidden}`);
  }
}

console.log("Disabled the obsolete A1 elevated-walkway portal geometry; the complete uploaded jetway now relies exclusively on the measured real Terminal 4 wall attachment.");
