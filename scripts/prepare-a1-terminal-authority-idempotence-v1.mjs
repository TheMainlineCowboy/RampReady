import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(runtimePath, "utf8");

const marker = "compact-grounded-A1-authority-idempotence-v31";
const qualifiedAuthorityTemplate = "structural-A1-terminal-building-${groundedStructuralAuthority}-v31";
const legacyStructuralMembership = "structuralAuthorities" + ".has(terminalConnection.authority)";
const oldValidation = `      if (!${legacyStructuralMembership}) {
        throw new Error(\`A1 structural terminal-building search returned an invalid authority: \${terminalConnection.authority}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      terminalConnection.authority = \`structural-A1-terminal-building-\${terminalConnection.authority}-v28\`;`;
const oldIdempotentValidation = `      const alreadyQualifiedStructuralAuthority = terminalConnection.authority.startsWith("structural-A1-terminal-building-")
        && terminalConnection.authority.endsWith("-v28");
      if (!${legacyStructuralMembership} && !alreadyQualifiedStructuralAuthority) {
        throw new Error(\`A1 structural terminal-building search returned an invalid authority: \${terminalConnection.authority}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      if (!alreadyQualifiedStructuralAuthority) {
        terminalConnection.authority = \`structural-A1-terminal-building-\${terminalConnection.authority}-v28\`;
      }`;
const groundedAssignment = "      terminalConnection = groundedConnection;";
const groundedValidationOnly = `      // ${marker}
      const groundedStructuralAuthority = String(terminalConnection.authority || "");
      if (!groundedStructuralAuthority || /WALK|JETWAY|CONNECTOR|PORTAL/i.test(groundedStructuralAuthority)) {
        throw new Error(\`A1 compact grounded wall returned a forbidden authority: \${groundedStructuralAuthority}\`);
      }
      const alreadyQualifiedGroundedAuthority = groundedStructuralAuthority.startsWith("structural-A1-terminal-building-")
        && groundedStructuralAuthority.endsWith("-v31");
      if (!alreadyQualifiedGroundedAuthority) {
        terminalConnection.authority = \`structural-A1-terminal-building-\${groundedStructuralAuthority}-v31\`;
      }`;

// Remove every historical validator first. Replacing those blocks with the
// grounded assignment leaked the block-scoped groundedConnection identifier
// into later scopes and crashed Terminal 4 at runtime. The assignment belongs
// only in the A1 block created by the grounded-wall preparer; validators use the
// surviving terminalConnection value after that assignment.
let removedLegacyValidationCount = 0;
while (source.includes(oldValidation)) {
  source = source.replace(oldValidation, "");
  removedLegacyValidationCount += 1;
}
while (source.includes(oldIdempotentValidation)) {
  source = source.replace(oldIdempotentValidation, "");
  removedLegacyValidationCount += 1;
}

const assignmentCountBefore = source.split(groundedAssignment).length - 1;
if (assignmentCountBefore !== 1) {
  throw new Error(`${runtimePath}: expected exactly one block-scoped grounded A1 assignment, found ${assignmentCountBefore}`);
}
if (!source.includes(marker)) {
  source = source.replace(
    groundedAssignment,
    `${groundedAssignment}\n${groundedValidationOnly}`,
  );
}

const assignmentCountAfter = source.split(groundedAssignment).length - 1;
const markerCount = source.split(marker).length - 1;
if (assignmentCountAfter !== 1 || markerCount !== 1) {
  throw new Error(
    `${runtimePath}: grounded A1 authority output must contain one assignment and one validator; assignments=${assignmentCountAfter}, validators=${markerCount}`,
  );
}

for (const token of [
  marker,
  "const groundedStructuralAuthority = String(terminalConnection.authority || \"\")",
  "alreadyQualifiedGroundedAuthority",
  qualifiedAuthorityTemplate,
  "A1 compact grounded wall returned a forbidden authority",
]) {
  if (!source.includes(token)) {
    throw new Error(`${runtimePath}: grounded A1 authority token is missing: ${token}`);
  }
}
const forbiddenWalkwayAuthority = "exact-" + "T4_WALK-A1-terminal-portal-v25";
const forbiddenWalkwayPortalVariable = "exactWalkway" + "PortalX";
for (const forbidden of [
  forbiddenWalkwayAuthority,
  forbiddenWalkwayPortalVariable,
  "alreadyQualifiedStructuralAuthority",
  legacyStructuralMembership,
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: stale or forbidden A1 authority behavior remains: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Removed ${removedLegacyValidationCount} historical A1 validator block(s) and installed one block-scoped grounded authority validator without leaking groundedConnection.`);
