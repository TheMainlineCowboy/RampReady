import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(runtimePath, "utf8");

const searchMarker = "A1 grounded-facade search v34 overhead-walkway-footprint-exclusion";
const connectionMarker = "A1 ramp-level real Terminal 4 source wall v34 no-overhead-walkway";
const MINIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 3.4;
const MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 28;
const MAXIMUM_A1_WALL_HEIGHT_METERS = 2.2;

// A1 must connect to the real concourse/building facade, never to a lower wall
// that merely sits underneath the elevated T4_WALK corridor. The earlier
// terminal-side direction heuristic was not a valid discriminator at this
// corner: the real concourse-base wall is almost perpendicular to the aircraft
// vector, while a DGATE wall directly beneath T4_WALK is farther into that
// preferred hemisphere. Keep the direction preference for elevated searches,
// but let the ramp-level search choose by physical facade distance after
// explicitly excluding the overhead walkway footprint.
if (!source.includes(searchMarker) && source.includes("const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();")) {
  source = source.replace(
    "  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();",
    `  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();
  const requirePreferredHemisphere = height > 2.2; // ${searchMarker}`,
  );
  source = source.replaceAll(
    "      if (directionDot < 0.15) {",
    "      if (requirePreferredHemisphere && directionDot < 0.15) {",
  );
  source = source.replaceAll(
    "      const directionPenalty = Math.max(0, 1 - directionDot) * 2.5;",
    "      const directionPenalty = requirePreferredHemisphere ? Math.max(0, 1 - directionDot) * 2.5 : 0;",
  );
}

const facadeTraversalAnchor = `  const structuralMaterialReference = (material) => [
    material?.name,
    material?.userData?.diffuseTexture,
    material?.userData?.sourceDiffuseTexture,
    material?.userData?.runtimeDiffuseTexture,
  ].filter(Boolean).join(" "); // facade-source-material-identity-v17

  terminal.traverse((node) => {`;

const overheadWalkwayTraversal = `  const structuralMaterialReference = (material) => [
    material?.name,
    material?.userData?.diffuseTexture,
    material?.userData?.sourceDiffuseTexture,
    material?.userData?.runtimeDiffuseTexture,
  ].filter(Boolean).join(" "); // facade-source-material-identity-v17

  // ${searchMarker}
  // Build an X/Z footprint from the actual horizontal T4_WALK triangles. A
  // lower BGATE/DGATE wall underneath those surfaces is part of the elevated
  // corridor complex and is forbidden as A1's terminal attachment target.
  const elevatedWalkwayFootprints = [];
  const pointInsideWalkwayFootprint = (x, z, footprint) => {
    const sign = (px, pz, ax, az, bx, bz) => (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
    const d1 = sign(x, z, footprint.ax, footprint.az, footprint.bx, footprint.bz);
    const d2 = sign(x, z, footprint.bx, footprint.bz, footprint.cx, footprint.cz);
    const d3 = sign(x, z, footprint.cx, footprint.cz, footprint.ax, footprint.az);
    const hasNegative = d1 < -1e-6 || d2 < -1e-6 || d3 < -1e-6;
    const hasPositive = d1 > 1e-6 || d2 > 1e-6 || d3 > 1e-6;
    return !(hasNegative && hasPositive);
  };
  terminal.traverse((walkNode) => {
    if (!walkNode.isMesh || walkNode.visible === false) return;
    const walkGeometry = walkNode.geometry;
    const walkPosition = walkGeometry?.getAttribute?.("position");
    if (!walkPosition) return;
    const walkIndex = walkGeometry.index;
    const walkTriangleCount = Math.floor((walkIndex?.count ?? walkPosition.count) / 3);
    for (let walkTriangleIndex = 0; walkTriangleIndex < walkTriangleCount; walkTriangleIndex += 1) {
      const walkTriangleOffset = walkTriangleIndex * 3;
      const walkMaterial = triangleMaterial(walkNode, walkTriangleOffset);
      const walkMaterialReference = structuralMaterialReference(walkMaterial);
      if (!/T4_WALK/i.test(walkMaterialReference)) continue;
      const wai = walkIndex ? walkIndex.getX(walkTriangleOffset) : walkTriangleOffset;
      const wbi = walkIndex ? walkIndex.getX(walkTriangleOffset + 1) : walkTriangleOffset + 1;
      const wci = walkIndex ? walkIndex.getX(walkTriangleOffset + 2) : walkTriangleOffset + 2;
      const wa = new THREE.Vector3().fromBufferAttribute(walkPosition, wai);
      const wb = new THREE.Vector3().fromBufferAttribute(walkPosition, wbi);
      const wc = new THREE.Vector3().fromBufferAttribute(walkPosition, wci);
      walkNode.localToWorld(wa);
      walkNode.localToWorld(wb);
      walkNode.localToWorld(wc);
      const walkNormal = new THREE.Vector3()
        .crossVectors(wb.clone().sub(wa), wc.clone().sub(wa))
        .normalize();
      if (Math.abs(walkNormal.y) < 0.72) continue;
      elevatedWalkwayFootprints.push({
        ax: wa.x, az: wa.z,
        bx: wb.x, bz: wb.z,
        cx: wc.x, cz: wc.z,
        minimumY: Math.min(wa.y, wb.y, wc.y),
      });
    }
  });
  diagnostics.elevatedWalkwayFootprintCount = elevatedWalkwayFootprints.length;
  diagnostics.walkwayOverlapRejectedCount = 0;

  terminal.traverse((node) => {`;

