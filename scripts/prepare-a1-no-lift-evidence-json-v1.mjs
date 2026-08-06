import fs from "node:fs";

const path = "tests/browser/a1-ground-contact-evidence.spec.js";
let source = fs.readFileSync(path, "utf8");

const anchor = `      aircraftDoorVerticalErrorMeters: Number(runtime.inspectionAircraftDoorVerticalErrorMeters),
      jetwayVerticalFitAuthority: runtime.inspectionAircraftJetwayVerticalFitAuthority,`;
const evidence = `      aircraftDoorVerticalErrorMeters: Number(runtime.inspectionAircraftDoorVerticalErrorMeters),
      aircraftDoorSignedVerticalGapMeters: Number(runtime.inspectionAircraftDoorSignedVerticalGapMeters),
      jetwayRequestedVerticalFitMeters: Number(runtime.inspectionAircraftJetwayRequestedVerticalFitMeters),
      jetwayAppliedVerticalFitMeters: Number(runtime.inspectionAircraftJetwayVerticalFitMeters),
      jetwayAuthoredBogieGroundPreserved: runtime.inspectionAircraftJetwayAuthoredBogieGroundPreserved,
      jetwayVerticalFitAuthority: runtime.inspectionAircraftJetwayVerticalFitAuthority,`;

if (source.includes(anchor)) {
  source = source.replace(anchor, evidence);
} else if (!source.includes("jetwayAuthoredBogieGroundPreserved:")) {
  throw new Error(`${path}: no-lift evidence JSON anchor is missing`);
}

for (const token of [
  "aircraftDoorSignedVerticalGapMeters:",
  "jetwayRequestedVerticalFitMeters:",
  "jetwayAppliedVerticalFitMeters:",
  "jetwayAuthoredBogieGroundPreserved:",
  "jetwayVerticalFitAuthority:",
]) {
  if (!source.includes(token)) throw new Error(`${path}: retained no-lift JSON evidence is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Retained the signed A1 door gap, requested versus zero applied jetway lift, and grounded-bogie preservation in the exact-head JSON artifact.");
