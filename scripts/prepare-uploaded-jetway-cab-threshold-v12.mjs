import fs from "node:fs";

const CONTACT_AUTHORITY = "supplied-cab-aircraft-side-opening-threshold-v12";

function insertAfter(path, anchor, addition, marker, required = true) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return true;
  if (!source.includes(anchor)) {
    if (required) throw new Error(`${path}: missing Cab-threshold anchor ${anchor}`);
    return false;
  }
  source = source.replace(anchor, `${anchor}\n${addition}`);
  fs.writeFileSync(path, source, "utf8");
  return true;
}

function ensureTokens(path, tokens) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path}: missing Cab-threshold token ${token}`);
  }
}

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
if (fs.existsSync(fleetPath)) {
  const fleetSource = fs.readFileSync(fleetPath, "utf8");
  if (fleetSource.includes("measureUploadedJetwayFull3DPose")) {
    // Keep these assignments after the canonical full-3D replacement block so
    // its exact text remains recognizable on every later preparation pass.
    insertAfter(
      fleetPath,
      "          anchor.userData.uploadedJetwayArticulation = articulation;",
      `          articulation.cabAircraftPlaneIntrusion = measurement.cabAircraftPlaneIntrusion;
          articulation.cabRampClearance = measurement.cabRampClearance;`,
      "articulation.cabAircraftPlaneIntrusion = measurement.cabAircraftPlaneIntrusion",
    );
    insertAfter(
      fleetPath,
      "      group.userData.uploadedJetwayStaticMaximumCabHeightErrorMeters = staticFleet.maximumHeightError;",
      `      group.userData.uploadedJetwayCabContactAuthority = sourcePose.cabContactAuthority;
      group.userData.uploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters = staticFleet.maximumAircraftPlaneIntrusion;
      group.userData.uploadedJetwayStaticMinimumCabRampClearanceMeters = staticFleet.minimumCabRampClearance;`,
      "uploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters",
    );
    insertAfter(
      fleetPath,
      "      group.userData.uploadedJetwayA1CabNormalErrorDegrees = a1Articulation?.cabNormalErrorDegrees;",
      `      group.userData.uploadedJetwayA1CabAircraftPlaneIntrusionMeters = a1Articulation?.cabAircraftPlaneIntrusion;
      group.userData.uploadedJetwayA1CabRampClearanceMeters = a1Articulation?.cabRampClearance;
      group.userData.uploadedJetwayA1CabVerticalOffsetMeters = a1Articulation?.cabVerticalOffset;`,
      "uploadedJetwayA1CabAircraftPlaneIntrusionMeters",
    );
    ensureTokens(fleetPath, [
      "sourcePose.cabContactAuthority",
      "staticFleet.maximumAircraftPlaneIntrusion",
      "staticFleet.minimumCabRampClearance",
      "measurement.cabAircraftPlaneIntrusion",
      "measurement.cabRampClearance",
      "a1Articulation?.cabVerticalOffset",
    ]);
  }
}

const readyPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
if (fs.existsSync(readyPath)) {
  const readySource = fs.readFileSync(readyPath, "utf8");
  if (readySource.includes("staticMaximumCabHeightError")) {
    // Insert all v12 declarations after the canonical v11 measurement block.
    // This preserves the exact v11 block so repeated preparation cannot add it twice.
    insertAfter(
      readyPath,
      '          + "; A1 ground/order=" + a1StairGround + "/" + a1BogieGround + "/" + a1PartOrderValid',
      `        const cabContactAuthority = group.userData.uploadedJetwayCabContactAuthority || "missing";
        const staticMaximumAircraftPlaneIntrusion = Number(group.userData.uploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters ?? Infinity);
        const staticMinimumCabRampClearance = Number(group.userData.uploadedJetwayStaticMinimumCabRampClearanceMeters ?? -Infinity);
        const a1CabAircraftPlaneIntrusion = Number(group.userData.uploadedJetwayA1CabAircraftPlaneIntrusionMeters ?? Infinity);
        const a1CabRampClearance = Number(group.userData.uploadedJetwayA1CabRampClearanceMeters ?? -Infinity);
        const a1CabVerticalOffset = Number(group.userData.uploadedJetwayA1CabVerticalOffsetMeters ?? NaN);`,
      "const staticMaximumAircraftPlaneIntrusion = Number",
    );
    insertAfter(
      readyPath,
      "          || staticMaximumCabHeightError > 0.05",
      `          || cabContactAuthority !== "${CONTACT_AUTHORITY}"
          || staticMaximumAircraftPlaneIntrusion > 0.05
          || staticMinimumCabRampClearance < 1.5`,
      "staticMaximumAircraftPlaneIntrusion > 0.05",
    );
    insertAfter(
      readyPath,
      "          || a1CabHeightError > 0.05",
      `          || a1CabAircraftPlaneIntrusion > 0.05
          || a1CabRampClearance < 1.5
          || !(a1CabVerticalOffset > -1.33 && a1CabVerticalOffset < -1.30)`,
      "a1CabAircraftPlaneIntrusion > 0.05",
    );
    ensureTokens(readyPath, [
      CONTACT_AUTHORITY,
      "staticMaximumAircraftPlaneIntrusion > 0.05",
      "staticMinimumCabRampClearance < 1.5",
      "a1CabAircraftPlaneIntrusion > 0.05",
      "a1CabRampClearance < 1.5",
      "a1CabVerticalOffset > -1.33",
    ]);
  }
}

const terminalPath = "src/environment/authoredTerminal4Visual.js";
if (fs.existsSync(terminalPath)) {
  const terminalSource = fs.readFileSync(terminalPath, "utf8");
  if (terminalSource.includes("authoredTerminal4UploadedJetwayStaticMaximumCabHeightErrorMeters")) {
    insertAfter(
      terminalPath,
      "  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabHeightErrorMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabHeightErrorMeters;",
      `  environment.userData.authoredTerminal4UploadedJetwayCabContactAuthority = sourcePlacedJetways.userData.uploadedJetwayCabContactAuthority;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticMinimumCabRampClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMinimumCabRampClearanceMeters;`,
      "authoredTerminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters",
    );
    insertAfter(
      terminalPath,
      "  environment.userData.authoredTerminal4UploadedJetwayA1CabHeightErrorMeters = sourcePlacedJetways.userData.uploadedJetwayA1CabHeightErrorMeters;",
      `  environment.userData.authoredTerminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters = sourcePlacedJetways.userData.uploadedJetwayA1CabAircraftPlaneIntrusionMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1CabRampClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1CabRampClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1CabVerticalOffsetMeters = sourcePlacedJetways.userData.uploadedJetwayA1CabVerticalOffsetMeters;`,
      "authoredTerminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters",
    );
    insertAfter(
      terminalPath,
      "    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabHeightErrorMeters) > 0.05",
      `    || sourcePlacedJetways.userData.uploadedJetwayCabContactAuthority !== "${CONTACT_AUTHORITY}"
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticMinimumCabRampClearanceMeters) < 1.5`,
      "uploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters) > 0.05",
    );
    insertAfter(
      terminalPath,
      "    || Number(sourcePlacedJetways.userData.uploadedJetwayA1CabHeightErrorMeters) > 0.05",
      `    || Number(sourcePlacedJetways.userData.uploadedJetwayA1CabAircraftPlaneIntrusionMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1CabRampClearanceMeters) < 1.5
    || !(Number(sourcePlacedJetways.userData.uploadedJetwayA1CabVerticalOffsetMeters) > -1.33
      && Number(sourcePlacedJetways.userData.uploadedJetwayA1CabVerticalOffsetMeters) < -1.30)`,
      "uploadedJetwayA1CabAircraftPlaneIntrusionMeters) > 0.05",
    );
  }
}

const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
if (fs.existsSync(runtimePath)) {
  const runtimeSource = fs.readFileSync(runtimePath, "utf8");
  if (runtimeSource.includes("terminal4UploadedJetwayA1CabHeightErrorMeters")) {
    insertAfter(
      runtimePath,
      '    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumCabHeightErrorMeters = "loading";',
      `    renderer.domElement.dataset.terminal4UploadedJetwayCabContactAuthority = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayStaticMinimumCabRampClearanceMeters = "loading";`,
      'dataset.terminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters = "loading"',
    );
    insertAfter(
      runtimePath,
      '    renderer.domElement.dataset.terminal4UploadedJetwayA1CabHeightErrorMeters = "loading";',
      `    renderer.domElement.dataset.terminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1CabRampClearanceMeters = "loading";
    renderer.domElement.dataset.terminal4UploadedJetwayA1CabVerticalOffsetMeters = "loading";`,
      'dataset.terminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters = "loading"',
    );
    insertAfter(
      runtimePath,
      "        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumCabHeightErrorMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabHeightErrorMeters) ? environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabHeightErrorMeters.toFixed(3) : \"missing\";",
      `        renderer.domElement.dataset.terminal4UploadedJetwayCabContactAuthority = environment.userData.authoredTerminal4UploadedJetwayCabContactAuthority || "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters) ? environment.userData.authoredTerminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMinimumCabRampClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayStaticMinimumCabRampClearanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayStaticMinimumCabRampClearanceMeters.toFixed(3) : "missing";`,
      "dataset.terminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters = Number.isFinite",
    );
    insertAfter(
      runtimePath,
      "        renderer.domElement.dataset.terminal4UploadedJetwayA1CabHeightErrorMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1CabHeightErrorMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1CabHeightErrorMeters.toFixed(3) : \"missing\";",
      `        renderer.domElement.dataset.terminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabRampClearanceMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1CabRampClearanceMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1CabRampClearanceMeters.toFixed(3) : "missing";
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabVerticalOffsetMeters = Number.isFinite(environment.userData.authoredTerminal4UploadedJetwayA1CabVerticalOffsetMeters) ? environment.userData.authoredTerminal4UploadedJetwayA1CabVerticalOffsetMeters.toFixed(3) : "missing";`,
      "dataset.terminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters = Number.isFinite",
    );
    insertAfter(
      runtimePath,
      '        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumCabHeightErrorMeters = "load-error";',
      `        renderer.domElement.dataset.terminal4UploadedJetwayCabContactAuthority = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayStaticMinimumCabRampClearanceMeters = "load-error";`,
      'dataset.terminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters = "load-error"',
    );
    insertAfter(
      runtimePath,
      '        renderer.domElement.dataset.terminal4UploadedJetwayA1CabHeightErrorMeters = "load-error";',
      `        renderer.domElement.dataset.terminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabRampClearanceMeters = "load-error";
        renderer.domElement.dataset.terminal4UploadedJetwayA1CabVerticalOffsetMeters = "load-error";`,
      'dataset.terminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters = "load-error"',
    );
  }
}

console.log(`Prepared ${CONTACT_AUTHORITY}: the supplied Cab uses its real doorway threshold and cannot pass while crossing the aircraft plane or dropping toward the ramp.`);
