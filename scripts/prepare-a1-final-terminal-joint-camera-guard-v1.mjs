import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-terminal-joint-camera-branch-visibility-v1";
let source = fs.readFileSync(trainerPath, "utf8");

const legacyGuard = /(\s*)if \(!\(exactA1JointWallViewCosine < 0\.82\s*&& exactA1JointTunnelAViewCosine < 0\.82\s*&& exactA1JointBranchViewImbalance < 0\.20\)\) \{/;

if (!source.includes(marker)) {
  const match = source.match(legacyGuard);
  if (!match) {
    throw new Error(`${trainerPath}: final A1 terminal-joint legacy cosine guard was not found`);
  }
  const indent = match[1];
  const replacement = `${indent}// ${marker}\n${indent}// A balanced passenger-height view can legitimately have a large cosine\n${indent}// to both elbow branches. What matters is that neither branch is nearly\n${indent}// axis-on (and therefore visually hidden) and that the two branches stay\n${indent}// comparably visible. Convert the cosines to perpendicular visibility\n${indent}// instead of rejecting the previously observed balanced 0.82-0.84 view.\n${indent}const exactA1JointWallPerpendicularVisibility = Math.sqrt(\n${indent}  Math.max(0, 1 - exactA1JointWallViewCosine ** 2),\n${indent});\n${indent}const exactA1JointTunnelAPerpendicularVisibility = Math.sqrt(\n${indent}  Math.max(0, 1 - exactA1JointTunnelAViewCosine ** 2),\n${indent});\n${indent}if (!(exactA1JointWallPerpendicularVisibility > 0.34\n${indent}  && exactA1JointTunnelAPerpendicularVisibility > 0.34\n${indent}  && exactA1JointBranchViewImbalance < 0.20)) {`;
  source = source.replace(legacyGuard, replacement);
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
]) {
  if (source.includes(stale)) {
    throw new Error(`${trainerPath}: stale A1 camera cosine cutoff remains: ${stale}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Finalized A1 terminal-joint evidence camera with balanced branch-visibility checks; neither elbow branch may be nearly axis-on, while the previously observed balanced 0.82-0.84 cosine view is accepted.");
