import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-source-hierarchy-walkway-exclusion-v1";
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
  ]) {
    if (!source.includes(required)) {
      throw new Error(`${runtimePath}: grounded A1 final hierarchy authority is missing ${required}`);
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
  ? "Finalized grounded A1 wall selection with both full converted-source hierarchy rejection and physical T4_WALK footprint clearance required."
  : "Validated the existing v11 full-hierarchy A1 terminal-building exclusion during early Terminal 4 runtime preparation.");
