import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-balanced-apron-side-terminal-joint-camera-v1";
const framingMarker = "a1-terminal-joint-photo-framing-v2";
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
  if (!source.includes(biasedBlock)) {
    throw new Error(`${trainerPath}: A1 v4 apron-side terminal camera bias block is missing`);
  }
  source = source.replace(biasedBlock, balancedBlock);
  source = source.replace(
    'renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "source-measured-a1-apron-side-evidence-camera-v4";',
    `renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "${cameraAuthority}";`,
  );
}

// The v5 camera proved equal branch visibility numerically, but the fresh exact-head
// image still put the lens too close to the fixed corridor, so its side wall hid the
// actual Terminal 4 attachment. Preserve all geometry and strict camera-direction
// checks; only pull this diagnostic view farther back and widen its FOV. Do not depend
// on a historical camera-height variable because late camera preparers no longer emit
// that declaration consistently.
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
  const fovCount = source.split(fovNeedle).length - 1;
  if (fovCount < 1) {
    throw new Error(`${trainerPath}: A1 terminal-joint FOV anchor is missing`);
  }
  // The terminal-joint callback is the first prepared close-evidence FOV assignment.
  source = source.replace(fovNeedle, "inspectionCamera.fov = 50;");
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
  "const exactA1JointCameraOutX = exactA1JointApronNormalX;",
  "const exactA1JointCameraOutZ = exactA1JointApronNormalZ;",
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
console.log(`Prepared ${cameraAuthority} + ${framingMarker}: A1 terminal-joint evidence keeps the pure signed apron-side normal and strict branch/T4_WALK checks while pulling the close view back to 22 m and widening it to 50 degrees so the fixed corridor cannot hide the real facade joint.`);
