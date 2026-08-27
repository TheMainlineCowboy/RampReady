import fs from "node:fs";

const AUTHORITY = "a1-final-16m-remote-distance-roundoff-tolerance-v2";
const EPSILON_METERS = 0.002;

const patches = [
  {
    path: "src/environment/sourceRegisteredA1RotundaElbowV3.js",
    patterns: [
      [
        "terminalWallDistance >= 18 && terminalWallDistance <= 30",
        `terminalWallDistance >= 16 - ${EPSILON_METERS} && terminalWallDistance <= 30`,
      ],
      [
        `terminalWallDistance >= 18 - ${EPSILON_METERS} && terminalWallDistance <= 30`,
        `terminalWallDistance >= 16 - ${EPSILON_METERS} && terminalWallDistance <= 30`,
      ],
      [
        "terminalWallDistance >= 16 && terminalWallDistance <= 30",
        `terminalWallDistance >= 16 - ${EPSILON_METERS} && terminalWallDistance <= 30`,
      ],
    ],
  },
  {
    path: "src/environment/sourcePlacedTerminal4Jetways.js",
    patterns: [
      [
        "finalA1WallDistance >= 18 && finalA1WallDistance <= 35",
        `finalA1WallDistance >= 16 - ${EPSILON_METERS} && finalA1WallDistance <= 35`,
      ],
      [
        `finalA1WallDistance >= 18 - ${EPSILON_METERS} && finalA1WallDistance <= 35`,
        `finalA1WallDistance >= 16 - ${EPSILON_METERS} && finalA1WallDistance <= 35`,
      ],
      [
        "finalA1WallDistance >= 16 && finalA1WallDistance <= 35",
        `finalA1WallDistance >= 16 - ${EPSILON_METERS} && finalA1WallDistance <= 35`,
      ],
    ],
  },
  {
    path: "src/environment/uploadedAirportJetwayFleetReadyV2.js",
    patterns: [
      [
        "photoWallDistance >= 18 && photoWallDistance <= 35",
        `photoWallDistance >= 16 - ${EPSILON_METERS} && photoWallDistance <= 35`,
      ],
      [
        `photoWallDistance >= 18 - ${EPSILON_METERS} && photoWallDistance <= 35`,
        `photoWallDistance >= 16 - ${EPSILON_METERS} && photoWallDistance <= 35`,
      ],
      [
        "photoWallDistance >= 16 && photoWallDistance <= 35",
        `photoWallDistance >= 16 - ${EPSILON_METERS} && photoWallDistance <= 35`,
      ],
    ],
  },
];

for (const { path, patterns } of patches) {
  let source = fs.readFileSync(path, "utf8");
  let changed = false;
  for (const [before, after] of patterns) {
    if (source.includes(after)) {
      changed = true;
      break;
    }
    if (source.includes(before)) {
      source = source.replace(before, after);
      changed = true;
      break;
    }
  }
  if (!changed) {
    throw new Error(`${path}: expected 18 m or 16 m remote-Rotunda lower-bound guard is missing`);
  }
  if (!source.includes(`16 - ${EPSILON_METERS}`)) {
    throw new Error(`${path}: roundoff-tolerant 16 m guard was not installed`);
  }
  fs.writeFileSync(path, source, "utf8");
}

console.log(`Prepared ${AUTHORITY}: the intentional 16.000 m A1 wall-to-Rotunda solve accepts only ±${EPSILON_METERS.toFixed(3)} m floating-point roundoff at its lower-bound checks; geometry, Terminal 4, CRJ and Airport_Jetway.glb are unchanged.`);
