import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v1";
let source = fs.readFileSync(path, "utf8");

const resolverPattern = /function findTerminalWallConnection\(([^)]*)\)\s*\{/;
const resolverMatch = source.match(resolverPattern);
if (!resolverMatch) throw new Error(`${path}: terminal wall resolver is missing`);

if (!resolverMatch[1].includes("minimumPreferredDot")) {
  const args = resolverMatch[1].trim();
  source = source.replace(
    resolverMatch[0],
    `function findTerminalWallConnection(${args}, minimumPreferredDot = -1) {`,
  );
}

// Retire the fragile derived threshold variable completely. Earlier generated
// passes could leave its guards behind while stripping the declaration, causing
// a runtime ReferenceError before any A1 evidence could render. The call site now
// supplies the A1-only threshold directly, so the resolver only needs its stable
// minimumPreferredDot parameter.
source = source.replace(
  /\n\s*\/\/ a1-bgate1-preferred-facade-cone-v6-origin-owned:[\s\S]*?const effectiveMinimumPreferredDot = a1OriginIsExactA1[\s\S]*?: Number\(minimumPreferredDot\);/g,
  "",
);
source = source.replace(/\beffectiveMinimumPreferredDot\b/g, "minimumPreferredDot");

const terminalCallPattern = /const terminalConnection = findTerminalWallConnection\([\s\S]*?\n\s*rotundaY,\n\s*\) \|\| \{\};/;
const terminalCallMatch = source.match(terminalCallPattern);
if (!terminalCallMatch) throw new Error(`${path}: terminalConnection resolver call is missing`);
if (!terminalCallMatch[0].includes('jetway.g === "A1" ? 0.5 : -1')) {
  const replacement = terminalCallMatch[0].replace(
    /\n\s*rotundaY,\n\s*\) \|\| \{\};$/,
    `\n      rotundaY,\n      jetway.g === "A1" ? 0.5 : -1,\n    ) || {};`,
  );
  source = source.replace(terminalCallMatch[0], replacement);
}

// A1 must never be redirected to the old hard-coded T4_WALK portal.
source = source.replace(
  /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/g,
  `\n    // ${marker}: keep the authored apron-facing facade hit; no T4_WALK portal override.`,
);

if (source.includes("effectiveMinimumPreferredDot")) {
  throw new Error(`${path}: stale derived facade threshold survived final runtime normalization`);
}
if (!source.includes("minimumPreferredDot = -1")) {
  throw new Error(`${path}: resolver-local minimumPreferredDot parameter is missing`);
}
if (!source.includes('jetway.g === "A1" ? 0.5 : -1')) {
  throw new Error(`${path}: A1-only facade cone argument is missing from terminalConnection call`);
}
if (source.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${path}: wrong T4_WALK A1 override survived final runtime normalization`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: A1 passes its apron-facing facade cone directly into the resolver; no undeclared derived threshold can survive into runtime.`);
