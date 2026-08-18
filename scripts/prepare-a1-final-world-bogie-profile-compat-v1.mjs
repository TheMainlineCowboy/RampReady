import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const finalWorldAuthority = "final-visible-a1-tunnel-c-low-contact-world-v1";
const marker = "a1-final-world-runtime-support-meshes-v2";
const integratedCarrierMarker = "a1-integrated-tunnel-c-opaque-support-carrier-v2-source-identity";
const v3 = 'renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-final-world-tunnel-c-bogie-apron-half-plane-side-profile-v3";';
const v2 = 'renderer.domElement.dataset.inspectionCameraEndpointBogieProfileAuthority = "a1-tunnel-c-bogie-apron-half-plane-side-profile-v2";';
let source = fs.readFileSync(trainerPath, "utf8");

if (!source.includes(finalWorldAuthority)) {
  throw new Error(`${trainerPath}: final-world Tunnel_C measurement is missing before bogie profile normalization`);
}

if (!source.includes(marker)) {
  const wholeResolver = `            const exactA1VisibleTunnelC = exactA1VisibleModel?.getObjectByName?.("Tunnel_C")
              || exactA1VisibleModel?.getObjectByName?.("Tunnel_C_Jetway_0");`;
  const inventedResolver = `            // a1-final-world-authored-bogie-support-subset-v1
            const exactA1VisibleTunnelC = exactA1VisibleModel?.getObjectByName?.("Tunnel_C_DarkBogieLift_SourceTriangles")
              || exactA1VisibleModel?.getObjectByName?.("Tunnel_C_GalvanizedServiceStair_SourceTriangles");`;
  const resolverNeedle = source.includes(inventedResolver) ? inventedResolver : wholeResolver;
  if (!source.includes(resolverNeedle)) {
    throw new Error(`${trainerPath}: final-world Tunnel_C resolver is missing before runtime-support normalization`);
  }
  const runtimeResolver = `            // ${marker}
            // ${integratedCarrierMarker}
            // Runtime inspection of the untouched supplied GLB shows the bogie/support
            // triangles are integrated into Tunnel_C_Jetway_0 rather than exposed as
            // small named child meshes. Select that exact opaque source carrier by its
            // authored identity; do NOT translate it. The later low-vertex footprint
            // and <=1.5 cm ramp-clearance proof remain the fail-closed ground authority.
            const exactA1VisibleTunnelCRoot = exactA1VisibleModel?.getObjectByName?.("Tunnel_C")
              || exactA1VisibleModel?.getObjectByName?.("Tunnel_C_Jetway_0");
            const exactA1TunnelCMeshCandidates = [];
            exactA1VisibleTunnelCRoot?.traverse?.((entry) => {
              if (!entry.isMesh || entry.visible === false || !entry.geometry?.attributes?.position) return;
              entry.updateWorldMatrix(true, false);
              const box = new THREE.Box3().setFromObject(entry);
              const size = box.getSize(new THREE.Vector3());
              exactA1TunnelCMeshCandidates.push({ entry, box, size });
            });
            const exactA1TunnelCCandidateMinimumY = exactA1TunnelCMeshCandidates.length
              ? Math.min(...exactA1TunnelCMeshCandidates.map(({ box }) => box.min.y))
              : Number.POSITIVE_INFINITY;
            const exactA1VisibleTunnelCSupportMeshes = exactA1TunnelCMeshCandidates
              .filter(({ entry, box, size }) => {
                const horizontalSpan = Math.hypot(size.x, size.z);
                const isExactIntegratedOpaqueCarrier = entry.name === "Tunnel_C_Jetway_0";
                return box.min.y <= exactA1TunnelCCandidateMinimumY + 0.80
                  && horizontalSpan >= 0.35
                  && (isExactIntegratedOpaqueCarrier || (
                    Math.max(size.x, size.z) <= 13.0
                    && size.y <= 8.5
                  ));
              })
              .map(({ entry }) => entry);
            if (!exactA1VisibleTunnelCSupportMeshes.length) {
              const diagnostic = exactA1TunnelCMeshCandidates.map(({ entry, box, size }) => ({
                name: entry.name || "unnamed",
                minY: Number(box.min.y.toFixed(3)),
                size: size.toArray().map((value) => Number(value.toFixed(3))),
              }));
              throw new Error(\`A1 final-world bogie evidence found no integrated low-contact Tunnel_C support carrier: \${JSON.stringify(diagnostic)}\`);
            }
            const exactA1VisibleTunnelC = {
              updateWorldMatrix() {
                for (const supportMesh of exactA1VisibleTunnelCSupportMeshes) supportMesh.updateWorldMatrix(true, false);
              },
              traverse(callback) {
                for (const supportMesh of exactA1VisibleTunnelCSupportMeshes) callback(supportMesh);
              },
            };`;
  source = source.replace(resolverNeedle, runtimeResolver);
  source = source.replace(
    'throw new Error("A1 final-world bogie evidence cannot resolve the authored Tunnel_C bogie/support subset");',
    'throw new Error("A1 final-world bogie evidence cannot resolve the visible Tunnel_C hierarchy");',
  );
}

