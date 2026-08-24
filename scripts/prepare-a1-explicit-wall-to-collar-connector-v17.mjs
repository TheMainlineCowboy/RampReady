import fs from "node:fs";

const runtimePath = "src/environment/correctUploadedJetwayInstallationV1.js";
const marker = "a1-explicit-measured-wall-to-exact-rotunda-collar-v17";
const endpointAuthority = "explicit-bgateg1-wall-point-to-exact-rotunda-collar-v17";
let source = fs.readFileSync(runtimePath, "utf8");
let migrationApplied = source.includes(marker);

if (!migrationApplied) {
  const syntheticEndpoint = `  const terminalPoint = new THREE.Vector3(\n    rotundaOpening.centerX + terminalDirection.x * terminalDistance,\n    rotundaOpening.centerY,\n    rotundaOpening.centerZ + terminalDirection.z * terminalDistance,\n  );\n  const collarPoint = new THREE.Vector3(rotundaOpening.collarX, rotundaOpening.centerY, rotundaOpening.collarZ);`;

  // Aug. 15 long-route preparation intentionally retires the old compact/synthetic
  // A1 terminal endpoint before this compatibility stage runs. In that state there
  // is nothing for v17 to migrate: the BGATE1 facade -> fixed dogleg -> remote
  // Rotunda path is owned by the later photo-authoritative route builders. Do not
  // resurrect a scalar short sleeve merely to satisfy this legacy migration hook.
  if (!source.includes(syntheticEndpoint)) {
    fs.writeFileSync(runtimePath, source, "utf8");
    console.log("Skipped retired A1 synthetic wall-endpoint migration; the Aug. 15 BGATE1 long fixed corridor/dogleg/remote-Rotunda path has already removed the compact endpoint.");
    process.exit(0);
  }

  source = source.replace(
    syntheticEndpoint,
    `  // ${marker}\n  // The final wall lock already carries the exact selected BGATE1 wall point in\n  // the same fleet-local coordinate frame as the transformed Rotunda. Do not\n  // rebuild that endpoint from a scalar distance along connectorToward: the\n  // authored Rotunda opening can differ from the wall normal by several degrees,\n  // which previously left the rendered sleeve beside the wall in overhead views.\n  const explicitTerminalWallX = Number(placement.terminalWallX);\n  const explicitTerminalWallZ = Number(placement.terminalWallZ);\n  if (![explicitTerminalWallX, explicitTerminalWallZ].every(Number.isFinite)) {\n    throw new Error("A1 explicit measured Terminal 4 wall point is missing from the final placement");\n  }\n  const syntheticTerminalPoint = new THREE.Vector3(\n    rotundaOpening.centerX + terminalDirection.x * terminalDistance,\n    rotundaOpening.centerY,\n    rotundaOpening.centerZ + terminalDirection.z * terminalDistance,\n  );\n  const terminalPoint = new THREE.Vector3(\n    explicitTerminalWallX,\n    rotundaOpening.centerY,\n    explicitTerminalWallZ,\n  );\n  const syntheticWallEndpointMissMeters = Math.hypot(\n    syntheticTerminalPoint.x - terminalPoint.x,\n    syntheticTerminalPoint.z - terminalPoint.z,\n  );\n  const collarPoint = new THREE.Vector3(rotundaOpening.collarX, rotundaOpening.centerY, rotundaOpening.collarZ);`,
  );

  const shellAnchor = `  const shellLength = visibleLength + rotundaOverlap + TERMINAL_HIDDEN_OVERLAP_METERS;`;
  if (!source.includes(shellAnchor)) throw new Error(`${runtimePath}: A1 final solid sleeve length anchor is missing`);
  source = source.replace(
    shellAnchor,
    `${shellAnchor}\n  const renderedWallOverlapMeters = TERMINAL_HIDDEN_OVERLAP_METERS;\n  const renderedRotundaOverlapMeters = rotundaOverlap;\n  if (!(renderedWallOverlapMeters >= 0.15 && renderedWallOverlapMeters <= 0.30)) {\n    throw new Error(\`A1 explicit wall sleeve lost its terminal overlap: \${renderedWallOverlapMeters} m\`);\n  }\n  if (!(renderedRotundaOverlapMeters >= 0.08 && renderedRotundaOverlapMeters <= 0.20)) {\n    throw new Error(\`A1 explicit wall sleeve lost its Rotunda overlap: \${renderedRotundaOverlapMeters} m\`);\n  }`,
  );

  const userDataAnchor = `  connector.userData.measuredWallDirection = [terminalDirection.x, terminalDirection.z];\n  connector.userData.visibleMainLengthMeters = visibleLength;`;
  if (!source.includes(userDataAnchor)) throw new Error(`${runtimePath}: A1 connector userData anchor is missing`);
  source = source.replace(
    userDataAnchor,
    `  connector.userData.measuredWallDirection = [terminalDirection.x, terminalDirection.z];\n  connector.userData.explicitWallEndpointAuthority = "${endpointAuthority}";\n  connector.userData.explicitWallEndpointX = terminalPoint.x;\n  connector.userData.explicitWallEndpointZ = terminalPoint.z;\n  connector.userData.syntheticWallEndpointMissMeters = syntheticWallEndpointMissMeters;\n  connector.userData.wallHiddenOverlapMeters = renderedWallOverlapMeters;\n  connector.userData.rotundaHiddenOverlapMeters = renderedRotundaOverlapMeters;\n  connector.userData.visibleMainLengthMeters = visibleLength;`,
  );

  const reportAnchor = `    connectorStyleAuthority: connector.userData.connectorStyleAuthority,\n    visibleConnectorLengthMeters: connector.userData.visibleMainLengthMeters,`;
  if (!source.includes(reportAnchor)) throw new Error(`${runtimePath}: A1 connector report anchor is missing`);
  source = source.replace(
    reportAnchor,
    `    connectorStyleAuthority: connector.userData.connectorStyleAuthority,\n    connectorEndpointAuthority: connector.userData.explicitWallEndpointAuthority,\n    connectorSyntheticWallEndpointMissMeters: connector.userData.syntheticWallEndpointMissMeters,\n    connectorWallHiddenOverlapMeters: connector.userData.wallHiddenOverlapMeters,\n    connectorRotundaHiddenOverlapMeters: connector.userData.rotundaHiddenOverlapMeters,\n    visibleConnectorLengthMeters: connector.userData.visibleMainLengthMeters,`,
  );

  const groupAnchor = `  group.userData.uploadedJetwayA1ConnectorStyleAuthority = report.connectorStyleAuthority;`;
  if (!source.includes(groupAnchor)) throw new Error(`${runtimePath}: A1 connector group telemetry anchor is missing`);
  source = source.replace(
    groupAnchor,
    `${groupAnchor}\n  group.userData.uploadedJetwayA1ConnectorEndpointAuthority = report.connectorEndpointAuthority;\n  group.userData.uploadedJetwayA1ConnectorSyntheticWallEndpointMissMeters = report.connectorSyntheticWallEndpointMissMeters;\n  group.userData.uploadedJetwayA1ConnectorWallHiddenOverlapMeters = report.connectorWallHiddenOverlapMeters;\n  group.userData.uploadedJetwayA1ConnectorRotundaHiddenOverlapMeters = report.connectorRotundaHiddenOverlapMeters;`,
  );
  migrationApplied = true;
}

if (migrationApplied) {
  for (const required of [
    marker,
    endpointAuthority,
    "const explicitTerminalWallX = Number(placement.terminalWallX);",
    "const explicitTerminalWallZ = Number(placement.terminalWallZ);",
    "syntheticWallEndpointMissMeters",
    "connectorEndpointAuthority",
    "uploadedJetwayA1ConnectorEndpointAuthority",
  ]) {
    if (!source.includes(required)) throw new Error(`${runtimePath}: final A1 explicit-wall connector is missing ${required}`);
  }
  if (source.includes("rotundaOpening.centerX + terminalDirection.x * terminalDistance,\n    rotundaOpening.centerY,\n    rotundaOpening.centerZ + terminalDirection.z * terminalDistance,\n  );\n  const collarPoint")) {
    throw new Error(`${runtimePath}: stale synthetic A1 terminal endpoint survived explicit-wall migration`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Connected A1's solid terminal sleeve from the exact measured BGATE1 wall point to the exact transformed Rotunda collar, retaining 0.18 m terminal and 0.12 m Rotunda hidden overlaps; the old scalar-direction endpoint is diagnostic only.");