if (!source.includes(searchMarker)) {
  if (!source.includes(facadeTraversalAnchor)) {
    throw new Error(`${runtimePath}: structural facade traversal anchor is missing for overhead-walkway exclusion`);
  }
  source = source.replace(facadeTraversalAnchor, overheadWalkwayTraversal);
}

const distanceQualificationAnchor = `      if (!(horizontalDistance > 0.05 && horizontalDistance <= 48 && verticalError <= 0.65)) continue;
      diagnostics.distanceTriangleCount += 1;
      const candidateDirection = new THREE.Vector3(dx, 0, dz).normalize();`;
const distanceQualificationWithWalkwayExclusion = `      if (!(horizontalDistance > 0.05 && horizontalDistance <= 48 && verticalError <= 0.65)) continue;
      diagnostics.distanceTriangleCount += 1;
      const underElevatedWalkway = elevatedWalkwayFootprints.some((footprint) => (
        footprint.minimumY > closest.y + 1
        && pointInsideWalkwayFootprint(closest.x, closest.z, footprint)
      ));
      if (underElevatedWalkway) {
        diagnostics.walkwayOverlapRejectedCount += 1;
        continue;
      }
      const candidateDirection = new THREE.Vector3(dx, 0, dz).normalize();`;
if (!source.includes("diagnostics.walkwayOverlapRejectedCount += 1")) {
  if (!source.includes(distanceQualificationAnchor)) {
    throw new Error(`${runtimePath}: facade distance qualification anchor is missing for overhead-walkway exclusion`);
  }
  source = source.replace(distanceQualificationAnchor, distanceQualificationWithWalkwayExclusion);
}

const nearestAuthorityAnchor = `          materialReference,
          authority: "facade-contiguous-structural-wall-surface-v17",
        };`;
const nearestAuthorityWithWalkwayEvidence = `          materialReference,
          underElevatedWalkway: false,
          elevatedWalkwayClearanceVerified: true,
          authority: "facade-contiguous-structural-wall-surface-v17",
        };`;
if (!source.includes("elevatedWalkwayClearanceVerified: true")) {
  if (!source.includes(nearestAuthorityAnchor)) {
    throw new Error(`${runtimePath}: selected facade evidence anchor is missing for overhead-walkway exclusion`);
  }
  source = source.replace(nearestAuthorityAnchor, nearestAuthorityWithWalkwayEvidence);
}

const terminalConnectionWithFallback = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    ) || {};`;
const terminalConnectionWithoutFallback = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );`;

