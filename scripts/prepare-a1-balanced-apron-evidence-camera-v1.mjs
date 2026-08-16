import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-balanced-apron-side-terminal-joint-camera-v1";
const framingMarker = "a1-terminal-joint-photo-framing-v3-generation-safe";
const cameraAuthority = "source-measured-a1-apron-side-evidence-camera-v5-balanced-branches";
let source = fs.readFileSync(trainerPath, "utf8");

const biasedBlock = `            const exactA1JointBiasedOutX = exactA1JointApronNormalX - exactA1JointWallUnitX * 0.40;
            const exactA1JointBiasedOutZ = exactA1JointApronNormalZ - exactA1JointWallUnitZ * 0.40;
            const exactA1JointBiasedOutLength = Math.hypot(exactA1JointBiasedOutX, exactA1JointBiasedOutZ);
            if (!(exactA1JointBiasedOutLength > 0.5)) {
              throw new Error(\`A1 passenger-joint apron-side camera vector collapsed: \${exactA1JointBiasedOutLength}\`);
            }
            const exactA1JointCameraOutX = exactA1JointBiasedOutX / exactA1JointBiasedOutLength;
            const exactA1JointCameraOutZ = exactA1JointBiasedOutZ / exactA1JointBiasedOutLength;`;

const balancedBlock = `            // ${marker}
            // The signed through-axis normal already selects the apron half-plane.
            // Do not bias it back toward/away from the terminal wall: adding a wall
            // component destroys the equal wall/Tunnel-A side-profile that the
            // through-axis camera mathematically guarantees.
            const exactA1JointCameraOutX = exactA1JointApronNormalX;
            const exactA1JointCameraOutZ = exactA1JointApronNormalZ;`;

if (!source.includes(marker)) {
  if (source.includes(biasedBlock)) {
    source = source.replace(biasedBlock, balancedBlock);
  } else {
    // Late production preparers can legitimately split, re-indent, or change the
    // declaration kind of the older camera pair. Normalize X and Z independently
    // by variable identity instead of requiring two adjacent historical `const`
    // statements. This remains fail-closed: there must be exactly one writable
    // binding/assignment for each final camera component.
    const cameraBindings = [
      ["X", "exactA1JointApronNormalX"],
      ["Z", "exactA1JointApronNormalZ"],
    ];
    let insertedMarker = false;
    for (const [axis, apronNormal] of cameraBindings) {
      const name = `exactA1JointCameraOut${axis}`;
      const bindingPattern = new RegExp(`\\b(?:(?:const|let|var)\\s+)?${name}\\s*=\\s*[^;\\n]+;`, "g");
      const matches = [...source.matchAll(bindingPattern)];
      if (matches.length !== 1) {
        throw new Error(`${trainerPath}: expected exactly one final A1 terminal-joint camera ${axis} binding/assignment, found ${matches.length}`);
      }
      const original = matches[0][0];
      const declaration = original.match(/^(const|let|var)\s+/)?.[1];
      const normalized = `${declaration ? `${declaration} ` : ""}${name} = ${apronNormal};`;
      const replacement = !insertedMarker
        ? `// ${marker}\n            // Final shipping camera normalized by variable identity after all late preparers.\n            ${normalized}`
        : normalized;
      source = source.slice(0, matches[0].index) + replacement + source.slice(matches[0].index + original.length);
      insertedMarker = true;
    }
  }
}

// Bind the terminal-joint branch nearest the normalized camera to the v5 authority.
// Do not replace unrelated bogie/full-assembly subview authorities elsewhere.
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) {
  throw new Error(`${trainerPath}: balanced A1 terminal-joint camera marker was not created`);
}
const authorityPattern = /renderer\.domElement\.dataset\.inspectionCameraEndpointSubviewAuthority = "[^"]+";/g;
const authorityMatches = [...source.matchAll(authorityPattern)].filter(match => match.index > markerIndex);
if (authorityMatches.length < 1) {
  throw new Error(`${trainerPath}: final A1 terminal-joint subview authority assignment is missing after the balanced camera`);
}
const nearestAuthority = authorityMatches[0][0];
source = source.slice(0, authorityMatches[0].index)
  + `renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "${cameraAuthority}";`
  + source.slice(authorityMatches[0].index + nearestAuthority.length);

// The v5 camera proved equal branch visibility numerically, but the fresh exact-head
// image still put the lens too close to the fixed corridor, so its side wall hid the
// actual Terminal 4 attachment. Preserve all geometry and strict camera-direction
// checks; only pull this diagnostic view farther back. Some late camera preparers no
// longer emit an explicit close-view FOV assignment, so widening 42->50 is optional
// when that exact generated statement exists and never a prerequisite for bundling.
if (!source.includes(framingMarker)) {
  const sideDistancePattern = /\bconst exactA1JointSideDistance = [^;\n]+;/g;
  const sideDistanceMatches = [...source.matchAll(sideDistancePattern)];
  if (sideDistanceMatches.length !== 1) {
    throw new Error(`${trainerPath}: expected exactly one A1 terminal-joint side-distance declaration, found ${sideDistanceMatches.length}`);
  }
  source = source.replace(
    sideDistancePattern,
    `// ${framingMarker}\n            const exactA1JointSideDistance = 22;`,
  );

  const fovNeedle = "inspectionCamera.fov = 42;";
  if (source.includes(fovNeedle)) {
    source = source.replace(fovNeedle, "inspectionCamera.fov = 50;");
  }
}

for (const forbidden of [
  "exactA1JointBiasedOutX",
  "exactA1JointBiasedOutZ",
  "exactA1JointBiasedOutLength",
  'inspectionCameraEndpointSubviewAuthority = "source-measured-a1-apron-side-evidence-camera-v4"',
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: stale imbalanced A1 terminal camera logic remains: ${forbidden}`);
}
for (const required of [
  marker,
  framingMarker,
  "exactA1JointCameraOutX = exactA1JointApronNormalX;",
  "exactA1JointCameraOutZ = exactA1JointApronNormalZ;",
  "const exactA1JointSideDistance = 22;",
  "exactA1JointApronHalfPlaneOffset > 2.5",
  "exactA1JointBranchViewImbalance < 0.20",
  `inspectionCameraEndpointSubviewAuthority = "${cameraAuthority}"`,
]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: balanced apron-side A1 evidence camera is missing ${required}`);
}

if (!source.includes("T4_WALK")) {
  throw new Error(`${trainerPath}: balanced apron-side A1 evidence camera lost T4_WALK exclusion/probe logic`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${cameraAuthority} + ${framingMarker}: A1 terminal-joint evidence normalizes the actual final generated camera components independently to the pure signed apron-side normal, keeps strict branch/T4_WALK checks, and pulls the close view back to 22 m without changing airport or jetway geometry.`);
