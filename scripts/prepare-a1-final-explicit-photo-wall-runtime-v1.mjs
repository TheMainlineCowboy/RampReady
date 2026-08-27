import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const AUTHORITY = "a1-final-explicit-bgate1-photo-wall-runtime-v1";
const EXPLICIT_WALL_AUTHORITY = "a1-real-photo-explicit-terminal-wall-v1";

let source = fs.readFileSync(sourcePath, "utf8");

const oldBlock = `  const measuredWallX = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallX);\n  const measuredWallZ = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallZ);\n  if (![measuredWallX, measuredWallZ].every(Number.isFinite)) {\n    throw new Error("A1 measured structural Terminal 4 wall point is missing");\n  }`;

const newBlock = `  // ${AUTHORITY}\n  // The Aug. 15 overhead photo shows that A1's fixed corridor must physically\n  // leave the real BGATE1 facade. Late legacy wall telemetry can still describe\n  // the retired compact 3-4 m sleeve, so the final A1 runtime must take its wall\n  // endpoint directly from the explicit source-placement fields instead.\n  const explicitPhotoWallAuthority = String(placement.explicitTerminalWallAuthority || "");\n  if (explicitPhotoWallAuthority !== "${EXPLICIT_WALL_AUTHORITY}") {\n    throw new Error(\`A1 final photo wall authority is invalid: \${explicitPhotoWallAuthority}\`);\n  }\n  const measuredWallX = Number(placement.terminalWallX);\n  const measuredWallZ = Number(placement.terminalWallZ);\n  if (![measuredWallX, measuredWallZ].every(Number.isFinite)) {\n    throw new Error("A1 explicit BGATE1 Terminal 4 wall endpoint is missing");\n  }\n  group.userData.uploadedJetwayA1MeasuredTerminalWallX = measuredWallX;\n  group.userData.uploadedJetwayA1MeasuredTerminalWallZ = measuredWallZ;\n  group.userData.uploadedJetwayA1FinalPhotoWallAuthority = "${AUTHORITY}";`;

if (!source.includes(AUTHORITY)) {
  if (!source.includes(oldBlock)) {
    throw new Error(`${sourcePath}: final A1 measured-wall block is missing; refusing to guess a facade endpoint`);
  }
  source = source.replace(oldBlock, newBlock);
}

for (const required of [
  AUTHORITY,
  "placement.explicitTerminalWallAuthority",
  "const measuredWallX = Number(placement.terminalWallX);",
  "const measuredWallZ = Number(placement.terminalWallZ);",
  "uploadedJetwayA1FinalPhotoWallAuthority",
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: final explicit photo-wall binding is missing ${required}`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${AUTHORITY}: final A1 fixed-corridor construction now starts at the explicit BGATE1 facade endpoint instead of stale compact-sleeve telemetry; terminal, aircraft and Airport_Jetway.glb remain unchanged.`);
