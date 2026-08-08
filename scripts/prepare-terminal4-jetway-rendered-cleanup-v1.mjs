import fs from "node:fs";

const staticRegistrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const staticVestibulePath = "src/environment/staticSolidTerminalVestibulesV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const a1ElbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const STATIC_SOLID_VESTIBULE_AUTHORITY = "57-static-short-solid-white-terminal-vestibules-v1";
const STATIC_SOLID_VESTIBULE_INSTANCE_COUNT = 228;
const A1_TERMINAL_WALL_HIDDEN_OVERLAP_METERS = 0.70;
const STATIC_TERMINAL_WALL_HIDDEN_OVERLAP_METERS = 0.70;
const A1_ROTUNDA_TUNNEL_INTERFACE_DEPTH_METERS = 0.72;

let staticRegistration = fs.readFileSync(staticRegistrationPath, "utf8");

const originalImport = 'import { addUploadedAirportJetwayStaticTerminalConnectors } from "./uploadedAirportJetwayTerminalConnector.js";';
const solidImport = 'import { addStaticSolidTerminalVestibules } from "./staticSolidTerminalVestibulesV1.js";';
if (staticRegistration.includes(originalImport)) {
  staticRegistration = staticRegistration.replace(originalImport, solidImport);
} else if (!staticRegistration.includes(solidImport)) {
  throw new Error(`${staticRegistrationPath}: static connector import anchor was not found`);
}
staticRegistration = staticRegistration.replace(
  /addUploadedAirportJetwayStaticTerminalConnectors\(THREE, fleet, placements\)/g,
  "addStaticSolidTerminalVestibules(THREE, fleet, placements)",
);
if (!staticRegistration.includes("addStaticSolidTerminalVestibules(THREE, fleet, placements)")) {
  throw new Error(`${staticRegistrationPath}: solid static vestibule call was not applied`);
}

// The prior static registration assumed the supplied model's tunnel axis was
// local +Z. The exact-head B15 evidence proved that assumption reverses the
// authored assembly: the Cab/open aircraft end lands at the terminal wall while
// the tunnel projects toward the apron. Measure the supplied Rotunda->Tunnel A
// axis from the exact A1 prototype and rotate each static parent as one rigid
// assembly so Rotunda is terminal-side and Cab is aircraft-side.
const oldEndpointResolve = `  const rotunda = model?.getObjectByName("Rotunda") || model?.getObjectByName("Rotunda_Jetway_0");\n  if (!model || !rotunda) {\n    throw new Error("Static jetway registration could not measure the exact supplied Rotunda/model-root offset");\n  }`;
const measuredEndpointResolve = `  const rotunda = model?.getObjectByName("Rotunda") || model?.getObjectByName("Rotunda_Jetway_0");\n  const tunnelA = model?.getObjectByName("Tunnel_A") || model?.getObjectByName("Tunnel_A_Jetway_0");\n  if (!model || !rotunda || !tunnelA) {\n    throw new Error("Static jetway registration could not measure the exact supplied Rotunda/model-root/bridge-axis evidence");\n  }`;
if (staticRegistration.includes(oldEndpointResolve)) {
  staticRegistration = staticRegistration.replace(oldEndpointResolve, measuredEndpointResolve);
} else if (!staticRegistration.includes("bridgeAxisHeadingRadians")) {
  throw new Error(`${staticRegistrationPath}: exact supplied bridge-axis endpoint anchor was not found`);
}

const oldCenterBlock = `  const worldCenter = worldBounds.getCenter(new THREE.Vector3());\n  const worldSize = worldBounds.getSize(new THREE.Vector3());\n  const localCenter = a1Anchor.worldToLocal(worldCenter.clone());`;
const measuredCenterBlock = `  const worldCenter = worldBounds.getCenter(new THREE.Vector3());\n  const tunnelWorldBounds = new THREE.Box3().setFromObject(tunnelA);\n  if (tunnelWorldBounds.isEmpty()) throw new Error("Exact supplied Tunnel A has empty bounds during static registration");\n  const tunnelWorldCenter = tunnelWorldBounds.getCenter(new THREE.Vector3());\n  const localCenter = a1Anchor.worldToLocal(worldCenter.clone());\n  const localTunnelCenter = a1Anchor.worldToLocal(tunnelWorldCenter.clone());\n  const authoredBridgeAxis = localTunnelCenter.clone().sub(localCenter);\n  authoredBridgeAxis.y = 0;\n  if (authoredBridgeAxis.lengthSq() < 0.25) throw new Error("Exact supplied Rotunda->Tunnel A bridge axis is degenerate");\n  authoredBridgeAxis.normalize();\n  const bridgeAxisHeadingRadians = Math.atan2(authoredBridgeAxis.x, authoredBridgeAxis.z);`;
if (staticRegistration.includes(oldCenterBlock)) {
  staticRegistration = staticRegistration.replace(oldCenterBlock, measuredCenterBlock);
} else if (!staticRegistration.includes("const bridgeAxisHeadingRadians =")) {
  throw new Error(`${staticRegistrationPath}: bridge-axis measurement insertion anchor was not found`);
}

