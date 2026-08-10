import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

const AUTHORITY = "a1-full-height-terminal-building-wall-v30";
const MAX_VERTICAL_WALL_DISTANCE_DELTA_METERS = 0.85;
const MIN_SAME_DIRECTION_COSINE = 0.995;

function replaceOnce(before, after, acceptedToken, label) {
  if (source.includes(acceptedToken)) return;
  if (!source.includes(before)) throw new Error(`${jetwayPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

// Preserve the longer search reach used by the current Terminal 4 source fit.
source = source
  .replace("  const cast = (direction, far = 24) => {", "  const cast = (direction, far = 48) => {")
  .replace("      if (distance > 0.05 && distance <= 24 && distance < nearestDistance) {", "      if (distance > 0.05 && distance <= 48 && distance < nearestDistance) {")
  .replace("    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);", "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);");

// A1 has repeatedly been attracted to the elevated T4_WALK because some of the
// converted walkway faces reuse Terminal 4 facade materials. Material identity
// alone is therefore not enough. Reject any hit whose object hierarchy names a
// walkway/jetway/portal/connector, then require a genuine BGATE/DGATE/PHX_TERM400
// source identity on the remaining face.
const oldRayFilter = `      if (entry.object?.visible === false) return false;
      const materials = Array.isArray(entry.object?.material)
        ? entry.object.material
        : [entry.object?.material];
      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
      return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");`;
const metadataRayFilter = `      if (entry.object?.visible === false) return false;
      let hierarchyObject = entry.object;
      while (hierarchyObject) {
        const hierarchyIdentity = [
          hierarchyObject.name,
          hierarchyObject.userData?.sourceName,
          hierarchyObject.userData?.sourceModel,
          hierarchyObject.userData?.sourcePart,
        ].filter(Boolean).join(" ");
        if (/T4[_ -]?WALK|WALKWAY|JETWAY|CONNECTOR|PORTAL/i.test(hierarchyIdentity)) return false;
        hierarchyObject = hierarchyObject.parent;
      }
      const materials = Array.isArray(entry.object?.material)
        ? entry.object.material
        : [entry.object?.material];
      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
      const structuralReference = [
        material?.name,
        material?.userData?.diffuseTexture,
        material?.userData?.sourceDiffuseTexture,
        material?.userData?.runtimeDiffuseTexture,
      ].filter(Boolean).join(" ");
      return /BGATE|DGATE|PHX_TERM400/i.test(structuralReference);`;
const priorMetadataRayFilterPattern = /      if \(entry\.object\?\.visible === false\) return false;\n(?:[\s\S]*?)      return \/BGATE\|DGATE\|PHX_TERM400\/i\.test\(structuralReference\);/;
if (!source.includes("hierarchyObject.userData?.sourceName")) {
  if (source.includes(oldRayFilter)) source = source.replace(oldRayFilter, metadataRayFilter);
  else if (priorMetadataRayFilterPattern.test(source)) source = source.replace(priorMetadataRayFilterPattern, metadataRayFilter);
  else throw new Error(`${jetwayPath}: structural ray filter anchor is missing`);
}

const oldVertexFilter = `    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test(material?.name || ""))) return;`;
const metadataVertexFilter = `    let hierarchyNode = node;
    while (hierarchyNode) {
      const hierarchyIdentity = [
        hierarchyNode.name,
        hierarchyNode.userData?.sourceName,
        hierarchyNode.userData?.sourceModel,
        hierarchyNode.userData?.sourcePart,
      ].filter(Boolean).join(" ");
      if (/T4[_ -]?WALK|WALKWAY|JETWAY|CONNECTOR|PORTAL/i.test(hierarchyIdentity)) return;
      hierarchyNode = hierarchyNode.parent;
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some((material) => {
      const structuralReference = [
        material?.name,
        material?.userData?.diffuseTexture,
        material?.userData?.sourceDiffuseTexture,
        material?.userData?.runtimeDiffuseTexture,
      ].filter(Boolean).join(" ");
      return /BGATE|DGATE|PHX_TERM400/i.test(structuralReference);
    })) return;`;
const priorMetadataVertexFilterPattern = /    const materials = Array\.isArray\(node\.material\) \? node\.material : \[node\.material\];\n(?:[\s\S]*?)    \}\)\) return;/;
if (!source.includes("hierarchyNode.userData?.sourceName")) {
  if (source.includes(oldVertexFilter)) source = source.replace(oldVertexFilter, metadataVertexFilter);
  else if (priorMetadataVertexFilterPattern.test(source)) source = source.replace(priorMetadataVertexFilterPattern, metadataVertexFilter);
  else throw new Error(`${jetwayPath}: structural vertex filter anchor is missing`);
}

const obsoleteWalkwayBlock = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    ) || {};
    if (jetway.g === "A1") {
      const exactWalkwayPortalX = -30.16857013;
      const exactWalkwayPortalZ = jetway.z;
      const exactDx = exactWalkwayPortalX - jetway.x;
      const exactDz = exactWalkwayPortalZ - jetway.z;
      const exactDistance = Math.hypot(exactDx, exactDz);
      Object.assign(terminalConnection, {
        distance: exactDistance,
        towardX: exactDx / exactDistance,
        towardZ: exactDz / exactDistance,
        authority: "exact-T4_WALK-A1-terminal-portal-v25",
      });
    }`;

const plainConnectionBlock = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );`;

