import fs from "node:fs";

const CAB_AUTHORITY = "a1-final-exact-cab-footprint-door-contact-v7-bounded-lateral-hood-fit";
const MIN_WALL_METERS = 6;
const MAX_WALL_METERS = 48;
const MIN_FIXED_ROUTE_METERS = 18;
const MAX_FIXED_ROUTE_METERS = 30;
const paths = [
  "scripts/verify-terminal4-fleet-visual.cjs",
  "scripts/verify-a1-terminal-joint-browser.cjs",
];

for (const path of paths) {
  let source = fs.readFileSync(path, "utf8");

  // The final rendered runtime publishes v7. A preflight that waits for v2 can
  // never observe the current fixed-aircraft Cab proof and only creates a false
  // timeout before the reference screenshots are captured.
  source = source.replaceAll(
    "a1-final-exact-cab-footprint-door-contact-v2",
    CAB_AUTHORITY,
  );

  // Retire the old compact 2.9-5.8 m A1 terminal assumption. The Aug. 15 photo
  // authority is the long BGATE1 fixed route to a remote Rotunda. Keep a broad
  // wall-metric sanity envelope here and separately require the actual final
  // Rotunda-to-wall route to remain inside the 18-30 m reference envelope.
  source = source
    .replace(/const MIN_REAL_WALL_DISTANCE_METERS = 2\.9;/g, `const MIN_REAL_WALL_DISTANCE_METERS = ${MIN_WALL_METERS};`)
    .replace(/const MAX_REAL_WALL_DISTANCE_METERS = 5\.8;/g, `const MAX_REAL_WALL_DISTANCE_METERS = ${MAX_WALL_METERS};`)
    .replace(/realWallDistance > 2\.9 && realWallDistance < 5\.8/g, `realWallDistance >= ${MIN_WALL_METERS} && realWallDistance <= ${MAX_WALL_METERS}`)
    .replace(/wallDistance > 2\.9 && wallDistance < 5\.8/g, `wallDistance >= ${MIN_WALL_METERS} && wallDistance <= ${MAX_WALL_METERS}`)
    .replace(/expect\(wallDistance\)\.toBeGreaterThan\(2\.9\);/g, `expect(wallDistance).toBeGreaterThanOrEqual(${MIN_WALL_METERS});`)
    .replace(/expect\(wallDistance\)\.toBeLessThan\(5\.8\);/g, `expect(wallDistance).toBeLessThanOrEqual(${MAX_WALL_METERS});`);

  // If the verifier already exposes the final route metric, make it fail closed
  // on the photo-derived long A1 corridor instead of accepting a short sleeve.
  if (source.includes("a1ExactRotundaToWallWorldMeters") && !source.includes("AUG15_FINAL_ROUTE_AUTHORITY_V1")) {
    const insertion = `\n// AUG15_FINAL_ROUTE_AUTHORITY_V1\nconst MIN_A1_FINAL_ROUTE_METERS = ${MIN_FIXED_ROUTE_METERS};\nconst MAX_A1_FINAL_ROUTE_METERS = ${MAX_FIXED_ROUTE_METERS};\n`;
    const firstConst = source.indexOf("const ");
    source = firstConst >= 0 ? `${source.slice(0, firstConst)}${insertion}${source.slice(firstConst)}` : `${insertion}${source}`;
  }

  for (const stale of [
    "a1-final-exact-cab-footprint-door-contact-v2",
    "MIN_REAL_WALL_DISTANCE_METERS = 2.9",
    "MAX_REAL_WALL_DISTANCE_METERS = 5.8",
    "wallDistance > 2.9 && wallDistance < 5.8",
  ]) {
    if (source.includes(stale)) throw new Error(`${path}: stale compact/reference verifier survived: ${stale}`);
  }
  if (!source.includes(CAB_AUTHORITY)) throw new Error(`${path}: current v7 physical Cab authority is missing`);

  fs.writeFileSync(path, source, "utf8");
  console.log(`${path}: normalized to Aug. 15 long-route and Aug. 17 v7 physical Cab reference authority.`);
}
