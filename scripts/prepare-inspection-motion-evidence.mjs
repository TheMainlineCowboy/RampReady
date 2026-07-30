import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainer.jsx";
let source = fs.readFileSync(path, "utf8");
if (!source.includes("canvas.dataset.inspectionTugX")) {
  const oldText = `      const aircraftSource = aircraft.userData.renderedAircraftSource || aircraft.userData.aircraftAssetCandidateId || aircraft.userData.aircraftAssetState || "loading";
      canvas.dataset.aircraftSource = aircraftSource;`;
  const newText = `      const aircraftSource = aircraft.userData.renderedAircraftSource || aircraft.userData.aircraftAssetCandidateId || aircraft.userData.aircraftAssetState || "loading";
      canvas.dataset.aircraftSource = aircraftSource;
      canvas.dataset.inspectionTugX = rig.root.position.x.toFixed(3);
      canvas.dataset.inspectionTugZ = rig.root.position.z.toFixed(3);
      canvas.dataset.inspectionSpeed = Math.abs(state.speed).toFixed(3);`;
  if (!source.includes(oldText)) throw new Error("Inspection motion evidence anchor is missing");
  source = source.replace(oldText, newText);
}
for (const token of [
  "canvas.dataset.inspectionTugX",
  "canvas.dataset.inspectionTugZ",
  "canvas.dataset.inspectionSpeed",
]) if (!source.includes(token)) throw new Error(`Inspection motion evidence is missing ${token}`);
fs.writeFileSync(path, source, "utf8");
console.log("Prepared live inspection-mode tug position and speed evidence.");