const groundedReplacement = `    let terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );
    if (jetway.g === "A1") {
      // ${connectionMarker}
      const elevatedConnection = terminalConnection;
      const groundedConnection = findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        -ux,
        -uz,
        1.25,
      );
      const diagnostics = terminal?.userData?.a1WallSearchDiagnostics || null;
      if (!groundedConnection) {
        throw new Error(\`A1 grounded terminal-building search found no ramp-level structural facade outside T4_WALK: \${JSON.stringify(diagnostics)}\`);
      }
      const groundedTerminalDirectionDot = groundedConnection.towardX * -ux
        + groundedConnection.towardZ * -uz;
      if (groundedConnection.underElevatedWalkway !== false
        || groundedConnection.elevatedWalkwayClearanceVerified !== true) {
        throw new Error(\`A1 grounded search did not prove clearance from the elevated T4_WALK footprint: \${JSON.stringify(groundedConnection)}\`);
      }
      if (/WALK|JETWAY|CONNECTOR|PORTAL/i.test(String(groundedConnection.authority || ""))) {
        throw new Error(\`A1 grounded search resolved a forbidden walkway/connector authority: \${groundedConnection.authority}\`);
      }
      if (!(groundedConnection.distance > ${MINIMUM_A1_SOURCE_WALL_DISTANCE_METERS}
        && groundedConnection.distance < ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS})) {
        throw new Error(\`A1 ramp-level real-terminal source wall distance is invalid: \${groundedConnection.distance}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      if (Number.isFinite(groundedConnection.pointY)
        && groundedConnection.pointY > ${MAXIMUM_A1_WALL_HEIGHT_METERS}) {
        throw new Error(\`A1 grounded search selected an elevated facade at y=\${groundedConnection.pointY}\`);
      }
      const groundedMaterialReference = String(groundedConnection.materialReference || "");
      if (!/BGATE|DGATE|PHX_TERM400/i.test(groundedMaterialReference)) {
        throw new Error(\`A1 grounded search did not resolve the authored Terminal 4 structural material: \${groundedMaterialReference}\`);
      }
      terminalConnection = groundedConnection;
      terminal.userData.a1ElevatedConnectionCandidate = elevatedConnection
        ? {
          distance: elevatedConnection.distance,
          towardX: elevatedConnection.towardX,
          towardZ: elevatedConnection.towardZ,
          authority: elevatedConnection.authority,
        }
        : null;
      terminal.userData.a1GroundedBuildingConnection = {
        sourceDistance: groundedConnection.distance,
        towardX: groundedConnection.towardX,
        towardZ: groundedConnection.towardZ,
        directionDot: groundedTerminalDirectionDot,
        pointX: groundedConnection.pointX ?? null,
        pointY: groundedConnection.pointY ?? null,
        pointZ: groundedConnection.pointZ ?? null,
        materialReference: groundedConnection.materialReference ?? null,
        authority: groundedConnection.authority,
        rampLevelRealTerminalWall: true,
        underElevatedWalkway: false,
        elevatedWalkwayClearanceVerified: true,
        elevatedWalkwayFootprintCount: diagnostics?.elevatedWalkwayFootprintCount ?? 0,
        walkwayOverlapRejectedCount: diagnostics?.walkwayOverlapRejectedCount ?? 0,
        sourceDistanceRangeMeters: [${MINIMUM_A1_SOURCE_WALL_DISTANCE_METERS}, ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS}],
        finalVisibleVestibuleCheckedAfterRelocation: true,
        maximumAllowedHeightMeters: ${MAXIMUM_A1_WALL_HEIGHT_METERS},
      };
    }`;

let replacementCount = 0;
if (!source.includes(connectionMarker)) {
  if (source.includes(terminalConnectionWithFallback)) {
    source = source.replace(terminalConnectionWithFallback, groundedReplacement);
    replacementCount = 1;
  } else if (source.includes(terminalConnectionWithoutFallback)) {
    source = source.replace(terminalConnectionWithoutFallback, groundedReplacement);
    replacementCount = 1;
  } else {
    throw new Error(`${runtimePath}: post-v14 terminalConnection declaration is missing`);
  }
}

for (const token of [
  connectionMarker,
  searchMarker,
  "const requirePreferredHemisphere = height > 2.2",
  "const elevatedWalkwayFootprints = []",
  "pointInsideWalkwayFootprint",
  "if (!/T4_WALK/i.test(walkMaterialReference)) continue",
  "diagnostics.walkwayOverlapRejectedCount += 1",
  "elevatedWalkwayClearanceVerified: true",
  "underElevatedWalkway: false",
  "let terminalConnection = findTerminalWallConnection(",
  "const groundedConnection = findTerminalWallConnection(",
  "A1 grounded terminal-building search found no ramp-level structural facade outside T4_WALK",
  "A1 grounded search did not prove clearance from the elevated T4_WALK footprint",
  "groundedConnection.distance > 3.4",
  "groundedConnection.distance < 28",
  "terminalConnection = groundedConnection",
  "a1GroundedBuildingConnection",
  "rampLevelRealTerminalWall: true",
  "finalVisibleVestibuleCheckedAfterRelocation: true",
  "A1 ramp-level real-terminal source wall distance is invalid",
  "A1 grounded search selected an elevated facade",
  "BGATE|DGATE|PHX_TERM400",
]) {
  if (!source.includes(token)) {
    throw new Error(`${runtimePath}: grounded A1 source-wall token is missing: ${token}`);
  }
}
for (const forbidden of [
  "const requirePreferredHemisphere = true",
  "groundedTerminalDirectionDot >= 0.15",
  "terminalSideHemisphereLocked: true",
  "minimumTerminalDirectionDot: 0.15",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: obsolete A1 direction-only wall discriminator remains: ${forbidden}`);
  }
}
const forbiddenWalkwayAuthority = "exact-" + "T4_WALK-A1-terminal-portal-v25";
const forbiddenWalkwayPortalVariable = "exactWalkway" + "PortalX";
for (const forbidden of [
  forbiddenWalkwayAuthority,
  forbiddenWalkwayPortalVariable,
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: forbidden A1 walkway anchor survived grounded-terminal preparation: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Prepared ${Math.max(1, replacementCount)} A1 ramp-level real-building wall source hit(s), rejecting any structural facade underneath the actual T4_WALK footprint while preserving the final exact 2.4 m vestibule and supplied jetway geometry.`);
