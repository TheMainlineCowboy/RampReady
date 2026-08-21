import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleet.js";
const priorMarker = "rendered-kphx-pavement-per-gate-v7-a1-visible-undercarriage-ground-registration";
const marker = "rendered-kphx-pavement-per-gate-v8-a1-primary-visible-bogie-ground-registration";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(priorMarker) && !source.includes(marker)) {
  throw new Error(`${path}: V8 grounding requires the V7 disconnected-component authority first`);
}

if (!source.includes(marker)) {
  const oldSort = "  candidates.sort((a, b) => a.clearance - b.clearance || b.horizontalSpan - a.horizontalSpan || b.triangles.length - a.triangles.length);";
  const newSort = [
    "  // " + marker,
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
  if (!source.includes(oldSort)) {
    throw new Error(`${path}: V8 cannot find the V7 clearance-first undercarriage ranking`);
  }
  source = source.replace(oldSort, newSort);
  source = source.replaceAll(priorMarker, marker);

  const diagnosticNeedle = "      span: Number(candidate.horizontalSpan.toFixed(3)),";
  if (!source.includes(diagnosticNeedle)) {
    throw new Error(`${path}: V8 undercarriage diagnostics are missing span telemetry`);
  }
}

for (const required of [
  marker,
  "b.horizontalSpan - a.horizontalSpan",
  "b.triangles.length - a.triangles.length",
  "|| a.clearance - b.clearance",
  "a1RigidTunnelCGroundComponentSpanMeters",
  "a1RigidTunnelCGroundComponentTriangles",
]) {
  if (!source.includes(required)) throw new Error(`${path}: V8 grounding is missing ${required}`);
}
if (source.includes("candidates.sort((a, b) => a.clearance - b.clearance")) {
  throw new Error(`${path}: clearance-first hidden-component grounding survived V8`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: the broad visible Tunnel-C bogie/undercarriage component now owns A1 rigid pavement registration; low disconnected rods/cables cannot certify a floating visible bogie.`);
