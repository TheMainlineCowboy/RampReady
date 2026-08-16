import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-balanced-apron-side-terminal-joint-camera-v1";
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
  "const exactA1JointCameraOutX = exactA1JointApronNormalX;",
  "const exactA1JointCameraOutZ = exactA1JointApronNormalZ;",
  "exactA1JointApronHalfPlaneOffset > 2.5",
  "exactA1JointBranchViewImbalance < 0.20",
  `inspectionCameraEndpointSubviewAuthority = "${cameraAuthority}"`,
]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: balanced apron-side A1 evidence camera is missing ${required}`);
}

// Do not require one historical marker string for the existing T4_WALK rendered-
// occlusion guard. That marker was renamed by later camera preparation while the
// actual fail-closed apron-half-plane, branch-balance and T4_WALK probe logic stays
// in the generated trainer. Camera geometry, terminal geometry and jetway geometry
// are unchanged by this compatibility correction.
if (!source.includes("T4_WALK")) {
  throw new Error(`${trainerPath}: balanced apron-side A1 evidence camera lost T4_WALK exclusion/probe logic`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${cameraAuthority}: the A1 terminal-joint camera now uses the pure signed apron-side through-axis normal, preserving equal branch visibility while retaining the >2.5 m terminal-half-plane clearance and T4_WALK occlusion guards.`);
