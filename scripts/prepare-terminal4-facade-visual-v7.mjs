import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");
const marker = "const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance";
if (!source.includes(marker)) {
  const oldText = `    const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance;
    if (lowerWallFit != null && !keepServiceBayOpen) {
      // Measure the wall at ramp level rather than reusing the elevated rotunda
      // intersection. Place the closure toward the ramp so it visibly covers the
      // legacy repeated bay instead of landing behind the authored facade.
      const facadeRampOffset = 0.95;
      const facadeX = jetway.x - ux * lowerWallFit + ux * facadeRampOffset;
      const facadeZ = jetway.z - uz * lowerWallFit + uz * facadeRampOffset;
      transforms.facadeInfill.push({
        position: [facadeX, 1.72, facadeZ],
        yaw,
        scale: [6.4, 3.36, 0.68],
      });`;
  const newText = `    // A recessed lower bay must be closed at the outer facade plane, not at the
    // dark rear wall returned by the ramp-height raycast. Keep only source-qualified
    // service bays open; every other module receives a flush outer-wall closure.
    const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance;
    if (facadeOuterWallFit != null && !keepServiceBayOpen) {
      const facadeRampOffset = 0.28;
      const facadeX = jetway.x - ux * facadeOuterWallFit + ux * facadeRampOffset;
      const facadeZ = jetway.z - uz * facadeOuterWallFit + uz * facadeRampOffset;
      transforms.facadeInfill.push({
        position: [facadeX, 1.74, facadeZ],
        yaw,
        scale: [7.0, 3.42, 0.5],
      });`;
  if (!source.includes(oldText)) throw new Error("Terminal 4 facade visual v7 anchor is missing");
  source = source.replace(oldText, newText);
  fs.writeFileSync(path, source, "utf8");
}

const prepared = fs.readFileSync(path, "utf8");
for (const token of [
  "const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance",
  "const facadeRampOffset = 0.28",
  "scale: [7.0, 3.42, 0.5]",
  "service bays open; every other module receives a flush outer-wall closure",
]) if (!prepared.includes(token)) throw new Error(`Terminal 4 facade visual v7 is missing ${token}`);
for (const forbidden of [
  "const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance",
  "const facadeRampOffset = 0.95",
  "scale: [6.4, 3.36, 0.68]",
]) if (prepared.includes(forbidden)) throw new Error(`Terminal 4 facade visual v7 still contains ${forbidden}`);

console.log("Prepared Terminal 4 facade visual v7: non-service lower bays close at the outer terminal plane instead of the recessed dark rear wall.");
