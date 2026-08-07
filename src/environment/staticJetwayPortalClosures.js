const STATIC_PORTAL_AUTHORITY = "57-static-terminal-portals-paired-vestibule-doors-v1";
const STATIC_CAB_CLOSURE_AUTHORITY = "57-static-source-glb-cab-only-no-synthetic-cap-v1";

function removeGeneratedClosureGeometry(fleet) {
  const existing = fleet?.getObjectByName?.("UploadedAirportJetwayStaticPortalClosures");
  if (!existing) return 0;
  let removedMeshCount = 0;
  existing.traverse?.((entry) => {
    if (!entry?.isMesh && !entry?.isInstancedMesh) return;
    removedMeshCount += 1;
    entry.geometry?.dispose?.();
    if (Array.isArray(entry.material)) entry.material.forEach((material) => material?.dispose?.());
    else entry.material?.dispose?.();
  });
  existing.parent?.remove(existing);
  return removedMeshCount;
}

export function installStaticJetwayPortalClosures(_THREE, fleet, placements) {
  // Preserve the legacy readiness identifier so older loader contracts can still
  // complete, but create ZERO portal/cab geometry. The 57 static gates render
  // only the exact supplied Airport_Jetway.glb. Earlier generated terminal door
  // boxes and 3.9 x 3.5 m aircraft-end caps were not source geometry and showed
  // up in the live app as detached/falling square fronts.
  const removedGeneratedMeshCount = removeGeneratedClosureGeometry(fleet);
  const gateCount = placements.filter((placement) => placement.gate !== "A1").length;
  if (gateCount !== 57) {
    throw new Error(`Static source-only jetway gate count mismatch: ${gateCount}`);
  }
  return Object.freeze({
    authority: STATIC_PORTAL_AUTHORITY,
    gateCount,
    batchCount: 0,
    panelCount: 0,
    windowCount: 0,
    cabPanelCount: 0,
    cabWindowCount: 0,
    cabSurroundPieceCount: 0,
    cabClosureAuthority: STATIC_CAB_CLOSURE_AUTHORITY,
    authoredNodeTransformCount: 0,
    opaqueCabCapDepthMeters: 0,
    apronFacingOpenAreaMeters: 0,
    generatedGeometryCount: 0,
    removedGeneratedMeshCount,
  });
}

export { STATIC_PORTAL_AUTHORITY as STATIC_JETWAY_PORTAL_CLOSURE_AUTHORITY };
export { STATIC_CAB_CLOSURE_AUTHORITY as STATIC_JETWAY_CAB_CLOSURE_AUTHORITY };
