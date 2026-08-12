import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-source-direction-candidate-filter-v1";
const materialMarker = "a1-final-phx-term400-wall-only-v1";
const candidateDiagnosticMarker = "a1-final-structural-candidate-dump-v2";
const MINIMUM_A1_SOURCE_DIRECTION_DOT = 0.05;
let source = fs.readFileSync(runtimePath, "utf8");

// The last visually inspected render proved PHX_TERM400 is NOT the real A1
// building face: every qualifying PHX_TERM400 candidate landed on the same
// corridor plane. Keep the current shipping filter intact for this diagnostic
// build, but inventory every already-qualified BGATE/DGATE/PHX_TERM400 wall
// candidate before PHX_TERM400 rejection. The browser is intentionally failed
// after traversal so no diagnostic candidate can become shipping geometry.
if (!source.includes(marker)) {
  const oldCandidateGate = `      if (requirePreferredHemisphere && directionDot < 0.15) {
        if (!diagnostics.nearestDirectionRejected || horizontalDistance < diagnostics.nearestDirectionRejected.distance) {`;
  const sourceAlignedCandidateGate = `      // ${marker}
      // ${candidateDiagnosticMarker}
      if (forcePreferredHemisphere && /BGATE|DGATE|PHX_TERM400/i.test(String(materialReference || ""))) {
        diagnostics.a1StructuralCandidates = diagnostics.a1StructuralCandidates || [];
        if (diagnostics.a1StructuralCandidates.length < 192) {
          diagnostics.a1StructuralCandidates.push({
            nodeName: node.name || "unnamed",
            materialReference,
            distance: horizontalDistance,
            verticalError,
            directionDot,
            point: [closest.x, closest.y, closest.z],
            nodeSize: [nodeSize.x, nodeSize.y, nodeSize.z],
            triangleArea: area,
          });
        }
      }
      // ${materialMarker}
      if (forcePreferredHemisphere && !/PHX_TERM400/i.test(String(materialReference || ""))) {
        diagnostics.sourceMaterialRejectedCount = (diagnostics.sourceMaterialRejectedCount || 0) + 1;
        diagnostics.requiredA1TerminalMaterial = "PHX_TERM400";
        continue;
      }
      const minimumDirectionDot = forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15;
      if (requirePreferredHemisphere && directionDot < minimumDirectionDot) {
        diagnostics.sourceDirectionRejectedCount = (diagnostics.sourceDirectionRejectedCount || 0) + 1;
        diagnostics.minimumRequiredDirectionDot = minimumDirectionDot;
        if (!diagnostics.nearestDirectionRejected || horizontalDistance < diagnostics.nearestDirectionRejected.distance) {`;
  if (!source.includes(oldCandidateGate)) {
    throw new Error(`${runtimePath}: final A1 candidate direction gate is missing`);
  }
  source = source.replace(oldCandidateGate, sourceAlignedCandidateGate);

  const oldFinalGate = `      if (!(groundedTerminalDirectionDot >= 0.15)) {
        throw new Error(\`A1 grounded terminal-side direction is invalid: directionDot=\${groundedTerminalDirectionDot}; connection=\${JSON.stringify(groundedConnection)}\`);
      }`;
  const sourceAlignedFinalGate = `      if (!(groundedTerminalDirectionDot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT})) {
        throw new Error(\`A1 grounded terminal-side direction is invalid: directionDot=\${groundedTerminalDirectionDot}; minimum=${MINIMUM_A1_SOURCE_DIRECTION_DOT}; connection=\${JSON.stringify(groundedConnection)}\`);
      }`;
  if (!source.includes(oldFinalGate)) {
    throw new Error(`${runtimePath}: final A1 grounded direction acceptance gate is missing`);
  }
  source = source.replace(oldFinalGate, sourceAlignedFinalGate);

  const oldMaterialGate = `      const groundedMaterialReference = String(groundedConnection.materialReference || "");
      if (!/BGATE|DGATE|PHX_TERM400/i.test(groundedMaterialReference)) {
        throw new Error(\`A1 grounded search did not resolve the authored Terminal 4 structural material: \${groundedMaterialReference}\`);
      }`;
  const phxTerm400MaterialGate = `      const groundedMaterialReference = String(groundedConnection.materialReference || "");
      if (!/PHX_TERM400/i.test(groundedMaterialReference)) {
        throw new Error(\`A1 grounded search did not resolve the PHX_TERM400 Terminal 4 building face: \${groundedMaterialReference}\`);
      }`;
  if (!source.includes(oldMaterialGate)) {
    throw new Error(`${runtimePath}: final A1 grounded material acceptance gate is missing`);
  }
  source = source.replace(oldMaterialGate, phxTerm400MaterialGate);

  const telemetryAnchor = `        walkwayHierarchyRejectedCount: diagnostics?.walkwayHierarchyRejectedCount ?? 0,
        elevatedWalkwayFootprintCount: diagnostics?.elevatedWalkwayFootprintCount ?? 0,`;
  const telemetryWithDirection = `        walkwayHierarchyRejectedCount: diagnostics?.walkwayHierarchyRejectedCount ?? 0,
        sourceMaterialRejectedCount: diagnostics?.sourceMaterialRejectedCount ?? 0,
        requiredA1TerminalMaterial: "PHX_TERM400",
        selectedMaterialReference: groundedMaterialReference,
        sourceDirectionRejectedCount: diagnostics?.sourceDirectionRejectedCount ?? 0,
        minimumRequiredDirectionDot: ${MINIMUM_A1_SOURCE_DIRECTION_DOT},
        selectedSourceDirectionDot: groundedTerminalDirectionDot,
        elevatedWalkwayFootprintCount: diagnostics?.elevatedWalkwayFootprintCount ?? 0,`;
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${runtimePath}: final A1 grounded telemetry anchor is missing`);
  }
  source = source.replace(telemetryAnchor, telemetryWithDirection);

  const returnAnchor = `  terminal.userData.a1WallSearchDiagnostics = diagnostics;
  return nearest;
}`;
  const diagnosticReturn = `  terminal.userData.a1WallSearchDiagnostics = diagnostics;
  if (forcePreferredHemisphere) {
    throw new Error(\`A1 STRUCTURAL CANDIDATE DUMP ${candidateDiagnosticMarker}: \${JSON.stringify(diagnostics.a1StructuralCandidates || [])}\`);
  }
  return nearest;
}`;
  if (!source.includes(returnAnchor)) {
    throw new Error(`${runtimePath}: A1 structural candidate diagnostic return point is missing`);
  }
  source = source.replace(returnAnchor, diagnosticReturn);
}

for (const required of [
  marker,
  materialMarker,
  candidateDiagnosticMarker,
  `forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15`,
  "diagnostics.a1StructuralCandidates",
  "/BGATE|DGATE|PHX_TERM400/i.test",
  "forcePreferredHemisphere && !/PHX_TERM400/i.test",
  "diagnostics.sourceMaterialRejectedCount",
  'diagnostics.requiredA1TerminalMaterial = "PHX_TERM400"',
  "diagnostics.sourceDirectionRejectedCount",
  `groundedTerminalDirectionDot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT}`,
  "A1 grounded search did not resolve the PHX_TERM400 Terminal 4 building face",
  'requiredA1TerminalMaterial: "PHX_TERM400"',
  "selectedMaterialReference: groundedMaterialReference",
  `minimumRequiredDirectionDot: ${MINIMUM_A1_SOURCE_DIRECTION_DOT}`,
  "selectedSourceDirectionDot: groundedTerminalDirectionDot",
  "A1 STRUCTURAL CANDIDATE DUMP",
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: final A1 structural-candidate diagnostic is missing ${required}`);
  }
}
for (const forbidden of [
  "if (!(groundedTerminalDirectionDot >= 0.15))",
  "if (!/BGATE|DGATE|PHX_TERM400/i.test(groundedMaterialReference))",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: permissive A1 final wall acceptance survived: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Instrumented final A1 wall search to dump every already-qualified BGATE/DGATE/PHX_TERM400 structural candidate before the known-wrong PHX_TERM400 shipping filter; no diagnostic candidate is allowed to ship.`);