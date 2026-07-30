import fs from "node:fs";

function insertAfter(path, anchor, addition, marker, label) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(anchor)) throw new Error(`${path}: missing ${label} anchor`);
  source = source.replace(anchor, `${anchor}\n${addition}`);
  fs.writeFileSync(path, source, "utf8");
}

const terminalPath = "src/environment/authoredTerminal4Visual.js";
insertAfter(
  terminalPath,
  "  environment.userData.authoredTerminal4A1JetwayWallDistance = sourcePlacedJetways.userData.a1TerminalWallDistance;",
  "  environment.userData.authoredTerminal4A1DoorContactErrorMeters = sourcePlacedJetways.userData.a1DoorContactErrorMeters;",
  "authoredTerminal4A1DoorContactErrorMeters",
  "A1 door-contact runtime evidence",
);

const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
insertAfter(
  runtimePath,
  '    renderer.domElement.dataset.terminal4A1JetwayWallDistance = "loading";',
  '    renderer.domElement.dataset.terminal4A1DoorContactErrorMeters = "loading";',
  "dataset.terminal4A1DoorContactErrorMeters = \"loading\"",
  "A1 door-contact dataset initialization",
);
insertAfter(
  runtimePath,
  `        renderer.domElement.dataset.terminal4A1JetwayWallDistance = Number.isFinite(environment.userData.authoredTerminal4A1JetwayWallDistance)
          ? environment.userData.authoredTerminal4A1JetwayWallDistance.toFixed(3)
          : "missing";`,
  `        renderer.domElement.dataset.terminal4A1DoorContactErrorMeters = Number.isFinite(environment.userData.authoredTerminal4A1DoorContactErrorMeters)
          ? environment.userData.authoredTerminal4A1DoorContactErrorMeters.toFixed(3)
          : "missing";`,
  "dataset.terminal4A1DoorContactErrorMeters = Number.isFinite",
  "A1 door-contact dataset value",
);
insertAfter(
  runtimePath,
  '        renderer.domElement.dataset.terminal4A1JetwayWallDistance = "load-error";',
  '        renderer.domElement.dataset.terminal4A1DoorContactErrorMeters = "load-error";',
  "dataset.terminal4A1DoorContactErrorMeters = \"load-error\"",
  "A1 door-contact dataset error state",
);

for (const [path, tokens] of [
  [terminalPath, ["authoredTerminal4A1DoorContactErrorMeters", "sourcePlacedJetways.userData.a1DoorContactErrorMeters"]],
  [runtimePath, [
    'dataset.terminal4A1DoorContactErrorMeters = "loading"',
    "dataset.terminal4A1DoorContactErrorMeters = Number.isFinite",
    'dataset.terminal4A1DoorContactErrorMeters = "load-error"',
  ]],
]) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${path}: missing CRJ runtime evidence ${token}`);
}

console.log("Prepared measured A1 CRJ door-contact runtime evidence in the terminal environment and browser dataset.");
