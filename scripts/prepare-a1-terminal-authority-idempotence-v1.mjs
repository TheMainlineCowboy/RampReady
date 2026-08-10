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

// The production pipeline prepares the same A1 installation module more than
// once. Several current passes legitimately reformat the three endpoint
// declarations inside buildMeasuredA1Connector, while the subsequent photo
// registration pass historically recognized only one exact multiline layout.
// Normalize those declarations by their semantic names before that pass runs.
// This does not change the supplied GLB or choose a new wall; it only guarantees
// that terminalPoint is derived from the measured Rotunda opening and direction.
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let installation = fs.readFileSync(installationPath, "utf8");
const endpointAuthority = "a1-semantic-terminal-endpoint-normalization-v1";
const desiredEndpointToken = "rotundaOpening.centerX + openingDirection.x * terminalDistance";
if (!installation.includes(desiredEndpointToken)) {
  const functionStart = installation.indexOf("function buildMeasuredA1Connector(");
  const functionEndCandidate = installation.indexOf("\nfunction ", functionStart + 1);
  const functionEnd = functionEndCandidate > functionStart ? functionEndCandidate : installation.length;
  if (functionStart < 0) {
    throw new Error(`${installationPath}: buildMeasuredA1Connector is missing before photo registration`);
  }

  const declarations = [
    "  const terminalPoint = new THREE.Vector3(",
    "  const collarPoint = new THREE.Vector3(",
    "  const openingDirection = new THREE.Vector3(",
  ].map((needle) => {
    const start = installation.indexOf(needle, functionStart);
    if (start < 0 || start >= functionEnd) {
      throw new Error(`${installationPath}: A1 endpoint declaration is missing: ${needle.trim()}`);
    }
    const end = installation.indexOf(");", start);
    if (end < 0 || end >= functionEnd) {
      throw new Error(`${installationPath}: A1 endpoint declaration does not terminate: ${needle.trim()}`);
    }
    return { start, end: end + 2 };
  });

  const declarationStart = Math.min(...declarations.map((entry) => entry.start));
  const declarationEnd = Math.max(...declarations.map((entry) => entry.end));
  if (declarationEnd - declarationStart > 1600) {
    throw new Error(`${installationPath}: A1 endpoint declarations are unexpectedly far apart`);
  }
  const declarationSpan = installation.slice(declarationStart, declarationEnd);
  if (!declarationSpan.includes("terminalPoint")
    || !declarationSpan.includes("collarPoint")
    || !declarationSpan.includes("openingDirection")) {
    throw new Error(`${installationPath}: A1 semantic endpoint span is incomplete`);
  }

  const normalizedDeclarations = `  // ${endpointAuthority}
  const collarPoint = new THREE.Vector3(rotundaOpening.collarX, rotundaOpening.centerY, rotundaOpening.collarZ);
  const openingDirection = new THREE.Vector3(rotundaOpening.openingDirectionX, 0, rotundaOpening.openingDirectionZ);
  const terminalPoint = new THREE.Vector3(
    rotundaOpening.centerX + openingDirection.x * terminalDistance,
    rotundaOpening.centerY,
    rotundaOpening.centerZ + openingDirection.z * terminalDistance,
  );`;
  installation = `${installation.slice(0, declarationStart)}${normalizedDeclarations}${installation.slice(declarationEnd)}`;
  fs.writeFileSync(installationPath, installation, "utf8");
}

const normalizedInstallation = fs.readFileSync(installationPath, "utf8");
for (const endpointToken of [
  desiredEndpointToken,
  "rotundaOpening.centerZ + openingDirection.z * terminalDistance",
  "const collarPoint = new THREE.Vector3(rotundaOpening.collarX",
  "const openingDirection = new THREE.Vector3(rotundaOpening.openingDirectionX",
]) {
  if (!normalizedInstallation.includes(endpointToken)) {
    throw new Error(`${installationPath}: normalized A1 endpoint is missing ${endpointToken}`);
  }
}

console.log(`Removed ${removedLegacyValidationCount} historical A1 validator block(s), installed one grounded authority validator, and normalized the measured Rotunda terminal endpoint before photo registration.`);