const previousStructuralBlockPattern = /    const terminalConnection = findTerminalWallConnection\([\s\S]*?      terminalConnection\.authority = `structural-A1-terminal-building-\$\{terminalConnection\.authority\}-v28`;\n    \}/;

const verifiedBuildingBlock = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );
    if (jetway.g === "A1") {
      if (!terminalConnection) {
        throw new Error("A1 could not find the real Terminal 4 building facade");
      }
      const upperDirection = new THREE.Vector3(
        terminalConnection.towardX,
        0,
        terminalConnection.towardZ,
      ).normalize();
      const lowerConnection = findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        upperDirection.x,
        upperDirection.z,
        1.25,
      );
      if (!lowerConnection) {
        throw new Error("A1 candidate attachment exists only at passenger level; refusing an elevated walkway attachment");
      }
      const lowerDirection = new THREE.Vector3(
        lowerConnection.towardX,
        0,
        lowerConnection.towardZ,
      ).normalize();
      const sameDirectionCosine = upperDirection.dot(lowerDirection);
      const verticalWallDistanceDeltaMeters = Math.abs(
        Number(terminalConnection.distance) - Number(lowerConnection.distance),
      );
      if (sameDirectionCosine < ${MIN_SAME_DIRECTION_COSINE}
        || verticalWallDistanceDeltaMeters > ${MAX_VERTICAL_WALL_DISTANCE_DELTA_METERS}) {
        throw new Error(
          \`A1 attachment is not a full-height terminal-building wall: directionCos=\${sameDirectionCosine.toFixed(6)} distanceDelta=\${verticalWallDistanceDeltaMeters.toFixed(3)}\`,
        );
      }
      terminalConnection.authority = "${AUTHORITY}";
      terminalConnection.lowerFacadeDistance = lowerConnection.distance;
      terminalConnection.verticalWallDistanceDeltaMeters = verticalWallDistanceDeltaMeters;
      terminalConnection.sameDirectionCosine = sameDirectionCosine;
    }`;

if (source.includes(obsoleteWalkwayBlock)) {
  source = source.replace(obsoleteWalkwayBlock, verifiedBuildingBlock);
} else if (previousStructuralBlockPattern.test(source)) {
  source = source.replace(previousStructuralBlockPattern, verifiedBuildingBlock);
} else if (source.includes(plainConnectionBlock)) {
  source = source.replace(plainConnectionBlock, verifiedBuildingBlock);
} else if (!source.includes(AUTHORITY)) {
  throw new Error(`${jetwayPath}: A1 terminal connection block is missing`);
}

// Publish enough evidence that browser verification can prove the chosen point
// is the same structural facade at passenger and lower-facade heights.
const telemetryAnchor = `      a1TerminalConnectionAuthority = terminalConnection?.authority ?? null;
      a1TerminalConnectionDirection = terminalConnection
        ? [terminalConnection.towardX, terminalConnection.towardZ]
        : null;`;
const telemetryReplacement = `${telemetryAnchor}
      group.userData.a1TerminalBuildingLowerFacadeDistance = terminalConnection?.lowerFacadeDistance ?? null;
      group.userData.a1TerminalBuildingVerticalWallDistanceDeltaMeters = terminalConnection?.verticalWallDistanceDeltaMeters ?? null;
      group.userData.a1TerminalBuildingSameDirectionCosine = terminalConnection?.sameDirectionCosine ?? null;`;
if (!source.includes("a1TerminalBuildingVerticalWallDistanceDeltaMeters")) {
  if (!source.includes(telemetryAnchor)) throw new Error(`${jetwayPath}: A1 terminal telemetry anchor is missing`);
  source = source.replace(telemetryAnchor, telemetryReplacement);
}

source = source.replace(
  /  group\.userData\.terminalConnectionAuthority = "[^"]+";/,
  `  group.userData.terminalConnectionAuthority = "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v30";`,
);

for (const forbidden of [
  "exact-T4_WALK-A1-terminal-portal-v25",
  "exactWalkwayPortalX",
  "A1 direct terminal-building raycast failed",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${jetwayPath}: forbidden A1 walkway/direct-ray behavior remains: ${forbidden}`);
  }
}
for (const required of [
  "hierarchyObject.userData?.sourceName",
  "hierarchyNode.userData?.sourceName",
  "/T4[_ -]?WALK|WALKWAY|JETWAY|CONNECTOR|PORTAL/i",
  `terminalConnection.authority = "${AUTHORITY}"`,
  "a1TerminalBuildingLowerFacadeDistance",
  "a1TerminalBuildingVerticalWallDistanceDeltaMeters",
  "a1TerminalBuildingSameDirectionCosine",
]) {
  if (!source.includes(required)) {
    throw new Error(`${jetwayPath}: real-building A1 attachment requirement is missing ${required}`);
  }
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log("Prepared A1 against the real full-height Terminal 4 building: walkway/portal hierarchy is excluded and the selected passenger-level wall must match the lower facade on the same ray.");