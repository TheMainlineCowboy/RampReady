import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeLektroScanForCleanup } from "./analyze-lektro-scan-clean.mjs";

const DEFAULT_REMOVE_TRIANGLE_SHARE = 0.0025;
const DEFAULT_REVIEW_TRIANGLE_SHARE = 0.02;

function roundEvidenceNumber(value) {
  return Number.isFinite(value) ? Number(value.toFixed(9)) : value;
}

export function buildLektroComponentId(component) {
  const evidence = {
    vertices: component.vertices,
    faces: component.faces,
    triangles: component.triangles,
    bounds: {
      min: component.bounds?.min?.map(roundEvidenceNumber),
      max: component.bounds?.max?.map(roundEvidenceNumber),
      extents: component.bounds?.extents?.map(roundEvidenceNumber),
    },
  };

  const digest = createHash("sha256").update(JSON.stringify(evidence)).digest("hex").slice(0, 16);
  return `lektro-component-${digest}`;
}

export function buildLektroCleanupPlan(report, options = {}) {
  const removeTriangleShare = options.removeTriangleShare ?? DEFAULT_REMOVE_TRIANGLE_SHARE;
  const reviewTriangleShare = options.reviewTriangleShare ?? DEFAULT_REVIEW_TRIANGLE_SHARE;

  if (!(removeTriangleShare >= 0 && removeTriangleShare < reviewTriangleShare && reviewTriangleShare < 1)) {
    throw new Error("Cleanup thresholds must satisfy 0 <= remove < review < 1");
  }

  const components = report.topology?.components;
  const dominantIndex = report.topology?.dominantComponent?.index;
  if (!Array.isArray(components) || components.length === 0 || !Number.isInteger(dominantIndex)) {
    throw new Error("Lektro scan analysis is missing connected-component evidence");
  }

  const dispositions = components.map((component, index) => {
    let action = "review";
    let reason = "non-dominant component requires visual inspection";

    if (index === dominantIndex) {
      action = "retain";
      reason = "dominant connected component anchors scan normalization";
    } else if (component.triangleShare <= removeTriangleShare) {
      action = "remove-candidate";
      reason = "very small disconnected component likely represents scan debris";
    } else if (component.triangleShare >= reviewTriangleShare) {
      action = "retain-candidate";
      reason = "substantial disconnected geometry may be a valid tug assembly";
    }

    return {
      componentId: buildLektroComponentId(component),
      componentIndex: index,
      action,
      reason,
      vertices: component.vertices,
      faces: component.faces,
      triangles: component.triangles,
      vertexShare: component.vertexShare,
      triangleShare: component.triangleShare,
      bounds: component.bounds,
    };
  });

  return {
    version: 2,
    sourceFiles: report.sourceFiles,
    normalizationBasis: report.provisionalNormalization?.basis,
    dominantComponentIndex: dominantIndex,
    dominantComponentId: dispositions[dominantIndex].componentId,
    thresholds: {
      removeTriangleShare,
      reviewTriangleShare,
    },
    summary: {
      retain: dispositions.filter((entry) => entry.action === "retain").length,
      retainCandidates: dispositions.filter((entry) => entry.action === "retain-candidate").length,
      review: dispositions.filter((entry) => entry.action === "review").length,
      removeCandidates: dispositions.filter((entry) => entry.action === "remove-candidate").length,
    },
    reviewQueue: dispositions
      .filter((entry) => entry.action === "retain-candidate" || entry.action === "review")
      .map((entry) => ({
        componentId: entry.componentId,
        componentIndex: entry.componentIndex,
        action: entry.action,
        reason: entry.reason,
        triangles: entry.triangles,
        triangleShare: entry.triangleShare,
        bounds: entry.bounds,
      })),
    dispositions,
    safeguards: [
      "No geometry is deleted automatically.",
      "Stable component IDs must be used to carry visual-review decisions across repeated scan analyses.",
      "Retain-candidate and review components require textured visual inspection.",
      "A documented physical Lektro dimension is required before runtime scaling.",
      "The procedural runtime tug remains active until the scan-derived GLB passes clearance and towing checks.",
    ],
  };
}

export async function buildLektroCleanupPlanFromDirectory(inputDirectory, options) {
  const report = await analyzeLektroScanForCleanup(inputDirectory);
  return buildLektroCleanupPlan(report, options);
}

async function main() {
  const inputDirectory = process.argv[2];
  if (!inputDirectory) {
    throw new Error(
      "Usage: node scripts/build-lektro-cleanup-plan.mjs <directory-containing-3DModel.obj-mtl-jpg>",
    );
  }

  const plan = await buildLektroCleanupPlanFromDirectory(inputDirectory);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
