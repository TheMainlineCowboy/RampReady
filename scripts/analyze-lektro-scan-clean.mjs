import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeLektroScan } from "./analyze-lektro-scan.mjs";

export async function analyzeLektroScanForCleanup(inputDirectory) {
  const report = await analyzeLektroScan(inputDirectory);
  const dominant = report.topology?.dominantComponent;

  if (!dominant?.bounds?.extents) {
    throw new Error("Lektro scan has no dominant connected component for cleanup normalization");
  }

  const [extentX, , extentZ] = dominant.bounds.extents;
  const longestHorizontalExtent = Math.max(extentX, extentZ);
  if (!Number.isFinite(longestHorizontalExtent) || longestHorizontalExtent <= 0) {
    throw new Error("Dominant Lektro component has no usable horizontal extent");
  }

  return {
    ...report,
    provisionalNormalization: {
      ...report.provisionalNormalization,
      basis: "dominant-connected-component",
      sourceComponentIndex: dominant.index,
      sourceBounds: dominant.bounds,
      ignoredGlobalBounds: report.bounds,
      scaleFactor:
        report.provisionalNormalization.targetLongestHorizontalExtentMeters /
        longestHorizontalExtent,
      warning:
        "Inspection-only scale derived from the dominant connected component. Confirm a documented physical Lektro dimension before runtime conversion.",
    },
  };
}

async function main() {
  const inputDirectory = process.argv[2];
  if (!inputDirectory) {
    throw new Error(
      "Usage: npm run analyze:lektro-scan -- <directory-containing-3DModel.obj-mtl-jpg>",
    );
  }

  const report = await analyzeLektroScanForCleanup(inputDirectory);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
