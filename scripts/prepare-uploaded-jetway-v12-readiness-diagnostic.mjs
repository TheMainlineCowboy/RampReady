import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(path, "utf8");

const declarationMarker = "const cabThresholdV12Diagnostic =";
if (!source.includes(declarationMarker)) {
  const anchor = "        const individualConnectorGateCount = Number(group.userData.uploadedJetwayIndividualConnectorGateCount ?? -1);";
  if (!source.includes(anchor)) throw new Error(`${path}: v12 diagnostic declaration anchor is missing`);
  source = source.replace(anchor, `${anchor}
        const cabThresholdV12Diagnostic = "contact=" + (group.userData.uploadedJetwayCabContactAuthority || "missing")
          + "; static plane/clearance=" + String(group.userData.uploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters)
          + "/" + String(group.userData.uploadedJetwayStaticMinimumCabRampClearanceMeters)
          + "; A1 plane/clearance/vertical=" + String(group.userData.uploadedJetwayA1CabAircraftPlaneIntrusionMeters)
          + "/" + String(group.userData.uploadedJetwayA1CabRampClearanceMeters)
          + "/" + String(group.userData.uploadedJetwayA1CabVerticalOffsetMeters);`);
}

const messageMarker = "v12 threshold ${cabThresholdV12Diagnostic}";
if (!source.includes(messageMarker)) {
  const anchor = '${missingModels.length ? `; missing ${missingModels.join(", ")}` : ""}`';
  if (!source.includes(anchor)) throw new Error(`${path}: v12 diagnostic message anchor is missing`);
  source = source.replace(anchor, `; v12 threshold \${cabThresholdV12Diagnostic}\${missingModels.length ? \`; missing \${missingModels.join(", ")}\` : ""}\``);
}

for (const token of [
  declarationMarker,
  messageMarker,
  "uploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters",
  "uploadedJetwayStaticMinimumCabRampClearanceMeters",
  "uploadedJetwayA1CabAircraftPlaneIntrusionMeters",
  "uploadedJetwayA1CabRampClearanceMeters",
  "uploadedJetwayA1CabVerticalOffsetMeters",
]) {
  if (!source.includes(token)) throw new Error(`${path}: v12 readiness diagnostic is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared exact v12 supplied-Cab readiness diagnostics without changing any clearance threshold.");
