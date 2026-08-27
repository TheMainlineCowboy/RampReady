import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v15-dedupe-final-origin";
const legacyOriginOwnedMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
const earlyBgate1Marker = "a1-aug15-bgate1-facade-identity-before-wall-resolution-v1";
const acceptedOriginAuthorities = [earlyBgate1Marker, legacyOriginOwnedMarker];
let source = fs.readFileSync(path, "utf8");

if (!acceptedOriginAuthorities.some((authority) => source.includes(authority))) {
  throw new Error(`${path}: A1 origin-owned/BGATE1 facade authority is missing before final runtime normalization`);
}

const resolverMatch = source.match(/function findTerminalWallConnection\(([^)]*)\)\s*\{/);
if (!resolverMatch || !Number.isInteger(resolverMatch.index)) {
  throw new Error(`${path}: final Terminal 4 wall resolver is missing`);
}
const resolverStart = resolverMatch.index;
const nextFunction = source.indexOf("\nfunction ", resolverStart + resolverMatch[0].length);
const resolverEnd = nextFunction >= 0 ? nextFunction : source.length;
let resolver = source.slice(resolverStart, resolverEnd);

const preferredNeedle = "  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();";
if (!resolver.includes(preferredNeedle)) {
  throw new Error(`${path}: final resolver preferred-direction anchor is missing`);
}