const oldOffsetReturn = `    horizontalMagnitude,\n    authority: ROOT_OFFSET_AUTHORITY,`;
const measuredOffsetReturn = `    horizontalMagnitude,\n    bridgeAxisHeadingRadians,\n    authority: ROOT_OFFSET_AUTHORITY,`;
if (staticRegistration.includes(oldOffsetReturn)) {
  staticRegistration = staticRegistration.replace(oldOffsetReturn, measuredOffsetReturn);
} else if (!staticRegistration.includes("bridgeAxisHeadingRadians,")) {
  throw new Error(`${staticRegistrationPath}: bridge-axis return anchor was not found`);
}

const oldStaticYaw = `  const bridgeDistance = Math.hypot(bridgeDx, bridgeDz);\n  const yaw = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;`;
const measuredStaticYaw = `  const bridgeDistance = Math.hypot(bridgeDx, bridgeDz);\n  const targetHeading = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;\n  const sourceBridgeAxisHeading = Number(authoredRotundaOffset.bridgeAxisHeadingRadians);\n  if (!Number.isFinite(sourceBridgeAxisHeading)) {\n    throw new Error(\`Static jetway \${placement.gate} is missing exact supplied bridge-axis heading\`);\n  }\n  const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);`;
if (staticRegistration.includes(oldStaticYaw)) {
  staticRegistration = staticRegistration.replace(oldStaticYaw, measuredStaticYaw);
} else if (!staticRegistration.includes("targetHeading - sourceBridgeAxisHeading")) {
  throw new Error(`${staticRegistrationPath}: static parent orientation anchor was not found`);
}

const originalBatchBlock = `  const staticBatchesGroup = fleet.getObjectByName("UploadedAirportJetwayStaticExactGlbInstances");\n  const staticBatches = staticBatchesGroup?.children?.filter((entry) => entry.isInstancedMesh) || [];\n  if (staticBatches.length !== 7 || staticBatches.some((batch) => batch.count !== 57)) {\n    throw new Error(\`Static exact jetway instance batches are invalid: batches=\${staticBatches.length}, counts=\${staticBatches.map((batch) => batch.count).join(",")}\`);\n  }\n  applyPlacementDeltaToStaticInstances(THREE, staticBatches, staticOriginalPlacements, staticRegisteredPlacements);`;

const correctedBatchBlock = `  const staticBatchesGroup = fleet.getObjectByName("UploadedAirportJetwayStaticExactGlbInstances");\n  const staticBatches = staticBatchesGroup?.children?.filter((entry) => entry.isInstancedMesh) || [];\n  if (staticBatches.length !== 7 || staticBatches.some((batch) => batch.count !== 57)) {\n    throw new Error(\`Static exact jetway instance batches are invalid: batches=\${staticBatches.length}, counts=\${staticBatches.map((batch) => batch.count).join(",")}\`);\n  }\n  // Any legacy closure instances were authored in the pre-registration frame.\n  // Keep them co-registered if they are present, even though the production\n  // build no longer intentionally creates those detached Cab-box batches.\n  const staticPortalClosures = fleet.getObjectByName("UploadedAirportJetwayStaticPortalClosures");\n  const staticClosureBatches = staticPortalClosures?.children?.filter((entry) => entry.isInstancedMesh) || [];\n  if (staticPortalClosures && (staticClosureBatches.length !== 6 || staticClosureBatches.some((batch) => batch.count !== 57 && batch.count !== 114))) {\n    throw new Error(\`Static portal closure batches are invalid: batches=\${staticClosureBatches.length}, counts=\${staticClosureBatches.map((batch) => batch.count).join(",")}\`);\n  }\n  applyPlacementDeltaToStaticInstances(\n    THREE,\n    [...staticBatches, ...staticClosureBatches],\n    staticOriginalPlacements,\n    staticRegisteredPlacements,\n  );`;

