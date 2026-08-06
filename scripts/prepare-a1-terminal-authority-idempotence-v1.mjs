import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(runtimePath, "utf8");

const marker = "compact-grounded-A1-authority-idempotence-v31";
const oldValidation = `      if (!structuralAuthorities.has(terminalConnection.authority)) {
        throw new Error(\`A1 structural terminal-building search returned an invalid authority: \${terminalConnection.authority}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      terminalConnection.authority = \`structural-A1-terminal-building-\${terminalConnection.authority}-v28\`;`;
const oldIdempotentValidation = `      const alreadyQualifiedStructuralAuthority = terminalConnection.authority.startsWith("structural-A1-terminal-building-")
        && terminalConnection.authority.endsWith("-v28");
      if (!structuralAuthorities.has(terminalConnection.authority) && !alreadyQualifiedStructuralAuthority) {
        throw new Error(\`A1 structural terminal-building search returned an invalid authority: \${terminalConnection.authority}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      if (!alreadyQualifiedStructuralAuthority) {
        terminalConnection.authority = \`structural-A1-terminal-building-\${terminalConnection.authority}-v28\`;
      }`;
const groundedAssignment = "      terminalConnection = groundedConnection;";
const groundedValidation = `${groundedAssignment}
      // ${marker}
      const groundedStructuralAuthority = String(terminalConnection.authority || "");
      if (!groundedStructuralAuthority || /WALK|JETWAY|CONNECTOR|PORTAL/i.test(groundedStructuralAuthority)) {
        throw new Error(\`A1 compact grounded wall returned a forbidden authority: \${groundedStructuralAuthority}\`);
      }
      const alreadyQualifiedGroundedAuthority = groundedStructuralAuthority.startsWith("structural-A1-terminal-building-")
        && groundedStructuralAuthority.endsWith("-v31");
      if (!alreadyQualifiedGroundedAuthority) {
        terminalConnection.authority = \`structural-A1-terminal-building-\${groundedStructuralAuthority}-v31\`;
      }`;

let replacementCount = 0;
while (source.includes(oldValidation)) {
  source = source.replace(oldValidation, groundedValidation);
  replacementCount += 1;
}
while (source.includes(oldIdempotentValidation)) {
  source = source.replace(oldIdempotentValidation, groundedValidation);
  replacementCount += 1;
}
if (!source.includes(marker)) {
  if (!source.includes(groundedAssignment)) {
    throw new Error(`${runtimePath}: compact grounded A1 assignment is missing`);
  }
  source = source.replace(groundedAssignment, groundedValidation);
  replacementCount += 1;
}

for (const token of [
  marker,
  "const groundedStructuralAuthority = String(terminalConnection.authority || \"\")",
  "alreadyQualifiedGroundedAuthority",
  "terminalConnection.authority = `structural-A1-terminal-building-${groundedStructuralAuthority}-v31`",
  "A1 compact grounded wall returned a forbidden authority",
]) {
  if (!source.includes(token)) {
    throw new Error(`${runtimePath}: grounded A1 authority token is missing: ${token}`);
  }
}
for (const forbidden of [
  "exact-T4_WALK-A1-terminal-portal-v25",
  "exactWalkwayPortalX",
  "alreadyQualifiedStructuralAuthority",
  "structuralAuthorities.has(terminalConnection.authority)",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: stale or forbidden A1 authority behavior remains: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Validated ${Math.max(1, replacementCount)} compact grounded A1 authority path(s) idempotently without relying on the obsolete pre-grounding validator block.`);
