import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArguments(argv) {
  let input = "artifacts/lektro-scan/source-discovery.json";
  let output = "artifacts/lektro-scan/selected-source.json";
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") input = argv[++index];
    else if (value === "--output") output = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return { input, output };
}

export function selectLektroScanSource(report) {
  if (!report || report.schemaVersion !== 2 || report.hashAlgorithm !== "sha256") {
    throw new Error("Expected a schemaVersion 2 SHA-256 Lektro discovery report.");
  }
  if (!Array.isArray(report.matches)) {
    throw new Error("Discovery report is missing matches.");
  }
  if (report.matches.length === 0) {
    throw new Error("No complete KIRI scan package is available for selection.");
  }
  if (report.matches.length > 1) {
    const directories = report.matches.map((match) => match.directory).join(", ");
    throw new Error(`Multiple complete KIRI scan packages found; selection must be explicit: ${directories}`);
  }

  const selected = report.matches[0];
  for (const name of ["3DModel.obj", "3DModel.mtl", "3DModel.jpg"]) {
    const evidence = selected.files?.[name];
    if (!evidence || !Number.isInteger(evidence.bytes) || evidence.bytes <= 0) {
      throw new Error(`Selected package has invalid size evidence for ${name}.`);
    }
    if (!/^[a-f0-9]{64}$/.test(evidence.sha256 ?? "")) {
      throw new Error(`Selected package has invalid SHA-256 evidence for ${name}.`);
    }
  }

  return {
    schemaVersion: 1,
    sourceDirectory: selected.directory,
    hashAlgorithm: "sha256",
    files: selected.files,
    selectionPolicy: "exactly-one-complete-package",
    sourceDiscovery: {
      schemaVersion: report.schemaVersion,
      searchedRoots: report.searchedRoots,
      maxDepth: report.maxDepth,
    },
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const report = JSON.parse(await readFile(options.input, "utf8"));
  const selected = selectLektroScanSource(report);
  await mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(selected, null, 2)}\n`, { flag: "w" });
  process.stdout.write(`${JSON.stringify(selected, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