if (staticRegistration.includes(originalBatchBlock)) {
  staticRegistration = staticRegistration.replace(originalBatchBlock, correctedBatchBlock);
} else if (!staticRegistration.includes("staticClosureBatches")) {
  throw new Error(`${staticRegistrationPath}: static placement-delta block was not found`);
}

for (const token of [
  "const tunnelA = model?.getObjectByName(\"Tunnel_A\")",
  "const bridgeAxisHeadingRadians = Math.atan2(authoredBridgeAxis.x, authoredBridgeAxis.z);",
  "bridgeAxisHeadingRadians,",
  "const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);",
]) {
  if (!staticRegistration.includes(token)) {
    throw new Error(`${staticRegistrationPath}: exact supplied parent-orientation repair is missing ${token}`);
  }
}
fs.writeFileSync(staticRegistrationPath, staticRegistration, "utf8");

// Use the same hidden terminal-wall seal for the 57 static vestibules. This is
// hidden inside the facade only; the visible wall-to-Rotunda span remains 2.4 m.
let staticVestibule = fs.readFileSync(staticVestibulePath, "utf8");
if (staticVestibule.includes("const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;")) {
  staticVestibule = staticVestibule.replace(
    "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
    `const TERMINAL_HIDDEN_OVERLAP_METERS = ${STATIC_TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`,
  );
} else if (!staticVestibule.includes(`const TERMINAL_HIDDEN_OVERLAP_METERS = ${STATIC_TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`)) {
  throw new Error(`${staticVestibulePath}: static terminal-wall overlap anchor was not found`);
}
fs.writeFileSync(staticVestibulePath, staticVestibule, "utf8");

// The static connector implementation above deliberately replaces the former
// three generated connector batches with one instanced solid shell batch. Make
// readiness prove that exact topology rather than preserving the obsolete
// three-batch corridor contract. Four shell transforms per gate x 57 gates = 228.
let readiness = fs.readFileSync(readinessPath, "utf8");
const performanceAuthorityLine = 'const PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1";';
if (!readiness.includes("const STATIC_CONNECTOR_AUTHORITY =")) {
  if (!readiness.includes(performanceAuthorityLine)) {
    throw new Error(`${readinessPath}: performance authority anchor is missing`);
  }
  readiness = readiness.replace(
    performanceAuthorityLine,
    `${performanceAuthorityLine}\nconst STATIC_CONNECTOR_AUTHORITY = "${STATIC_SOLID_VESTIBULE_AUTHORITY}";\nconst STATIC_CONNECTOR_INSTANCE_COUNT = ${STATIC_SOLID_VESTIBULE_INSTANCE_COUNT};`,
  );
}

const connectorBatchTelemetryLine = "          const staticConnectorBatchCount = Number(group.userData.uploadedJetwayStaticConnectorBatchCount ?? -1);";
if (!readiness.includes("const staticConnectorInstanceCount =")) {
  if (!readiness.includes(connectorBatchTelemetryLine)) {
    throw new Error(`${readinessPath}: static connector batch telemetry anchor is missing`);
  }
  readiness = readiness.replace(
    connectorBatchTelemetryLine,
    `${connectorBatchTelemetryLine}\n          const staticConnectorInstanceCount = Number(group.userData.uploadedJetwayStaticConnectorInstanceCount ?? -1);\n          const staticConnectorAuthority = group.userData.uploadedJetwayStaticConnectorBatchAuthority || "missing";`,
  );
}

if (readiness.includes("            || staticConnectorBatchCount !== 3")) {
  readiness = readiness.replace(
    "            || staticConnectorBatchCount !== 3",
    `            || staticConnectorBatchCount !== 1\n            || staticConnectorInstanceCount !== STATIC_CONNECTOR_INSTANCE_COUNT\n            || staticConnectorAuthority !== STATIC_CONNECTOR_AUTHORITY`,
  );
}

