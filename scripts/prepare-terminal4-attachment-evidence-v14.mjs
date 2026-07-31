import fs from "node:fs";

const authoredPath = "src/environment/authoredTerminal4Visual.js";
const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let authored = fs.readFileSync(authoredPath, "utf8");
let trainer = fs.readFileSync(trainerPath, "utf8");

const authoredMarker = "authoredTerminal4A1TerminalConnectionAuthority";
if (!authored.includes(authoredMarker)) {
  const anchor = `  environment.userData.authoredTerminal4A1JetwayWallDistance = sourcePlacedJetways.userData.a1TerminalWallDistance;`;
  const replacement = `${anchor}
  environment.userData.authoredTerminal4A1TerminalConnectionAuthority = sourcePlacedJetways.userData.a1TerminalConnectionAuthority;
  environment.userData.authoredTerminal4A1TerminalConnectionDirection = sourcePlacedJetways.userData.a1TerminalConnectionDirection;
  environment.userData.authoredTerminal4FixedWalkwaySupportStationCount = sourcePlacedJetways.userData.fixedWalkwaySupportStationCount ?? 0;
  environment.userData.authoredTerminal4FixedWalkwayGroundSupportAuthority = sourcePlacedJetways.userData.fixedWalkwayGroundSupportAuthority || "missing";`;
  if (!authored.includes(anchor)) throw new Error(`${authoredPath}: missing A1 wall-distance evidence anchor`);
  authored = authored.replace(anchor, replacement);
}

const loadingMarker = 'renderer.domElement.dataset.terminal4A1ConnectionAuthority = "loading";';
if (!trainer.includes(loadingMarker)) {
  const anchor = '    renderer.domElement.dataset.terminal4A1JetwayWallDistance = "loading";';
  const replacement = `${anchor}
    renderer.domElement.dataset.terminal4A1ConnectionAuthority = "loading";
    renderer.domElement.dataset.terminal4A1ConnectionDirection = "loading";
    renderer.domElement.dataset.terminal4FixedWalkwaySupportStationCount = "loading";
    renderer.domElement.dataset.terminal4FixedWalkwayGroundSupportAuthority = "loading";`;
  if (!trainer.includes(anchor)) throw new Error(`${trainerPath}: missing A1 loading evidence anchor`);
  trainer = trainer.replace(anchor, replacement);
}

const readyMarker = "dataset.terminal4A1ConnectionAuthority = environment.userData.authoredTerminal4A1TerminalConnectionAuthority";
if (!trainer.includes(readyMarker)) {
  const anchor = `        renderer.domElement.dataset.terminal4A1JetwayWallDistance = Number.isFinite(environment.userData.authoredTerminal4A1JetwayWallDistance)
          ? environment.userData.authoredTerminal4A1JetwayWallDistance.toFixed(3)
          : "missing";`;
  const replacement = `${anchor}
        renderer.domElement.dataset.terminal4A1ConnectionAuthority = environment.userData.authoredTerminal4A1TerminalConnectionAuthority || "missing";
        renderer.domElement.dataset.terminal4A1ConnectionDirection = Array.isArray(environment.userData.authoredTerminal4A1TerminalConnectionDirection)
          ? environment.userData.authoredTerminal4A1TerminalConnectionDirection.map((value) => Number(value).toFixed(6)).join(",")
          : "missing";
        renderer.domElement.dataset.terminal4FixedWalkwaySupportStationCount = String(environment.userData.authoredTerminal4FixedWalkwaySupportStationCount ?? 0);
        renderer.domElement.dataset.terminal4FixedWalkwayGroundSupportAuthority = environment.userData.authoredTerminal4FixedWalkwayGroundSupportAuthority || "missing";`;
  if (!trainer.includes(anchor)) throw new Error(`${trainerPath}: missing A1 ready evidence anchor`);
  trainer = trainer.replace(anchor, replacement);
}

const errorMarker = 'renderer.domElement.dataset.terminal4A1ConnectionAuthority = "load-error";';
if (!trainer.includes(errorMarker)) {
  const anchor = '        renderer.domElement.dataset.terminal4A1JetwayWallDistance = "load-error";';
  const replacement = `${anchor}
        renderer.domElement.dataset.terminal4A1ConnectionAuthority = "load-error";
        renderer.domElement.dataset.terminal4A1ConnectionDirection = "load-error";
        renderer.domElement.dataset.terminal4FixedWalkwaySupportStationCount = "load-error";
        renderer.domElement.dataset.terminal4FixedWalkwayGroundSupportAuthority = "load-error";`;
  if (!trainer.includes(anchor)) throw new Error(`${trainerPath}: missing A1 error evidence anchor`);
  trainer = trainer.replace(anchor, replacement);
}

for (const token of [
  authoredMarker,
  "authoredTerminal4FixedWalkwaySupportStationCount",
  loadingMarker,
  readyMarker,
  errorMarker,
  "terminal4FixedWalkwayGroundSupportAuthority",
]) {
  if (!authored.includes(token) && !trainer.includes(token)) {
    throw new Error(`Terminal 4 attachment evidence is missing ${token}`);
  }
}

fs.writeFileSync(authoredPath, authored, "utf8");
fs.writeFileSync(trainerPath, trainer, "utf8");
console.log("Prepared browser-visible A1 exact wall-plane authority, connection direction and grounded fixed-walkway support evidence.");
