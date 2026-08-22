import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v6-radial-and-vertex-guard";
const originOwnedMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
let source = fs.readFileSync(path, "utf8");

// This is the last A1 wall-normalization pass before Vite. Earlier preparers are
// allowed to rewrite the resolver's raycast helper, so do not depend on a local
// `cast(...)` function existing here. The preferred ray is already the intended
// apron-facing direction. What must be constrained are the two fallback paths that
// previously let A1 grab a nearer perpendicular building face: the 360-degree radial
// search and the nearest-authored-vertex fallback.
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

// Remove the stale derived threshold names that caused repeated browser scope
// failures. The final guard is deliberately self-contained and resolver-local.
resolver = resolver.replace(
  /\n\s*const\s+a1FinalOriginIsA1\s*=\s*Math\.hypot\([\s\S]*?;\s*\n\s*const\s+a1FinalMinimumPreferredDot\s*=\s*a1FinalOriginIsA1[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+a1OriginIsExactA1\s*=\s*Math\.hypot\([\s\S]*?;\s*\n\s*const\s+effectiveMinimumPreferredDot\s*=\s*a1OriginIsExactA1[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(/\beffectiveMinimumPreferredDot\b/g, "a1FinalMinimumPreferredDot");

if (!resolver.includes(marker)) {
  const finalLocalAuthority = `${preferredNeedle}\n  // ${marker}\n  const a1FinalOriginIsA1 = Math.hypot(\n    originX - (-21.01),\n    originZ - (-16.15 + Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0)),\n  ) <= 0.75;\n  const a1FinalMinimumPreferredDot = a1FinalOriginIsA1 ? 0.5 : -1;`;
  resolver = resolver.replace(preferredNeedle, finalLocalAuthority);

  // Restrict only the radial fallback. This is the path that previously allowed A1
  // to rotate around 360 degrees and attach to the visually wrong perpendicular
  // structure. A3+ see a threshold of -1 and therefore retain their existing search.
  const radialNeedle = "    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));";
  if (!resolver.includes(radialNeedle)) {
    throw new Error(`${path}: final resolver radial fallback direction anchor is missing`);
  }
  resolver = resolver.replace(
    radialNeedle,
    `${radialNeedle}\n    if (a1FinalOriginIsA1 && direction.dot(preferred) < a1FinalMinimumPreferredDot) continue;`,
  );

  // The nearest-vertex fallback can also bypass the preferred facade direction.
  // Apply the same 60-degree cone directly to its origin->vertex vector.
  const distanceNeedle = "      const distance = Math.hypot(dx, dz);";
  if (!resolver.includes(distanceNeedle)) {
    throw new Error(`${path}: final resolver nearest-vertex distance anchor is missing`);
  }
  resolver = resolver.replace(
    distanceNeedle,
    `${distanceNeedle}\n      if (a1FinalOriginIsA1 && distance > 0.05\n        && ((dx * preferred.x + dz * preferred.z) / distance) < a1FinalMinimumPreferredDot) continue;`,
  );
}

source = source.slice(0, resolverStart) + resolver + source.slice(resolverEnd);

// A1 must never be redirected to the retired hard-coded T4_WALK portal.
source = source.replace(
  /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/g,
  `\n    // ${marker}: preserve the authored apron-facing BGATE1 facade hit; no T4_WALK portal override.`,
);

// Re-read the final resolver and fail closed on the stable ingredients only. Do not
// require a transient helper such as `cast`, because later preparers may inline it.
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
console.log(`Prepared ${marker}: constrained A1's radial and nearest-vertex wall fallbacks to the apron-facing facade cone without depending on a transient raycast helper; A3+ remain unrestricted and the retired T4_WALK override is absent.`);
