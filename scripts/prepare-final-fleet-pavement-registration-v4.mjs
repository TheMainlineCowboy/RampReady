import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleet.js";
const v7Marker = "rendered-kphx-pavement-per-gate-v7-a1-visible-undercarriage-ground-registration";
const v8Marker = "rendered-kphx-pavement-per-gate-v8-a1-primary-visible-bogie-ground-registration";
const oldMarker = "rendered-kphx-pavement-per-gate-v9-a1-wheel-contact-ground-registration";
const marker = "rendered-kphx-pavement-per-gate-v10-a1-wheel-contact-no-rods";
let source = fs.readFileSync(path, "utf8");

if (![v7Marker, v8Marker, oldMarker, marker].some((value) => source.includes(value))) {
  throw new Error(`${path}: V10 wheel-contact grounding requires the disconnected Tunnel-C component authority first`);
}

if (!source.includes(marker)) {
  // V9 still allowed 12-triangle vertical boxes to qualify as compact contacts.
  // The fresh exact-head bogie screenshot showed those black rod/leg pieces hanging
  // above the pavement while some hidden compact fragment certified 0.000 m. A real
  // wheel/foot contact component must have more topology than a rectangular rod and
  // must be vertically compact. Fail closed if the supplied source exposes no such
  // component rather than accepting another visually false ground authority.
  const v9Filter = [
    "    // " + oldMarker,
    "    // Ground from the compact source wheel/contact family, never from the",
    "    // broad transverse carrier beam and never from a thin hanging rod/cable.",
    "    if (!(triangles.length >= 12)) continue;",
    "    if (!(horizontalSpan >= 0.20 && horizontalSpan <= 1.25)) continue;",
    "    if (!(size.y >= 0.15 && size.y <= 1.25)) continue;",
    "    if (!(center.y <= carrierCenterY && alongRatio > 0.45 && alongRatio < 0.98)) continue;",
  ].join("\n");
  const v10Filter = [
    "    // " + marker,
    "    // Only a topology-rich, vertically compact supplied wheel/foot component",
    "    // may own pavement registration. Twelve-triangle rectangular rods and long",
    "    // hanging members are explicitly excluded.",
    "    if (!(triangles.length >= 24)) continue;",
    "    if (!(horizontalSpan >= 0.22 && horizontalSpan <= 1.50)) continue;",
    "    if (!(size.y >= 0.12 && size.y <= 0.90)) continue;",
    "    if (!(size.y <= horizontalSpan * 2.0)) continue;",
    "    if (!(center.y <= carrierCenterY && alongRatio > 0.45 && alongRatio < 0.98)) continue;",
  ].join("\n");
  if (source.includes(v9Filter)) {
    source = source.replace(v9Filter, v10Filter);
  } else {
    const genericFilter = [
      "    if (!(horizontalSpan >= 0.35 && horizontalSpan <= 5.0)) continue;",
      "    if (!(size.y >= 0.05 && size.y <= 3.5)) continue;",
      "    if (!(center.y <= carrierCenterY && alongRatio > 0.35 && alongRatio < 0.88)) continue;",
    ].join("\n");
    if (!source.includes(genericFilter)) {
      throw new Error(`${path}: V10 cannot find the existing undercarriage candidate filter`);
    }
    source = source.replace(genericFilter, v10Filter);
  }

  const v9Sort = [
    "  // The candidate set is already restricted to wheel/contact-sized source",
    "  // components, so the lowest rendered contact owns pavement registration.",
    "  candidates.sort((a, b) =>",
    "    a.clearance - b.clearance",
    "    || b.triangles.length - a.triangles.length",
    "    || b.horizontalSpan - a.horizontalSpan,",
    "  );",
  ].join("\n");
  const v7Sort = "  candidates.sort((a, b) => a.clearance - b.clearance || b.horizontalSpan - a.horizontalSpan || b.triangles.length - a.triangles.length);";
  const v10Sort = [
    "  // Among actual wheel/foot-shaped candidates, topology richness is the primary",
    "  // discriminator. Clearance only breaks ties; a hidden 12-triangle rod can no",
    "  // longer win merely because one vertex happens to be lowest.",
    "  candidates.sort((a, b) =>",
    "    b.triangles.length - a.triangles.length",
    "    || a.clearance - b.clearance",
    "    || b.horizontalSpan - a.horizontalSpan,",
    "  );",
  ].join("\n");
  if (source.includes(v9Sort)) source = source.replace(v9Sort, v10Sort);
  else if (source.includes(v7Sort)) source = source.replace(v7Sort, v10Sort);
  else if (!source.includes("b.triangles.length - a.triangles.length")) {
    throw new Error(`${path}: V10 cannot find/recognize the existing Tunnel-C candidate ranking`);
  }

  source = source.replaceAll(oldMarker, marker).replaceAll(v8Marker, marker).replaceAll(v7Marker, marker);
}

for (const required of [
  marker,
  "triangles.length >= 24",
  "horizontalSpan >= 0.22 && horizontalSpan <= 1.50",
  "size.y >= 0.12 && size.y <= 0.90",
  "size.y <= horizontalSpan * 2.0",
  "alongRatio > 0.45 && alongRatio < 0.98",
  "b.triangles.length - a.triangles.length",
  "a1RigidTunnelCGroundComponentSpanMeters",
  "a1RigidTunnelCGroundComponentTriangles",
]) {
  if (!source.includes(required)) throw new Error(`${path}: V10 wheel-contact grounding is missing ${required}`);
}
if (source.includes("triangles.length >= 12")) {
  throw new Error(`${path}: V9 12-triangle rod acceptance survived V10`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: A1 rigid Y registration now fails closed unless a topology-rich, vertically compact supplied Tunnel-C wheel/foot component reaches pavement; rectangular hanging rods can no longer certify ground contact.`);
