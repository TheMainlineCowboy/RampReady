import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v5-self-contained-resolver";
const originOwnedMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
let source = fs.readFileSync(path, "utf8");

// This is the last A1 wall-normalization pass before Vite. Earlier preparers may
// rewrite the resolver signature/body, so do not depend on a particular temporary
// variable or call-site spelling. Re-establish the A1-only facade cone directly in
// the final resolver itself and make it self-contained.
if (!source.includes(originOwnedMarker)) {
  throw new Error(`${path}: origin-owned A1 facade cone authority is missing before final runtime normalization`);
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

// Strip any stale generated threshold declarations. Their scope was the source of
// repeated browser crashes. Any surviving references are rebound to the final local
// threshold declared immediately beside `preferred` below.
resolver = resolver.replace(
  /\n\s*const\s+a1OriginIsExactA1\s*=\s*Math\.hypot\([\s\S]*?;\s*\n\s*const\s+effectiveMinimumPreferredDot\s*=\s*a1OriginIsExactA1[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+effectiveMinimumPreferredDot\s*=\s*[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(/\beffectiveMinimumPreferredDot\b/g, "a1FinalMinimumPreferredDot");

const finalLocalAuthority = `${preferredNeedle}\n  // ${marker}\n  const a1FinalOriginIsA1 = Math.hypot(\n    originX - (-21.01),\n    originZ - (-16.15 + Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0)),\n  ) <= 0.75;\n  const a1FinalMinimumPreferredDot = a1FinalOriginIsA1 ? 0.5 : -1;`;
resolver = resolver.replace(preferredNeedle, finalLocalAuthority);

// Guard every ray cast at the resolver boundary. This catches the preferred ray,
// radial fallbacks, and any later-generated cast callers without requiring their
// exact loop syntax. A1 can only see authored facade surfaces within 60 degrees of
// its apron-facing/source direction; other gates remain unrestricted.
const castNeedle = "  const cast = (direction, far = 48) => {";
if (!resolver.includes(castNeedle)) {
  throw new Error(`${path}: final resolver cast boundary is missing`);
}
resolver = resolver.replace(
  castNeedle,
  `${castNeedle}\n    if (a1FinalOriginIsA1 && direction.dot(preferred) < a1FinalMinimumPreferredDot) return null;`,
);

// The nearest-vertex fallback bypasses `cast`, so apply the same cone to its
// normalized origin->vertex direction before allowing a candidate to win.
const distanceNeedle = "      const distance = Math.hypot(dx, dz);";
if (!resolver.includes(distanceNeedle)) {
  throw new Error(`${path}: final resolver nearest-vertex distance anchor is missing`);
}
resolver = resolver.replace(
  distanceNeedle,
  `${distanceNeedle}\n      if (a1FinalOriginIsA1 && distance > 0.05\n        && ((dx * preferred.x + dz * preferred.z) / distance) < a1FinalMinimumPreferredDot) continue;`,
);

// A1 must never be redirected to the retired hard-coded T4_WALK portal.
source = source.slice(0, resolverStart) + resolver + source.slice(resolverEnd);
source = source.replace(
  /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/g,
  `\n    // ${marker}: preserve the authored apron-facing BGATE1 facade hit; no T4_WALK portal override.`,
);

// Re-read the final resolver and fail closed on the actual runtime ingredients,
// not on one transient textual threshold form.
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
  "const a1FinalOriginIsA1 = Math.hypot(",
  "const a1FinalMinimumPreferredDot = a1FinalOriginIsA1 ? 0.5 : -1;",
  "direction.dot(preferred) < a1FinalMinimumPreferredDot",
  "(dx * preferred.x + dz * preferred.z) / distance",
]) {
  if (!finalResolver.includes(required)) {
    throw new Error(`${path}: final resolver lost required A1 facade-cone runtime guard: ${required}`);
  }
}
if (finalResolver.includes("effectiveMinimumPreferredDot")) {
  throw new Error(`${path}: stale derived A1 facade threshold survived final normalization`);
}
if (!source.includes(originOwnedMarker)) {
  throw new Error(`${path}: A1 origin-owned facade cone authority was lost`);
}
if (source.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${path}: wrong T4_WALK A1 override survived final runtime normalization`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: rebuilt the A1-only facade cone directly inside the final wall resolver, guarded both raycasts and nearest-vertex fallback, and removed the retired T4_WALK portal override.`);
