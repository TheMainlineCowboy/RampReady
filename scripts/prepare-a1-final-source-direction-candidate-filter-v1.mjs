import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-source-direction-candidate-filter-v1";
const materialMarker = "a1-final-phx-term400-wall-only-v1";
const candidateDiagnosticMarker = "a1-final-phx-term400-candidate-dump-v1";
const MINIMUM_A1_SOURCE_DIRECTION_DOT = 0.05;
let source = fs.readFileSync(runtimePath, "utf8");

// The grounded-wall preparer intentionally disabled direction discrimination at
// ramp height and the later hierarchy pass restored only a 0.15 hemisphere
// check. Visual evidence proved that allowing any terminal-looking material can
// admit the elevated connector-side facade. Material identity is therefore the
// strong A1 discriminator; direction is retained only as a weak terminal-side
// hemisphere guard so a legitimate angled PHX_TERM400 face is not excluded.
//
// A1 has one strong source discriminator: PHX_TERM400_1 is the authored
// Terminal 4 source box that owns the real A1 attachment face. BGATE/DGATE
// materials are valid elsewhere on the concourses, but allowing them in A1's
// final grounded search lets corridor-side facade triangles masquerade as the
// terminal wall. The forced A1 search must therefore reject every candidate
// that is not backed by PHX_TERM400 source material.
if (!source.includes(marker)) {
  const oldCandidateGate = `      if (requirePreferredHemisphere && directionDot < 0.15) {
        if (!diagnostics.nearestDirectionRejected || horizontalDistance < diagnostics.nearestDirectionRejected.distance) {`;
  const sourceAlignedCandidateGate = `      // ${marker}
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
}

// Temporary fail-fast geometry inventory. The last green visual run still put
// A1 on the wrong elevated structure, so inspect every nearby PHX_TERM400 wall
// candidate before selecting a new authority. This deliberately fails the
// browser render with the candidate coordinates; it does not alter jetway or
// terminal geometry.
if (!source.includes(candidateDiagnosticMarker)) {
  const candidateAnchor = `      const minimumDirectionDot = forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15;
      if (requirePreferredHemisphere && directionDot < minimumDirectionDot) {`;
  const candidateDiagnostic = `      // ${candidateDiagnosticMarker}
      if (forcePreferredHemisphere) {
        diagnostics.a1PhxTerm400Candidates = diagnostics.a1PhxTerm400Candidates || [];
        if (diagnostics.a1PhxTerm400Candidates.length < 96) {
          diagnostics.a1PhxTerm400Candidates.push({
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
      const minimumDirectionDot = forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15;
      if (requirePreferredHemisphere && directionDot < minimumDirectionDot) {`;
  if (!source.includes(candidateAnchor)) {
    throw new Error(`${runtimePath}: A1 candidate diagnostic insertion point is missing`);
  }
  source = source.replace(candidateAnchor, candidateDiagnostic);

  const returnAnchor = `  terminal.userData.a1WallSearchDiagnostics = diagnostics;
  return nearest;
}`;
  const diagnosticReturn = `  terminal.userData.a1WallSearchDiagnostics = diagnostics;
  if (forcePreferredHemisphere) {
    throw new Error(\`A1 PHX_TERM400 CANDIDATE DUMP ${candidateDiagnosticMarker}: \${JSON.stringify(diagnostics.a1PhxTerm400Candidates || [])}\`);
  }
  return nearest;
}`;
  if (!source.includes(returnAnchor)) {
    throw new Error(`${runtimePath}: A1 candidate diagnostic return point is missing`);
  }
  source = source.replace(returnAnchor, diagnosticReturn);
}

for (const required of [
  marker,
  materialMarker,
  candidateDiagnosticMarker,
  `forcePreferredHemisphere ? ${MINIMUM_A1_SOURCE_DIRECTION_DOT} : 0.15`,
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
  "A1 PHX_TERM400 CANDIDATE DUMP",
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: final PHX_TERM400/source-direction A1 filter is missing ${required}`);
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
console.log(`Filtered final A1 ramp-level wall candidates to PHX_TERM400 with terminal-side source-axis dot >= ${MINIMUM_A1_SOURCE_DIRECTION_DOT}; candidate-dump instrumentation is active for the next browser render.`);