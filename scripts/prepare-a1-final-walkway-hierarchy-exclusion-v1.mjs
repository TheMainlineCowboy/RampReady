import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-source-hierarchy-walkway-exclusion-v1";
const directionMarker = "a1-grounded-terminal-side-direction-v1";
let source = fs.readFileSync(runtimePath, "utf8");

// This wrapper is intentionally valid in two build phases. prepare:terminal4-runtime
// already runs prepare-a1-terminal-connector-v11, which has a full ancestor/source
// hierarchy exclusion. The simulator-quality pass later replaces the wall finder
// with v14 triangle qualification, so this script must strengthen that later form
// without rejecting the already-safe v11 form or leaving a marker that could make
// a later replacement look prepared when it is not.
const hasV11HierarchyExclusion = source.includes("hierarchyObject.userData?.sourceName")
  && source.includes("hierarchyNode.userData?.sourceName")
  && source.includes("/T4[_ -]?WALK|WALKWAY|JETWAY|CONNECTOR|PORTAL/i");
const hasFinalHierarchyExclusion = source.includes("sourceHierarchyNode.userData?.sourceName")
  && source.includes(marker);

// The v14 triangle finder initially checks only node.name. Upgrade that exact
// runtime form so a structural-looking child mesh still gets rejected whenever
// any converted ancestor/source identity belongs to T4_WALK/walkway/portal.
const nodeNameOnlyFilter = `    if (rejectedNodeName.test(node.name || "")) return;`;
const hierarchyFilter = `    // ${marker}
    let sourceHierarchyNode = node;
    let sourceHierarchyRejected = false;
    while (sourceHierarchyNode) {
      const sourceHierarchyIdentity = [
        sourceHierarchyNode.name,
        sourceHierarchyNode.userData?.sourceName,
        sourceHierarchyNode.userData?.sourceModel,
        sourceHierarchyNode.userData?.sourcePart,
        sourceHierarchyNode.userData?.sourceObject,
      ].filter(Boolean).join(" ");
      if (/T4[_ -]?WALK|WALKWAY|JETWAY|CONNECTOR|PORTAL/i.test(sourceHierarchyIdentity)) {
        sourceHierarchyRejected = true;
        break;
      }
      sourceHierarchyNode = sourceHierarchyNode.parent;
    }
    if (sourceHierarchyRejected) {
      diagnostics.walkwayHierarchyRejectedCount = (diagnostics.walkwayHierarchyRejectedCount || 0) + 1;
      return;
    }
    if (rejectedNodeName.test(node.name || "")) return;`;

if (!hasV11HierarchyExclusion && !hasFinalHierarchyExclusion) {
  if (!source.includes(nodeNameOnlyFilter)) {
    throw new Error(`${runtimePath}: A1 wall finder has neither the safe v11 hierarchy exclusion nor the v14 node-name anchor to strengthen`);
  }
  source = source.replace(nodeNameOnlyFilter, hierarchyFilter);
}

// The following grounded-wall blocks exist only after the simulator-quality
// grounded-terminal pass. When present, bind the hierarchy exclusion into the
// selected candidate, gate and telemetry. During the earlier v11 runtime-prep
// phase they are intentionally absent and the v11 hierarchy contract is enough.
const hasGroundedA1Authority = source.includes("a1GroundedBuildingConnection")
  && source.includes("elevatedWalkwayClearanceVerified");