const oldConnectorDiagnostic = 'connectors=${staticConnectorGateCount}/${staticConnectorBatchCount}/${individualConnectorGateCount}';
const solidConnectorDiagnostic = 'connectors=${staticConnectorGateCount}/${staticConnectorBatchCount}/${staticConnectorInstanceCount}/${staticConnectorAuthority}/${individualConnectorGateCount}';
if (readiness.includes(oldConnectorDiagnostic)) {
  readiness = readiness.replace(oldConnectorDiagnostic, solidConnectorDiagnostic);
}

// Do not rewrite the bogie readiness guard here. The downstream
// prepare-a1-bogie-readiness-v1.mjs stage owns the final measured multi-point
// ground-contact validation and upgrades the historical guard after this visual
// cleanup has finished. Keeping one owner prevents the two preparers from
// rewriting the same gate into incompatible intermediate forms.

for (const token of [
  `const STATIC_CONNECTOR_AUTHORITY = "${STATIC_SOLID_VESTIBULE_AUTHORITY}";`,
  `const STATIC_CONNECTOR_INSTANCE_COUNT = ${STATIC_SOLID_VESTIBULE_INSTANCE_COUNT};`,
  "const staticConnectorInstanceCount =",
  "const staticConnectorAuthority =",
  "staticConnectorBatchCount !== 1",
  "staticConnectorInstanceCount !== STATIC_CONNECTOR_INSTANCE_COUNT",
  "staticConnectorAuthority !== STATIC_CONNECTOR_AUTHORITY",
  solidConnectorDiagnostic,
  "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6",
]) {
  if (!readiness.includes(token)) {
    throw new Error(`${readinessPath}: current static connector readiness is missing ${token}`);
  }
}
if (readiness.includes("staticConnectorBatchCount !== 3")) {
  throw new Error(`${readinessPath}: obsolete three-batch static connector readiness survived cleanup`);
}
fs.writeFileSync(readinessPath, readiness, "utf8");

// Keep the visible A1 wall-to-Rotunda leg source-derived, but extend only the
// terminal-side hidden seal into the real wall so the exterior cannot float detached.
// The exact supplied Tunnel A already penetrates/overlaps the authored Rotunda
// along the bridge axis. The remaining visible hole is therefore a shell closure
// problem inside that overlap, not a longitudinal gap to fill or a reason to move
// either supplied child. Convert the signed interface offset into explicit gap/
// overlap evidence and close only a short section of the existing overlap.
let a1Elbow = fs.readFileSync(a1ElbowPath, "utf8");
if (a1Elbow.includes("const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;")) {
  a1Elbow = a1Elbow.replace(
    "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
    `const TERMINAL_HIDDEN_OVERLAP_METERS = ${A1_TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`,
  );
} else if (!a1Elbow.includes(`const TERMINAL_HIDDEN_OVERLAP_METERS = ${A1_TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`)) {
  throw new Error(`${a1ElbowPath}: terminal-wall hidden-overlap anchor was not found`);
}

const oldRotundaTunnelInterface = `  const rotundaTunnelAGapMeters = tunnelRotundaSurfacePoint.clone().sub(rotundaBridgeSurfacePoint).dot(bridgeDirection);\n  if (!(rotundaTunnelAGapMeters > -0.75 && rotundaTunnelAGapMeters < MAXIMUM_ROTUNDA_TUNNEL_A_GAP_METERS)) {\n    throw new Error(\`A1 Rotunda-to-Tunnel-A interface gap is invalid: \${rotundaTunnelAGapMeters}\`);\n  }`;
const overlapAwareRotundaTunnelInterface = `  const rotundaTunnelAInterfaceOffsetMeters = tunnelRotundaSurfacePoint.clone().sub(rotundaBridgeSurfacePoint).dot(bridgeDirection);\n  const rotundaTunnelAAuthoredOverlapMeters = Math.max(0, -rotundaTunnelAInterfaceOffsetMeters);\n  const rotundaTunnelAGapMeters = Math.max(0, rotundaTunnelAInterfaceOffsetMeters);\n  if (!(rotundaTunnelAAuthoredOverlapMeters < 4.5 && rotundaTunnelAGapMeters < MAXIMUM_ROTUNDA_TUNNEL_A_GAP_METERS)) {\n    throw new Error(\`A1 Rotunda-to-Tunnel-A interface is invalid: offset=\${rotundaTunnelAInterfaceOffsetMeters}, overlap=\${rotundaTunnelAAuthoredOverlapMeters}, gap=\${rotundaTunnelAGapMeters}\`);\n  }`;
if (a1Elbow.includes(oldRotundaTunnelInterface)) {
  a1Elbow = a1Elbow.replace(oldRotundaTunnelInterface, overlapAwareRotundaTunnelInterface);
} else if (!a1Elbow.includes("const rotundaTunnelAAuthoredOverlapMeters = Math.max(0, -rotundaTunnelAInterfaceOffsetMeters);")) {
  throw new Error(`${a1ElbowPath}: Rotunda/Tunnel A signed-interface anchor was not found`);
}

