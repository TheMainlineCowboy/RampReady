import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-source-hierarchy-walkway-exclusion-v1";
let source = fs.readFileSync(runtimePath, "utf8");

// The A1 facade finder already rejects meshes whose own name says WALK/JETWAY,
// and a later pass rejects ramp-level points underneath horizontal T4_WALK
// triangles. That is not enough for the converted airport: a structural-looking
// child mesh can carry BGATE/DGATE material while one of its ancestors/source
// metadata still identifies it as the elevated walkway/portal assembly.
// Reject the complete source hierarchy before the triangle can ever become a
// terminal-wall candidate.
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

if (!source.includes(marker)) {
  if (!source.includes(nodeNameOnlyFilter)) {
    throw new Error(`${runtimePath}: final A1 hierarchy exclusion could not find the triangle node-name filter`);
  }
  source = source.replace(nodeNameOnlyFilter, hierarchyFilter);
}

// Make the selected candidate itself carry positive evidence that the complete
// source hierarchy passed the walkway exclusion. This gives runtime/browser
// evidence a fail-closed bit instead of relying on a preparer comment.
const candidateAnchor = `          underElevatedWalkway: false,
          elevatedWalkwayClearanceVerified: true,
          authority: "facade-contiguous-structural-wall-surface-v17",`;
const candidateEvidence = `          underElevatedWalkway: false,
          elevatedWalkwayClearanceVerified: true,
          sourceHierarchyWalkwayExcluded: true,
          authority: "facade-contiguous-structural-wall-surface-v17",`;
if (!source.includes("sourceHierarchyWalkwayExcluded: true")) {
  if (!source.includes(candidateAnchor)) {
    throw new Error(`${runtimePath}: final A1 hierarchy exclusion could not find the selected-facade evidence block`);
  }
  source = source.replace(candidateAnchor, candidateEvidence);
}

// The grounded A1 connection is the authority ultimately assigned to A1. Require
// the hierarchy bit there too so a future wall-search refactor cannot silently
// bypass this rule and still satisfy the old footprint-only gate.
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
    throw new Error(`${runtimePath}: final A1 hierarchy exclusion could not find the grounded walkway gate`);
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
    throw new Error(`${runtimePath}: final A1 hierarchy exclusion could not find grounded connection telemetry`);
  }
  source = source.replace(groundedTelemetryAnchor, groundedTelemetry);
}

for (const required of [
  marker,
  "sourceHierarchyNode.userData?.sourceName",
  "sourceHierarchyNode.userData?.sourceModel",
  "sourceHierarchyNode.userData?.sourcePart",
  "/T4[_ -]?WALK|WALKWAY|JETWAY|CONNECTOR|PORTAL/i",
  "diagnostics.walkwayHierarchyRejectedCount",
  "sourceHierarchyWalkwayExcluded: true",
  "complete elevated T4_WALK source hierarchy",
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: final A1 walkway-hierarchy authority is missing ${required}`);
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
console.log("Finalized A1 terminal-wall search so any T4_WALK/walkway/portal identity anywhere in a candidate's converted source hierarchy is rejected before wall selection; ramp-level footprint clearance remains required as a second independent gate.");