if (hasGroundedA1Authority) {
  // The previous finder disabled its preferred-direction hemisphere whenever
  // height <= 2.2 m. A1 then replaced the passenger-level terminal-side result
  // with the nearest ramp-level BGATE/DGATE triangle even when that triangle was
  // on the opposite side of the source jetway. Preserve the same terminal-side
  // hemisphere during A1's grounded proof instead of allowing nearest-distance
  // to select the south-side corridor corner.
  const finderSignature = "function findTerminalWallConnection(THREE, terminal, originX, originZ, preferredX, preferredZ, height) {";
  const finderSignatureDirected = "function findTerminalWallConnection(THREE, terminal, originX, originZ, preferredX, preferredZ, height, forcePreferredHemisphere = false) {";
  if (!source.includes(directionMarker)) {
    if (source.includes(finderSignature)) source = source.replace(finderSignature, finderSignatureDirected);
    if (!source.includes(finderSignatureDirected)) {
      throw new Error(`${runtimePath}: A1 direction-preserving wall finder signature is unavailable`);
    }
    const hemisphereAnchor = "  const requirePreferredHemisphere = height > 2.2; // A1 grounded-facade search v34 overhead-walkway-footprint-exclusion";
    const hemisphereDirected = `  const requirePreferredHemisphere = height > 2.2 || forcePreferredHemisphere; // ${directionMarker}`;
    if (!source.includes(hemisphereAnchor)) {
      throw new Error(`${runtimePath}: A1 grounded search still lacks the expected height-only direction toggle`);
    }
    source = source.replace(hemisphereAnchor, hemisphereDirected);

    const groundedCall = `      const groundedConnection = findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        -ux,
        -uz,
        1.25,
      );`;
    const groundedDirectedCall = `      const groundedConnection = findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        -ux,
        -uz,
        1.25,
        true,
      );`;
    if (!source.includes(groundedCall)) {
      throw new Error(`${runtimePath}: A1 grounded wall call is unavailable for terminal-side enforcement`);
    }
    source = source.replace(groundedCall, groundedDirectedCall);

    const lowerCallSuffix = `        upperDirection.z,
        1.25,
      );`;
    const lowerDirectedCallSuffix = `        upperDirection.z,
        1.25,
        true,
      );`;
    if (!source.includes(lowerCallSuffix)) {
      throw new Error(`${runtimePath}: A1 lower full-height wall check is unavailable for terminal-side enforcement`);
    }
    source = source.split(lowerCallSuffix).join(lowerDirectedCallSuffix);
  }

  const candidateAnchor = `          underElevatedWalkway: false,
          elevatedWalkwayClearanceVerified: true,
          authority: "facade-contiguous-structural-wall-surface-v17",`;
  const candidateEvidence = `          underElevatedWalkway: false,
          elevatedWalkwayClearanceVerified: true,
          sourceHierarchyWalkwayExcluded: true,
          authority: "facade-contiguous-structural-wall-surface-v17",`;
  if (!source.includes("sourceHierarchyWalkwayExcluded: true")) {
    if (!source.includes(candidateAnchor)) {
      throw new Error(`${runtimePath}: grounded A1 authority exists but selected-facade hierarchy evidence block is missing`);
    }
    source = source.replace(candidateAnchor, candidateEvidence);
  }

  const groundedGateAnchor = `      if (groundedConnection.underElevatedWalkway !== false
        || groundedConnection.elevatedWalkwayClearanceVerified !== true) {
        throw new Error(\`A1 grounded search did not prove clearance from the elevated T4_WALK footprint: \${JSON.stringify(groundedConnection)}\`);
      }`;
  const groundedGate = `      if (groundedConnection.underElevatedWalkway !== false
        || groundedConnection.elevatedWalkwayClearanceVerified !== true
        || groundedConnection.sourceHierarchyWalkwayExcluded !== true) {
        throw new Error(\`A1 grounded search did not prove clearance from the complete elevated T4_WALK source hierarchy: \${JSON.stringify(groundedConnection)}\`);
      }`;
  if (!source.includes("complete elevated T4_WALK source hierarchy")) {
    if (!source.includes(groundedGateAnchor)) {
      throw new Error(`${runtimePath}: grounded A1 authority exists but footprint-only walkway gate is missing`);
    }
    source = source.replace(groundedGateAnchor, groundedGate);
  }

  if (!source.includes("A1 grounded terminal-side direction is invalid")) {
    const directionGateAnchor = `      if (/WALK|JETWAY|CONNECTOR|PORTAL/i.test(String(groundedConnection.authority || ""))) {
        throw new Error(\`A1 grounded search resolved a forbidden walkway/connector authority: \${groundedConnection.authority}\`);
      }`;
    const directionGate = `${directionGateAnchor}
      if (!(groundedTerminalDirectionDot >= 0.15)) {
        throw new Error(\`A1 grounded terminal-side direction is invalid: directionDot=\${groundedTerminalDirectionDot}; connection=\${JSON.stringify(groundedConnection)}\`);
      }`;
    if (!source.includes(directionGateAnchor)) {
      throw new Error(`${runtimePath}: A1 grounded authority gate is unavailable for direction proof`);
    }
    source = source.replace(directionGateAnchor, directionGate);
  }

  const groundedTelemetryAnchor = `        underElevatedWalkway: false,
        elevatedWalkwayClearanceVerified: true,
        elevatedWalkwayFootprintCount: diagnostics?.elevatedWalkwayFootprintCount ?? 0,`;
  const groundedTelemetry = `        underElevatedWalkway: false,
        elevatedWalkwayClearanceVerified: true,
        sourceHierarchyWalkwayExcluded: groundedConnection.sourceHierarchyWalkwayExcluded === true,
        walkwayHierarchyRejectedCount: diagnostics?.walkwayHierarchyRejectedCount ?? 0,
        elevatedWalkwayFootprintCount: diagnostics?.elevatedWalkwayFootprintCount ?? 0,`;
  if (!source.includes("walkwayHierarchyRejectedCount: diagnostics?.walkwayHierarchyRejectedCount")) {
    if (!source.includes(groundedTelemetryAnchor)) {
      throw new Error(`${runtimePath}: grounded A1 authority exists but grounded connection telemetry block is missing`);
    }
    source = source.replace(groundedTelemetryAnchor, groundedTelemetry);
  }
}

const finalSafeHierarchy = source.includes("sourceHierarchyNode.userData?.sourceName")
  || (source.includes("hierarchyObject.userData?.sourceName") && source.includes("hierarchyNode.userData?.sourceName"));
if (!finalSafeHierarchy || !source.includes("/T4[_ -]?WALK|WALKWAY|JETWAY|CONNECTOR|PORTAL/i")) {
  throw new Error(`${runtimePath}: A1 final wall finder does not reject the complete converted T4_WALK source hierarchy`);
}
if (hasGroundedA1Authority) {
  for (const required of [
    "sourceHierarchyWalkwayExcluded: true",
    "complete elevated T4_WALK source hierarchy",
    "walkwayHierarchyRejectedCount: diagnostics?.walkwayHierarchyRejectedCount",
    directionMarker,
    "A1 grounded terminal-side direction is invalid",
  ]) {
    if (!source.includes(required)) {
      throw new Error(`${runtimePath}: grounded A1 final hierarchy/direction authority is missing ${required}`);
    }
  }
}
for (const forbidden of [
  "exact-T4_WALK-A1-terminal-portal-v25",
  "exactWalkwayPortalX",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: forbidden explicit A1 walkway target survived final hierarchy exclusion: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(hasGroundedA1Authority
  ? "Finalized grounded A1 wall selection with full source-hierarchy exclusion, physical T4_WALK clearance, and terminal-side direction preserved at ramp level."
  : "Validated the existing v11 full-hierarchy A1 terminal-building exclusion during early Terminal 4 runtime preparation.");
