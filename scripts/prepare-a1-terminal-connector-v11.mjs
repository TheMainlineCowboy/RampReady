import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

function replaceRequired(before, after, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${jetwayPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

const independentStructuralFit = [
  "function findTerminalWallConnection",
  "const cast = (direction, far = 48)",
  "distance <= 48",
  "1.25, 44",
  "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12",
].every((token) => source.includes(token));

if (!independentStructuralFit && source.includes("function findTerminalWallConnection")) {
  replaceRequired(
    "  const cast = (direction, far = 24) => {",
    "  const cast = (direction, far = 48) => {",
    "const cast = (direction, far = 48)",
    "independent terminal ray reach",
  );
  replaceRequired(
    "    const hit = raycaster.intersectObject(terminal, true).find((entry) => entry.object?.visible !== false);",
    `    const hit = raycaster.intersectObject(terminal, true).find((entry) => {
      if (entry.object?.visible === false) return false;
      const materials = Array.isArray(entry.object?.material)
        ? entry.object.material
        : [entry.object?.material];
      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
      return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");
    });`,
    "return /BGATE|DGATE|PHX_TERM400/i.test",
    "structural terminal facade filtering",
  );
  replaceRequired(
    `    if (!node.isMesh || node.visible === false) return;
    const position = node.geometry?.getAttribute?.("position");`,
    `    if (!node.isMesh || node.visible === false) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test(material?.name || ""))) return;
    const position = node.geometry?.getAttribute?.("position");`,
    "materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test",
    "structural terminal vertex filtering",
  );
  replaceRequired(
    "      if (distance > 0.05 && distance <= 24 && distance < nearestDistance) {",
    "      if (distance > 0.05 && distance <= 48 && distance < nearestDistance) {",
    "distance <= 48",
    "terminal vertex reach",
  );
  replaceRequired(
    "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);",
    "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);",
    "1.25, 44",
    "terminal connector length",
  );
  replaceRequired(
    "  group.userData.terminalConnectionAuthority = \"independent-rotunda-collar-fit-to-authored-terminal-wall\";",
    "  group.userData.terminalConnectionAuthority = \"independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12\";",
    "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12",
    "terminal connector authority",
  );
} else if (!independentStructuralFit) {
  replaceRequired(
    "  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 24);",
    "  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 48);",
    "new THREE.Raycaster(origin, direction, 0.05, 48)",
    "legacy terminal ray reach",
  );
  replaceRequired(
    "  const hit = raycaster.intersectObject(terminal, true).find((entry) => entry.object?.visible !== false);",
    `  const hit = raycaster.intersectObject(terminal, true).find((entry) => {
    if (entry.object?.visible === false) return false;
    const materials = Array.isArray(entry.object?.material)
      ? entry.object.material
      : [entry.object?.material];
    const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
    return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");
  });`,
    "return /BGATE|DGATE|PHX_TERM400/i.test",
    "legacy structural terminal facade filtering",
  );
  replaceRequired(
    "      if (!(longitudinal > 0.05 && longitudinal <= 24)) continue;",
    "      if (!(longitudinal > 0.05 && longitudinal <= 48)) continue;",
    "longitudinal <= 48",
    "legacy terminal vertex corridor reach",
  );
  replaceRequired(
    "      if (lateral <= 4.5) nearest = Math.min(nearest, longitudinal);",
    "      if (lateral <= 5.5) nearest = Math.min(nearest, longitudinal);",
    "lateral <= 5.5",
    "legacy terminal vertex corridor width",
  );
  replaceRequired(
    "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);",
    "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);",
    "1.25, 44",
    "legacy terminal connector length",
  );
  replaceRequired(
    "  group.userData.terminalConnectionAuthority = \"raycast-and-source-vertex-fit-to-authored-terminal-mesh\";",
    "  group.userData.terminalConnectionAuthority = \"48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11\";",
    "48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11",
    "legacy terminal connector authority",
  );
}

// Converted and UV-split Terminal 4 materials do not always retain BGATE or
// DGATE in material.name. Their exact package identity is preserved in the
// diffuse-texture metadata installed immediately before jetway placement.
// Use that source identity for both ray hits and the nearest-vertex fallback.
const structuralFacadeReferenceMarker = "A1 structural facade source-reference v28";
if (!source.includes(structuralFacadeReferenceMarker)) {
  const nameOnlyRayFilter = `      return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");`;
  const metadataAwareRayFilter = `      // ${structuralFacadeReferenceMarker}
      // Compatibility contract: return /BGATE|DGATE|PHX_TERM400/i.test
      const structuralReference = [
        material?.name,
        material?.userData?.diffuseTexture,
        material?.userData?.sourceDiffuseTexture,
        material?.userData?.runtimeDiffuseTexture,
      ].filter(Boolean).join(" ");
      return /BGATE|DGATE|PHX_TERM400/i.test(structuralReference);`;
  if (!source.includes(nameOnlyRayFilter)) {
    throw new Error(`${jetwayPath}: missing name-only structural ray filter`);
  }
  source = source.replace(nameOnlyRayFilter, metadataAwareRayFilter);

  const nameOnlyVertexFilter = `    if (!materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test(material?.name || ""))) return;`;
  const metadataAwareVertexFilter = `    // Compatibility contract: materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test
    if (!materials.some((material) => {
      const structuralReference = [
        material?.name,
        material?.userData?.diffuseTexture,
        material?.userData?.sourceDiffuseTexture,
        material?.userData?.runtimeDiffuseTexture,
      ].filter(Boolean).join(" ");
      return /BGATE|DGATE|PHX_TERM400/i.test(structuralReference);
    })) return;`;
  if (!source.includes(nameOnlyVertexFilter)) {
    throw new Error(`${jetwayPath}: missing name-only structural vertex filter`);
  }
  source = source.replace(nameOnlyVertexFilter, metadataAwareVertexFilter);
}

// The user's overhead and same-day A1 photos show the Rotunda attached to the
// actual Terminal 4 building. Never override A1 to the elevated T4_WALK mesh.
// The preferred Cab-opposite ray can pass through a split in the converted
// facade, so accept the existing radial structural-facade or nearest-vertex
// fallback. All accepted paths are already restricted to BGATE/DGATE/
// PHX_TERM400 building materials and therefore cannot select T4_WALK.
const committedA1Connection = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );`;
const obsoleteWalkwayConnection = `    const terminalConnection = findTerminalWallConnection(
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
const brittleDirectConnection = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );
    if (jetway.g === "A1") {
      if (!terminalConnection || terminalConnection.authority !== "preferred-axis-raycast") {
        throw new Error(\`A1 direct terminal-building raycast failed: \${terminalConnection?.authority || "missing"}\`);
      }
      terminalConnection.authority = "direct-A1-terminal-building-preferred-axis-v26";
    }`;
const structuralBuildingConnection = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );
    if (jetway.g === "A1") {
      const diagnostics = terminal?.userData?.a1WallSearchDiagnostics || null;
      if (!terminalConnection) {
        throw new Error(\`A1 structural terminal-building search found no BGATE/DGATE/PHX_TERM400 facade: \${JSON.stringify(diagnostics)}\`);
      }
      const structuralAuthorities = new Set([
        "preferred-axis-raycast",
        "radial-authored-wall-raycast",
        "nearest-authored-wall-vertex",
        "facade-contiguous-structural-wall-surface-v17",
      ]);
      if (!structuralAuthorities.has(terminalConnection.authority)) {
        throw new Error(\`A1 structural terminal-building search returned an invalid authority: \${terminalConnection.authority}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      terminalConnection.authority = \`structural-A1-terminal-building-\${terminalConnection.authority}-v28\`;
    }`;

if (source.includes(obsoleteWalkwayConnection)) {
  source = source.replace(obsoleteWalkwayConnection, structuralBuildingConnection);
} else if (source.includes(brittleDirectConnection)) {
  source = source.replace(brittleDirectConnection, structuralBuildingConnection);
} else if (source.includes(committedA1Connection)) {
  source = source.replace(committedA1Connection, structuralBuildingConnection);
} else if (!source.includes("structural-A1-terminal-building-")) {
  throw new Error(`${jetwayPath}: A1 terminal target block is missing`);
}

const independentPrepared = [
  "function findTerminalWallConnection",
  "const cast = (direction, far = 48)",
  "distance <= 48",
  "1.25, 44",
  "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12",
].every((token) => source.includes(token));
const legacyPrepared = [
  "new THREE.Raycaster(origin, direction, 0.05, 48)",
  "longitudinal <= 48",
  "lateral <= 5.5",
  "1.25, 44",
  "48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11",
].every((token) => source.includes(token));
const metadataAwareFacadePrepared = [
  structuralFacadeReferenceMarker,
  "material?.userData?.diffuseTexture",
  "material?.userData?.sourceDiffuseTexture",
  "material?.userData?.runtimeDiffuseTexture",
].every((token) => source.includes(token));
const diagnosticPrepared = [
  "a1WallSearchDiagnostics",
  "facade-contiguous-structural-wall-surface-v17",
  "JSON.stringify(diagnostics)",
].every((token) => source.includes(token));
if ((!independentPrepared && !legacyPrepared)
  || !metadataAwareFacadePrepared
  || !diagnosticPrepared
  || !source.includes("structural-A1-terminal-building-")
  || source.includes("exact-T4_WALK-A1-terminal-portal-v25")
  || source.includes("A1 direct terminal-building raycast failed")) {
  throw new Error(`${jetwayPath}: structural A1 terminal-building connector preparation is incomplete`);
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log(independentPrepared
  ? "Prepared A1 connector v29 with exact final-facade diagnostics against the real Terminal 4 building; the elevated T4_WALK override remains forbidden."
  : "Prepared legacy A1 connector v29 with exact final-facade diagnostics against the structural Terminal 4 building; the elevated T4_WALK override remains forbidden.");