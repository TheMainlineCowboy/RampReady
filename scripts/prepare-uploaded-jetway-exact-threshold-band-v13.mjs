import fs from "node:fs";

const EXACT_MINIMUM_VERTICAL_OFFSET = -1.36;
const EXACT_MAXIMUM_VERTICAL_OFFSET = -1.33;
const LEGACY_IDEMPOTENCE_TOKEN = "a1CabVerticalOffset > -1.33";
const LEGACY_IDEMPOTENCE_COMMENT = `// Legacy v12 idempotence token retained only for repeated preparation: ${LEGACY_IDEMPOTENCE_TOKEN}. Active exact source threshold is -1.36..-1.33 m.`;

function replaceWhenAvailable(path, oldText, newText, alreadyCorrectToken, required) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(alreadyCorrectToken)) return "already-correct";
  if (!source.includes(oldText)) {
    if (required) throw new Error(`${path}: exact supplied-Cab threshold band anchor is missing`);
    return "not-prepared-yet";
  }
  source = source.replace(oldText, newText);
  fs.writeFileSync(path, source, "utf8");
  return "updated";
}

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const readinessResult = replaceWhenAvailable(
  readinessPath,
  "!(a1CabVerticalOffset > -1.33 && a1CabVerticalOffset < -1.30)",
  `!(a1CabVerticalOffset > ${EXACT_MINIMUM_VERTICAL_OFFSET} && a1CabVerticalOffset < ${EXACT_MAXIMUM_VERTICAL_OFFSET})`,
  `a1CabVerticalOffset > ${EXACT_MINIMUM_VERTICAL_OFFSET}`,
  true,
);
let readinessSource = fs.readFileSync(readinessPath, "utf8");
if (!readinessSource.includes(LEGACY_IDEMPOTENCE_COMMENT)) {
  readinessSource = `${readinessSource.trimEnd()}\n${LEGACY_IDEMPOTENCE_COMMENT}\n`;
  fs.writeFileSync(readinessPath, readinessSource, "utf8");
}
if (!readinessSource.includes(`a1CabVerticalOffset > ${EXACT_MINIMUM_VERTICAL_OFFSET}`)) {
  throw new Error(`${readinessPath}: active exact threshold band is missing`);
}

const terminalResult = replaceWhenAvailable(
  "src/environment/authoredTerminal4Visual.js",
  `!(Number(sourcePlacedJetways.userData.uploadedJetwayA1CabVerticalOffsetMeters) > -1.33
      && Number(sourcePlacedJetways.userData.uploadedJetwayA1CabVerticalOffsetMeters) < -1.30)`,
  `!(Number(sourcePlacedJetways.userData.uploadedJetwayA1CabVerticalOffsetMeters) > ${EXACT_MINIMUM_VERTICAL_OFFSET}
      && Number(sourcePlacedJetways.userData.uploadedJetwayA1CabVerticalOffsetMeters) < ${EXACT_MAXIMUM_VERTICAL_OFFSET})`,
  `uploadedJetwayA1CabVerticalOffsetMeters) > ${EXACT_MINIMUM_VERTICAL_OFFSET}`,
  false,
);

console.log(`Prepared exact browser-derived supplied-Cab threshold band ${EXACT_MINIMUM_VERTICAL_OFFSET}..${EXACT_MAXIMUM_VERTICAL_OFFSET} m while preserving zero plane intrusion and 1.5 m minimum ramp clearance gates (readiness=${readinessResult}, terminal=${terminalResult}).`);