const oldBridgeSealEnd = "  const bridgeSealEndFleet = tunnelRotundaSurfacePoint.clone().addScaledVector(bridgeDirection, TUNNEL_A_HIDDEN_OVERLAP_METERS);";
const overlapAwareBridgeSealEnd = `  const bridgeSealEndFleet = rotundaTunnelAAuthoredOverlapMeters > 0\n    ? rotundaBridgeSurfacePoint.clone().addScaledVector(bridgeDirection, ${A1_ROTUNDA_TUNNEL_INTERFACE_DEPTH_METERS.toFixed(2)})\n    : tunnelRotundaSurfacePoint.clone().addScaledVector(bridgeDirection, TUNNEL_A_HIDDEN_OVERLAP_METERS);`;
if (a1Elbow.includes(oldBridgeSealEnd)) {
  a1Elbow = a1Elbow.replace(oldBridgeSealEnd, overlapAwareBridgeSealEnd);
} else if (!a1Elbow.includes("rotundaTunnelAAuthoredOverlapMeters > 0")) {
  throw new Error(`${a1ElbowPath}: Rotunda/Tunnel A sleeve endpoint anchor was not found`);
}

for (const token of [
  "function projectedSurfaceDistance(vertices, origin, direction)",
  "const rotundaVertices = collectObjectVerticesInFleet(THREE, fleet, rotunda);",
  "const rotundaTerminalSurfaceMeters = projectedSurfaceDistance(rotundaVertices, rotundaCenter, terminalDirection);",
  "const rotundaSurfacePoint = rotundaCenter.clone().addScaledVector(terminalDirection, rotundaTerminalSurfaceMeters);",
  "const visibleTerminalLegMeters = fixedWallPoint.distanceTo(rotundaSurfacePoint);",
  `const TERMINAL_HIDDEN_OVERLAP_METERS = ${A1_TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`,
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.10;",
  "shellEnd = rotundaSurfacePoint.clone().addScaledVector(terminalToRotunda, ROTUNDA_SHELL_OVERLAP_METERS)",
  "uploadedJetwayA1AuthoredRotundaTerminalSurfaceMeters",
  "const rotundaTunnelAAuthoredOverlapMeters = Math.max(0, -rotundaTunnelAInterfaceOffsetMeters);",
  "rotundaTunnelAAuthoredOverlapMeters > 0",
]) {
  if (!a1Elbow.includes(token)) {
    throw new Error(`${a1ElbowPath}: authored-Rotunda-surface A1 vestibule/interface contract is missing ${token}`);
  }
}
for (const forbidden of [
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.82;",
  "rotundaTunnelAGapMeters > -0.75",
  "collarPoint = fixedWallPoint.clone().addScaledVector(terminalDirection, -VISIBLE_TERMINAL_LEG_METERS)",
]) {
  if (a1Elbow.includes(forbidden)) {
    throw new Error(`${a1ElbowPath}: obsolete detached/swallowing A1 connector logic survived cleanup: ${forbidden}`);
  }
}
fs.writeFileSync(a1ElbowPath, a1Elbow, "utf8");

console.log(`Prepared rendered Terminal 4 cleanup: all 57 static gates now measure the exact supplied Rotunda->Tunnel A axis before rigid-parent registration, use short solid white vestibules sealed ${STATIC_TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)} m into the real facade, and keep the Rotunda terminal-side/Cab aircraft-side; A1 remains source-driven, seals ${A1_TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)} m into the terminal wall, and closes only ${A1_ROTUNDA_TUNNEL_INTERFACE_DEPTH_METERS.toFixed(2)} m of the authored Rotunda/Tunnel A overlap instead of inventing a longitudinal filler; downstream measured bogie readiness remains the sole owner of final exact-model ground-contact validation.`);
