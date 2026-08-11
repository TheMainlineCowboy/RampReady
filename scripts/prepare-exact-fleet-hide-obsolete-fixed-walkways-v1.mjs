import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const marker = "exact-glb-hides-obsolete-procedural-fixed-walkway-overlays-v1";
let source = fs.readFileSync(fleetPath, "utf8");

if (!source.includes(marker)) {
  const oldLine = 'const HIDE_REPLACED = /^(?:AIR_Jetway01_|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;';
  const newLine = `// ${marker}\nconst HIDE_REPLACED = /^(?:AIR_Jetway01_|Terminal4_FixedWalkway|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;`;
  if (!source.includes(oldLine)) {
    throw new Error(`${fleetPath}: exact-fleet generated-object hide anchor is missing`);
  }
  source = source.replace(oldLine, newLine);
}

for (const token of [
  marker,
  "Terminal4_FixedWalkway",
  "function hideGeneratedJetways(group)",
  "HIDE_REPLACED.test(child.name)",
]) {
  if (!source.includes(token)) throw new Error(`${fleetPath}: obsolete fixed-walkway cleanup is missing ${token}`);
}

fs.writeFileSync(fleetPath, source, "utf8");
console.log("Exact uploaded Airport_Jetway fleet now hides the obsolete procedural Terminal4_FixedWalkway architectural overlays and ground supports along with the replaced AIR_Jetway01 geometry.");
