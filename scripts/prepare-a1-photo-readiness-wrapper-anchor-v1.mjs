import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const sourceOwnedExtensionGate = "!Number.isFinite(a1AttachedExtension) || Math.abs(a1AttachedExtension) > 1e-6";
const compactExtensionGate = "!(a1AttachedExtension > 3 && a1AttachedExtension < 7)";

let source = fs.readFileSync(readinessPath, "utf8");

// The final Tunnel-C readiness migration correctly normalizes A1 to zero
// synthetic extension before the photo-aware Vite wrapper runs. That wrapper
// historically anchors on the retired compact expression so it can replace the
// whole A1 branch atomically. Convert only this already-generated validator
// token back to the wrapper anchor immediately before bundling; the wrapper then
// replaces it with the Aug. 15 photo-aware conditional and restores this file.
// No runtime geometry, airport placement, aircraft placement, or supplied GLB
// content is changed here.
if (!source.includes(compactExtensionGate)) {
  if (!source.includes(sourceOwnedExtensionGate)) {
    throw new Error(`${readinessPath}: neither zero-extension nor compact wrapper anchor is present`);
  }
  source = source.replace(sourceOwnedExtensionGate, compactExtensionGate);
  fs.writeFileSync(readinessPath, source, "utf8");
}

source = fs.readFileSync(readinessPath, "utf8");
if (!source.includes(compactExtensionGate)) {
  throw new Error(`${readinessPath}: photo readiness wrapper anchor was not installed`);
}

console.log("Prepared A1 photo-readiness wrapper anchor from the already-validated zero synthetic extension gate; geometry remains unchanged.");
