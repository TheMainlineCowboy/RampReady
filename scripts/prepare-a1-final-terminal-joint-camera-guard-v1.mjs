import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-terminal-joint-camera-branch-visibility-v1";
let source = fs.readFileSync(trainerPath, "utf8");

const balancedCosineGuard = /(\s*)if \(!\(exactA1JointWallViewCosine < 0\.82\s*&& exactA1JointTunnelAViewCosine < 0\.82\s*&& exactA1JointBranchViewImbalance < 0\.20\)\) \{/;
const legacySideOnGuard = /(\s*)if \(!\(wallSideOn < 0\.44\s*&& tunnelASideOn < 0\.44\)\) \{/;

if (!source.includes(marker)) {
  const balancedMatch = source.match(balancedCosineGuard);
  const sideOnMatch = source.match(legacySideOnGuard);
  if (!balancedMatch && !sideOnMatch) {
    throw new Error(`${trainerPath}: final A1 terminal-joint camera guard was not found`);
  }

  if (balancedMatch) {
    const indent = balancedMatch[1];
    const replacement = `${indent}// ${marker}\n${indent}// A balanced passenger-height view can legitimately have a large cosine\n${indent}// to both elbow branches. Require actual perpendicular branch visibility\n${indent}// and retain the fail-closed branch-balance check.\n${indent}const exactA1JointWallPerpendicularVisibility = Math.sqrt(\n${indent}  Math.max(0, 1 - exactA1JointWallViewCosine ** 2),\n${indent});\n${indent}const exactA1JointTunnelAPerpendicularVisibility = Math.sqrt(\n${indent}  Math.max(0, 1 - exactA1JointTunnelAViewCosine ** 2),\n${indent});\n${indent}if (!(exactA1JointWallPerpendicularVisibility > 0.34\n${indent}  && exactA1JointTunnelAPerpendicularVisibility > 0.34\n${indent}  && exactA1JointBranchViewImbalance < 0.20)) {`;
    source = source.replace(balancedCosineGuard, replacement);
  } else {
    const indent = sideOnMatch[1];
    const replacement = `${indent}// ${marker}\n${indent}// This older guard used branch-direction cosines directly. Convert them\n${indent}// to perpendicular visibility so a balanced passenger-height elbow view\n${indent}// is accepted while an axis-on hidden branch still fails closed.\n${indent}const exactA1JointWallPerpendicularVisibility = Math.sqrt(\n${indent}  Math.max(0, 1 - wallSideOn ** 2),\n${indent});\n${indent}const exactA1JointTunnelAPerpendicularVisibility = Math.sqrt(\n${indent}  Math.max(0, 1 - tunnelASideOn ** 2),\n${indent});\n${indent}const exactA1JointBranchViewImbalance = Math.abs(wallSideOn - tunnelASideOn);\n${indent}if (!(exactA1JointWallPerpendicularVisibility > 0.34\n${indent}  && exactA1JointTunnelAPerpendicularVisibility > 0.34\n${indent}  && exactA1JointBranchViewImbalance < 0.20)) {`;
    source = source.replace(legacySideOnGuard, replacement);
  }
}

for (const token of [
  marker,
  "exactA1JointWallPerpendicularVisibility",
  "exactA1JointTunnelAPerpendicularVisibility",
  "exactA1JointBranchViewImbalance < 0.20",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: final A1 camera guard is missing ${token}`);
  }
}
for (const stale of [
  "exactA1JointWallViewCosine < 0.82",
  "exactA1JointTunnelAViewCosine < 0.82",
  "wallSideOn < 0.44",
  "tunnelASideOn < 0.44",
]) {
  if (source.includes(stale)) {
    throw new Error(`${trainerPath}: stale A1 camera visibility cutoff remains: ${stale}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Finalized the shipping A1 terminal-joint evidence camera with perpendicular branch-visibility and balance checks; balanced passenger-height elbow views pass while axis-on hidden branches still fail closed.");
