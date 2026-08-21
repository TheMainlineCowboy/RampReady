import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleet.js";
const v7Marker = "rendered-kphx-pavement-per-gate-v7-a1-visible-undercarriage-ground-registration";
const v8Marker = "rendered-kphx-pavement-per-gate-v8-a1-primary-visible-bogie-ground-registration";
const marker = "rendered-kphx-pavement-per-gate-v9-a1-wheel-contact-ground-registration";
let source = fs.readFileSync(path, "utf8");

if (![v7Marker, v8Marker, marker].some((value) => source.includes(value))) {
  throw new Error(`${path}: V9 wheel-contact grounding requires the disconnected Tunnel-C component authority first`);
}

if (!source.includes(marker)) {
  // The V8 rule selected the broadest low Tunnel-C component. In the rendered A1
  // evidence that broad transverse bogie beam could sit at pavement while the actual
  // wheel/contact geometry was below it, burying the wheels. Select only compact,
  // substantial low components that can physically be a wheel/foot/contact member.
  // Tiny rods/cables are excluded; the broad carrier/beam is excluded as well.
  const oldFilter = [
    "    if (!(horizontalSpan >= 0.35 && horizontalSpan <= 5.0)) continue;",
    "    if (!(size.y >= 0.05 && size.y <= 3.5)) continue;",
    "    if (!(center.y <= carrierCenterY && alongRatio > 0.35 && alongRatio < 0.88)) continue;",
  ].join("\n");
  const wheelFilter = [
    "    // " + marker,
    "    // Ground from the compact source wheel/contact family, never from the",
    "    // broad transverse carrier beam and never from a thin hanging rod/cable.",
    "    if (!(triangles.length >= 12)) continue;",
    "    if (!(horizontalSpan >= 0.20 && horizontalSpan <= 1.25)) continue;",
    "    if (!(size.y >= 0.15 && size.y <= 1.25)) continue;",
    "    if (!(center.y <= carrierCenterY && alongRatio > 0.45 && alongRatio < 0.98)) continue;",
  ].join("\n");
  if (!source.includes(oldFilter)) {
    throw new Error(`${path}: V9 cannot find the V7/V8 generic undercarriage candidate filter`);
  }
  source = source.replace(oldFilter, wheelFilter);

  const v7Sort = "  candidates.sort((a, b) => a.clearance - b.clearance || b.horizontalSpan - a.horizontalSpan || b.triangles.length - a.triangles.length);";
  const v8Sort = [
    "  // " + v8Marker,
    "  // Ground from the primary visible bogie/undercarriage mass, not whichever",
    "  // disconnected rod/cable happens to have the numerically lowest vertex.",
    "  // The broadest substantial component is the visual/load-bearing authority;",
    "  // triangle count breaks near-width ties and clearance is diagnostic last.",
    "  candidates.sort((a, b) =>",
    "    b.horizontalSpan - a.horizontalSpan",
    "    || b.triangles.length - a.triangles.length",
    "    || a.clearance - b.clearance,",
    "  );",
  ].join("\n");
  const wheelSort = [
    "  // The candidate set is already restricted to wheel/contact-sized source",
    "  // components, so the lowest rendered contact owns pavement registration.",
    "  candidates.sort((a, b) =>",
    "    a.clearance - b.clearance",
    "    || b.triangles.length - a.triangles.length",
    "    || b.horizontalSpan - a.horizontalSpan,",
    "  );",
  ].join("\n");
  if (source.includes(v8Sort)) source = source.replace(v8Sort, wheelSort);
  else if (source.includes(v7Sort)) source = source.replace(v7Sort, wheelSort);
  else throw new Error(`${path}: V9 cannot find the existing Tunnel-C candidate ranking`);

  source = source.replaceAll(v8Marker, marker).replaceAll(v7Marker, marker);
}

for (const required of [
  marker,
  "triangles.length >= 12",
  "horizontalSpan >= 0.20 && horizontalSpan <= 1.25",
  "size.y >= 0.15 && size.y <= 1.25",
  "alongRatio > 0.45 && alongRatio < 0.98",
  "a.clearance - b.clearance",
  "a1RigidTunnelCGroundComponentSpanMeters",
  "a1RigidTunnelCGroundComponentTriangles",
]) {
  if (!source.includes(required)) throw new Error(`${path}: V9 wheel-contact grounding is missing ${required}`);
}
if (source.includes("b.horizontalSpan - a.horizontalSpan\n    || b.triangles.length")) {
  throw new Error(`${path}: V8 broad-beam-first grounding survived V9`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: A1 rigid Y registration now uses compact supplied Tunnel-C wheel/contact geometry; the broad carrier beam cannot bury the wheels and thin rods/cables cannot certify contact.`);