// Final-pass dedupe is deliberately broader than the historical cleanup. Earlier
// BGATE1 preparers have emitted both Math.hypot(...) and Math.min(...) variants of
// the same local A1-origin authority. Remove every complete declaration of the
// final/legacy origin predicates and their derived thresholds before inserting one
// canonical resolver-local authority. This prevents duplicate `const` declarations
// from surviving into Vite while keeping the resolver semantics unchanged.
resolver = resolver.replace(
  /\n\s*const\s+a1FinalOriginIsA1\s*=\s*Math\.min\([\s\S]*?\)\s*<=\s*0\.75;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+a1FinalOriginIsA1\s*=\s*Math\.hypot\([\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+a1FinalMinimumPreferredDot\s*=\s*a1FinalOriginIsA1\s*\?\s*0\.5\s*:\s*-1;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+a1OriginIsExactA1\s*=\s*Math\.hypot\([\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+effectiveMinimumPreferredDot\s*=\s*a1OriginIsExactA1[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+a1ReferenceFacadeOriginIsA1\s*=\s*Math\.min\([\s\S]*?\)\s*<=\s*0\.35;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+a1EarlyOriginIsA1\s*=\s*Math\.min\([\s\S]*?\)\s*<=\s*[0-9.]+;\s*/g,
  "\n",
);

resolver = resolver.replace(/\beffectiveMinimumPreferredDot\b/g, "a1FinalMinimumPreferredDot");
resolver = resolver.replace(/\ba1OriginIsExactA1\b/g, "a1FinalOriginIsA1");
resolver = resolver.replace(/\ba1ReferenceFacadeOriginIsA1\b/g, "a1FinalOriginIsA1");
resolver = resolver.replace(/\ba1EarlyOriginIsA1\b/g, "a1FinalOriginIsA1");

const finalLocalAuthority = `${preferredNeedle}\n  // ${marker}\n  const a1FinalOriginIsA1 = Math.min(\n    Math.hypot(originX - (-21.01), originZ - (-16.15)),\n    Math.hypot(originX - (-21.01), originZ - (-16.15 + Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0))),\n  ) <= 0.75;\n  const a1FinalMinimumPreferredDot = a1FinalOriginIsA1 ? 0.5 : -1;`;
resolver = resolver.replace(preferredNeedle, finalLocalAuthority);

const castNeedle = "  const cast = (direction, far = 48) => {";
if (resolver.includes(castNeedle)
  && !resolver.includes("direction.dot(preferred) < a1FinalMinimumPreferredDot) return null;")) {
  resolver = resolver.replace(
    castNeedle,
    `${castNeedle}\n    if (a1FinalOriginIsA1 && direction.dot(preferred) < a1FinalMinimumPreferredDot) return null;`,
  );
}

const radialPatterns = [
  /(^\s*const\s+direction\s*=\s*new THREE\.Vector3\(Math\.sin\(angle\),\s*0,\s*Math\.cos\(angle\)\);)/m,
  /(^\s*const\s+direction\s*=\s*new THREE\.Vector3\(Math\.sin\([^\n]+\),\s*0,\s*Math\.cos\([^\n]+\)\);)/m,
];
if (!resolver.includes("direction.dot(preferred) < a1FinalMinimumPreferredDot) continue;")) {
  for (const pattern of radialPatterns) {
    if (!pattern.test(resolver)) continue;
    resolver = resolver.replace(
      pattern,
      `$1\n    if (a1FinalOriginIsA1 && direction.dot(preferred) < a1FinalMinimumPreferredDot) continue;`,
    );
    break;
  }
}

const distancePattern = /(^\s*const\s+distance\s*=\s*Math\.hypot\(dx,\s*dz\);)/m;
if (distancePattern.test(resolver)
  && !resolver.includes("(dx * preferred.x + dz * preferred.z) / distance")) {
  resolver = resolver.replace(
    distancePattern,
    `$1\n      if (a1FinalOriginIsA1 && distance > 0.05\n        && ((dx * preferred.x + dz * preferred.z) / distance) < a1FinalMinimumPreferredDot) continue;`,
  );
}

// A duplicate here means a future preparer emitted another authority shape that this
// final normalizer does not understand. Fail before Vite rather than producing an
// invalid bundle or silently choosing one declaration.
const finalOriginDeclarationCount = (resolver.match(/\bconst\s+a1FinalOriginIsA1\b/g) || []).length;
const finalThresholdDeclarationCount = (resolver.match(/\bconst\s+a1FinalMinimumPreferredDot\b/g) || []).length;
if (finalOriginDeclarationCount !== 1 || finalThresholdDeclarationCount !== 1) {
  throw new Error(`${path}: final A1 facade authority was not deduplicated cleanly (origin=${finalOriginDeclarationCount}, threshold=${finalThresholdDeclarationCount})`);
}

source = source.slice(0, resolverStart) + resolver + source.slice(resolverEnd);

source = source.replace(/\ba1OriginIsExactA1\b/g, "false");
source = source.replace(/\ba1ReferenceFacadeOriginIsA1\b/g, "false");
source = source.replace(/\ba1EarlyOriginIsA1\b/g, "false");
source = source.replace(/\beffectiveMinimumPreferredDot\b/g, "-1");

source = source.replace(
  /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/g,
  `\n    // ${marker}: preserve the authored apron-facing BGATE1 facade hit; no T4_WALK portal override.`,
);

const finalResolverMatch = source.match(/function findTerminalWallConnection\(([^)]*)\)\s*\{/);
if (!finalResolverMatch || !Number.isInteger(finalResolverMatch.index)) {
  throw new Error(`${path}: final Terminal 4 wall resolver vanished during normalization`);
}
const finalStart = finalResolverMatch.index;
const finalNext = source.indexOf("\nfunction ", finalStart + finalResolverMatch[0].length);
const finalEnd = finalNext >= 0 ? finalNext : source.length;
const finalResolver = source.slice(finalStart, finalEnd);
for (const required of [
  marker,
  "const a1FinalOriginIsA1 = Math.min(",
  "const a1FinalMinimumPreferredDot = a1FinalOriginIsA1 ? 0.5 : -1;",
]) {
  if (!finalResolver.includes(required)) {
    throw new Error(`${path}: final resolver lost required A1 facade-cone runtime guard: ${required}`);
  }
}
for (const stale of ["a1OriginIsExactA1", "a1ReferenceFacadeOriginIsA1", "a1EarlyOriginIsA1", "effectiveMinimumPreferredDot"]) {
  if (finalResolver.includes(stale)) {
    throw new Error(`${path}: stale A1 facade predicate survived inside final wall resolver: ${stale}`);
  }
  if (source.includes(stale)) {
    throw new Error(`${path}: stale A1 facade predicate survived final normalization anywhere in generated source: ${stale}`);
  }
}
if ((finalResolver.match(/\bconst\s+a1FinalOriginIsA1\b/g) || []).length !== 1
  || (finalResolver.match(/\bconst\s+a1FinalMinimumPreferredDot\b/g) || []).length !== 1) {
  throw new Error(`${path}: duplicate final A1 facade declarations survived normalization`);
}
if (!acceptedOriginAuthorities.some((authority) => source.includes(authority))) {
  throw new Error(`${path}: A1 origin-owned/BGATE1 facade authority was lost`);
}
if (source.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${path}: wrong T4_WALK A1 override survived final runtime normalization`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: deduplicated A1 facade-origin declarations, preserved the early BGATE1 authority and cone, neutralized stale out-of-scope predicates, and kept A3+ unrestricted.`);