// Normalize an already-generated v2 resolver. The whole Tunnel_C_Jetway_0 mesh
// is deliberately preserved, so its AABB is much larger than a hypothetical
// separable bogie child. Source identity admits that one exact opaque carrier;
// the subsequent low-contact footprint/ramp test still decides ground validity.
if (!source.includes(integratedCarrierMarker)) {
  const oldFilter = `              .filter(({ box, size }) => {
                const horizontalSpan = Math.hypot(size.x, size.z);
                return box.min.y <= exactA1TunnelCCandidateMinimumY + 0.80
                  && horizontalSpan >= 0.35
                  && Math.max(size.x, size.z) <= 13.0
                  && size.y <= 8.5;
              })`;
  const sourceIdentityFilter = `              .filter(({ entry, box, size }) => {
                const horizontalSpan = Math.hypot(size.x, size.z);
                const isExactIntegratedOpaqueCarrier = entry.name === "Tunnel_C_Jetway_0";
                // ${integratedCarrierMarker}
                return box.min.y <= exactA1TunnelCCandidateMinimumY + 0.80
                  && horizontalSpan >= 0.35
                  && (isExactIntegratedOpaqueCarrier || (
                    Math.max(size.x, size.z) <= 13.0
                    && size.y <= 8.5
                  ));
              })`;
  if (source.includes(oldFilter)) {
    source = source.replace(oldFilter, sourceIdentityFilter);
  } else {
    source = source
      .replace("Math.max(size.x, size.z) <= 6.5", `Math.max(size.x, size.z) <= 13.0`)
      .replace("size.y <= 5.5", "size.y <= 8.5");
    const legacyFilter = `              .filter(({ box, size }) => {`;
    if (source.includes(legacyFilter)) {
      source = source.replace(legacyFilter, `              .filter(({ entry, box, size }) => {\n                // ${integratedCarrierMarker}\n                const isExactIntegratedOpaqueCarrier = entry.name === "Tunnel_C_Jetway_0";`);
      source = source.replace(
        `                  && Math.max(size.x, size.z) <= 13.0\n                  && size.y <= 8.5;`,
        `                  && (isExactIntegratedOpaqueCarrier || (\n                    Math.max(size.x, size.z) <= 13.0\n                    && size.y <= 8.5\n                  ));`,
      );
    }
  }
}

for (const required of [
  marker,
  integratedCarrierMarker,
  'exactA1VisibleTunnelCSupportMeshes',
  'entry.name === "Tunnel_C_Jetway_0"',
  'exactA1TunnelCCandidateMinimumY + 0.80',
  'inspectionCameraEndpointBogieFinalWorldAuthority',
]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: runtime support evidence is missing ${required}`);
}
for (const forbidden of [
  'getObjectByName?.("Tunnel_C_DarkBogieLift_SourceTriangles")',
  'getObjectByName?.("Tunnel_C_GalvanizedServiceStair_SourceTriangles")',
  'const exactA1VisibleTunnelC = exactA1VisibleModel?.getObjectByName?.("Tunnel_C")',
  'Math.max(size.x, size.z) <= 6.5',
  'size.y <= 5.5',
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: stale Tunnel_C bogie resolver remains: ${forbidden}`);
}

if (source.includes(v3)) source = source.replace(v3, v2);
if (!source.includes(v2)) throw new Error(`${trainerPath}: A1 bogie side-profile authority is missing`);

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Kept the A1 bogie side-profile v2 camera while final-world contact resolves the exact integrated Tunnel_C_Jetway_0 opaque carrier by source identity under ${marker} + ${integratedCarrierMarker}, with low-contact ramp validation unchanged.`);

await import(`./prepare-static-supplied-axis-source-heading-v1.mjs?after-bogie-profile=${Date.now()}`);
await import(`./prepare-static-final-own-parking-no-crossing-v1.mjs?after-static-source=${Date.now()}`);
await import(`./prepare-static-a14-corner-arm-articulation-v1.mjs?after-static-own-parking=${Date.now()}`);
await import(`./prepare-static-overlap-diagnostics-v1.mjs?after-static-overlap=${Date.now()}`);
await import(`./prepare-static-connector-inclusive-overlap-guard-v1.mjs?after-static-connector-overlap=${Date.now()}`);
await import(`./prepare-a1-explicit-wall-to-collar-connector-v17.mjs?after-final-a1-static=${Date.now()}`);
