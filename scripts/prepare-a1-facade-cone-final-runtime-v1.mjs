import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v13-normalize-reference-origin-global";
const legacyOriginOwnedMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
const earlyBgate1Marker = "a1-aug15-bgate1-facade-identity-before-wall-resolution-v1";
const acceptedOriginAuthorities = [earlyBgate1Marker, legacyOriginOwnedMarker];
let source = fs.readFileSync(path, "utf8");

// Last A1 wall-normalization pass before Vite. Earlier production preparers own the
// resolver's ray-search implementation and may inline, rename or remove individual
// fallback locals. The resolver-local origin-owned authority is the primary source
// of truth. The newer Aug. 15 BGATE1 lock runs earlier, before the explicit wall,
// Rotunda and dogleg are built; accept that stronger authority as the preferred
// source while retaining the older origin-owned marker for compatibility.
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

// Strip older local threshold declarations. The BGATE1 identity pass may have
// inserted ray/vertex predicates that still reference older A1-origin names.
// Normalize every such predicate to the final local authority before adding it
// back so the browser cannot reach an undeclared variable after production generation.
resolver = resolver.replace(
  /\n\s*const\s+a1FinalOriginIsA1\s*=\s*Math\.hypot\([\s\S]*?;\s*\n\s*const\s+a1FinalMinimumPreferredDot\s*=\s*a1FinalOriginIsA1[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+a1OriginIsExactA1\s*=\s*Math\.hypot\([\s\S]*?;\s*\n\s*const\s+effectiveMinimumPreferredDot\s*=\s*a1OriginIsExactA1[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+a1ReferenceFacadeOriginIsA1\s*=\s*Math\.min\([\s\S]*?\)\s*<=\s*0\.35;\s*/g,
  "\n",
);
resolver = resolver.replace(/\beffectiveMinimumPreferredDot\b/g, "a1FinalMinimumPreferredDot");
resolver = resolver.replace(/\ba1OriginIsExactA1\b/g, "a1FinalOriginIsA1");
resolver = resolver.replace(/\ba1ReferenceFacadeOriginIsA1\b/g, "a1FinalOriginIsA1");

const finalLocalAuthority = `${preferredNeedle}\n  // ${marker}\n  const a1FinalOriginIsA1 = Math.min(\n    Math.hypot(originX - (-21.01), originZ - (-16.15)),\n    Math.hypot(originX - (-21.01), originZ - (-16.15 + Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0))),\n  ) <= 0.75;\n  const a1FinalMinimumPreferredDot = a1FinalOriginIsA1 ? 0.5 : -1;`;
resolver = resolver.replace(preferredNeedle, finalLocalAuthority);

// Reinforce a shared cast helper when it survives this late generation stage.
const castNeedle = "  const cast = (direction, far = 48) => {";
if (resolver.includes(castNeedle)
  && !resolver.includes("direction.dot(preferred) < a1FinalMinimumPreferredDot) return null;")) {
  resolver = resolver.replace(
    castNeedle,
    `${castNeedle}\n    if (a1FinalOriginIsA1 && direction.dot(preferred) < a1FinalMinimumPreferredDot) return null;`,
  );
}

// Reinforce a recognizable radial fallback when present. Absence is allowed because
// the origin-owned resolver may already have folded this restriction into the
// raycast implementation or removed the generic radial fallback entirely.
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

// Reinforce the nearest-authored-vertex fallback when its current implementation is
// recognizable. Do not fail when a later preparer has replaced this fallback with a
// different source-wall path; the accepted early/origin-owned authority remains mandatory.
const distancePattern = /(^\s*const\s+distance\s*=\s*Math\.hypot\(dx,\s*dz\);)/m;
if (distancePattern.test(resolver)
  && !resolver.includes("(dx * preferred.x + dz * preferred.z) / distance")) {
  resolver = resolver.replace(
    distancePattern,
    `$1\n      if (a1FinalOriginIsA1 && distance > 0.05\n        && ((dx * preferred.x + dz * preferred.z) / distance) < a1FinalMinimumPreferredDot) continue;`,
  );
}

source = source.slice(0, resolverStart) + resolver + source.slice(resolverEnd);

// Earlier preparers historically searched the whole generated file when inserting
// A1 facade guards. Any stale A1-origin predicate outside the resolver has no valid
// scope. Neutralize it fail-safe instead of allowing a browser ReferenceError. The
// resolver above retains the only authoritative A1 origin predicate.
source = source.replace(/\ba1OriginIsExactA1\b/g, "false");
source = source.replace(/\ba1ReferenceFacadeOriginIsA1\b/g, "false");

// Likewise, a stale derived threshold outside the resolver has no valid scope and is
// diagnostic-only, so neutralize it. The A1 resolver above remains strictly
// cone-limited by a1FinalMinimumPreferredDot.
source = source.replace(/\beffectiveMinimumPreferredDot\b/g, "-1");

// A1 must never be redirected to the retired hard-coded T4_WALK portal.
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
for (const stale of ["a1OriginIsExactA1", "a1ReferenceFacadeOriginIsA1", "effectiveMinimumPreferredDot"]) {
  if (finalResolver.includes(stale)) {
    throw new Error(`${path}: stale A1 facade predicate survived inside final wall resolver: ${stale}`);
  }
  if (source.includes(stale)) {
    throw new Error(`${path}: stale A1 facade predicate survived final normalization anywhere in generated source: ${stale}`);
  }
}
if (!acceptedOriginAuthorities.some((authority) => source.includes(authority))) {
  throw new Error(`${path}: A1 origin-owned/BGATE1 facade authority was lost`);
}
if (source.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${path}: wrong T4_WALK A1 override survived final runtime normalization`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: accepted the early BGATE1 authority, unified all A1 facade-origin predicates inside the final wall resolver, neutralized stale out-of-scope predicates, preserved the BGATE1 facade cone, and kept A3+ unrestricted.`);
