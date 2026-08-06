import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(runtimePath, "utf8");

const oldValidation = `      if (!structuralAuthorities.has(terminalConnection.authority)) {
        throw new Error(\`A1 structural terminal-building search returned an invalid authority: \${terminalConnection.authority}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      terminalConnection.authority = \`structural-A1-terminal-building-\${terminalConnection.authority}-v28\`;`;

const newValidation = `      const alreadyQualifiedStructuralAuthority = terminalConnection.authority.startsWith("structural-A1-terminal-building-")
        && terminalConnection.authority.endsWith("-v28");
      if (!structuralAuthorities.has(terminalConnection.authority) && !alreadyQualifiedStructuralAuthority) {
        throw new Error(\`A1 structural terminal-building search returned an invalid authority: \${terminalConnection.authority}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      if (!alreadyQualifiedStructuralAuthority) {
        terminalConnection.authority = \`structural-A1-terminal-building-\${terminalConnection.authority}-v28\`;
      }`;

if (source.includes(oldValidation)) {
  source = source.replace(oldValidation, newValidation);
} else if (!source.includes("alreadyQualifiedStructuralAuthority")) {
  throw new Error(`${runtimePath}: A1 structural authority validator anchor is missing`);
}

for (const token of [
  "alreadyQualifiedStructuralAuthority",
  "terminalConnection.authority.startsWith(\"structural-A1-terminal-building-\")",
  "terminalConnection.authority.endsWith(\"-v28\")",
  "if (!alreadyQualifiedStructuralAuthority)",
]) {
  if (!source.includes(token)) {
    throw new Error(`${runtimePath}: idempotent A1 authority token is missing: ${token}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Made the A1 structural terminal-wall authority idempotent across repeated production preparation without changing geometry or source-node transforms.");
