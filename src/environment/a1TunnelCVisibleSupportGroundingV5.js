import { groundA1TunnelCVisibleSupportHardwareV3 as groundV4 } from "./a1TunnelCVisibleSupportGroundingV4.js";

// V4 intentionally adds a strict post-V3 pass for remaining rendered support rods.
// The legacy runtime verifier still expresses its identity as primary + secondary,
// so normalize the telemetry to include V4's additional corrected rod surfaces.
// Geometry is not changed here; this wrapper only republishes complete counts.
export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const result = groundV4(THREE, model);
  const extraCount = Number(result.v4RemainingRodCorrectionCount || 0);
  const extraTriangles = Number(result.v4RemainingRodTriangleCount || 0);
  if (!(extraCount >= 1) || !(extraTriangles >= 2)) {
    throw new Error(`A1 V5 support telemetry requires V4 remaining-rod corrections: count=${extraCount} triangles=${extraTriangles}`);
  }
  const secondaryMeshGroundedCount = result.secondaryMeshGroundedCount + extraCount;
  const secondaryMeshGroundedTriangleCount = result.secondaryMeshGroundedTriangleCount + extraTriangles;
  const spatialRodClusterCount = result.spatialRodClusterCount + extraCount;
  const spatialRodTriangleCount = result.spatialRodTriangleCount + extraTriangles;
  const spatialRodVertexCount = result.spatialRodVertexCount + extraTriangles * 3;
  const correctedSupportSetCount = result.groundedComponentCount + secondaryMeshGroundedCount;
  if (correctedSupportSetCount !== result.correctedSupportSetCount) {
    throw new Error(`A1 V5 support telemetry mismatch: normalized=${correctedSupportSetCount} physical=${result.correctedSupportSetCount}`);
  }
  return Object.freeze({
    ...result,
    secondaryMeshGroundedCount,
    secondaryMeshGroundedTriangleCount,
    spatialRodClusterCount,
    spatialRodTriangleCount,
    spatialRodVertexCount,
    correctedSupportSetCount,
    visibleLoadLegCount: correctedSupportSetCount,
  });
}

export { A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY, A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY } from "./a1TunnelCVisibleSupportGroundingV4.js";
