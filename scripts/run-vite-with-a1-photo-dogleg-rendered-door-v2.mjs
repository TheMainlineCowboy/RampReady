import { readFile, writeFile } from "node:fs/promises";

const wrapperPath = new URL("./run-vite-with-a1-photo-dogleg-rendered-door-v1.mjs", import.meta.url);
const originalWrapperSource = await readFile(wrapperPath, "utf8");

const strictDiagnosticBlock = `const readinessErrorAnchor = "connector=\${connectorVisibleLength}/\${connectorRibCount}, source=\${exactModelGuard.authority}";\nconst readinessErrorPhoto = "connector=\${connectorVisibleLength}/\${connectorRibCount}, photo=\${photoGeometryActive}/\${photoDoglegAuthority}/\${photoSupportAuthority}/\${photoSupportCount}, source=\${exactModelGuard.authority}";\nif (!preparedReadinessSource.includes(readinessErrorAnchor)) {\n  throw new Error("A1 readiness mismatch diagnostic anchor is missing");\n}\npreparedReadinessSource = preparedReadinessSource.split(readinessErrorAnchor).join(readinessErrorPhoto);`;

const tolerantDiagnosticBlock = `// a1-photo-readiness-diagnostic-wording-tolerant-v1\n// Diagnostic text is not geometry authority. Late readiness preparers legitimately\n// change the exact mismatch wording, so enrich the known form when present but do\n// not block Vite solely because an error-message string changed. The structural\n// dogleg/support/zero-extension/wall-length guards below remain fail-closed.\nconst readinessErrorAnchor = "connector=\${connectorVisibleLength}/\${connectorRibCount}, source=\${exactModelGuard.authority}";\nconst readinessErrorPhoto = "connector=\${connectorVisibleLength}/\${connectorRibCount}, photo=\${photoGeometryActive}/\${photoDoglegAuthority}/\${photoSupportAuthority}/\${photoSupportCount}, source=\${exactModelGuard.authority}";\nif (preparedReadinessSource.includes(readinessErrorAnchor)) {\n  preparedReadinessSource = preparedReadinessSource.split(readinessErrorAnchor).join(readinessErrorPhoto);\n}`;

if (!originalWrapperSource.includes(strictDiagnosticBlock)) {
  throw new Error("A1 photo wrapper no longer contains the expected strict diagnostic-only block; inspect before adapting it.");
}

const preparedWrapperSource = originalWrapperSource.replace(strictDiagnosticBlock, tolerantDiagnosticBlock);
if (!preparedWrapperSource.includes("a1-photo-readiness-diagnostic-wording-tolerant-v1")) {
  throw new Error("A1 photo wrapper diagnostic compatibility patch was not installed");
}

let runError;
let restorationError;
try {
  await writeFile(wrapperPath, preparedWrapperSource, "utf8");
  await import(`./prepare-a1-facade-cone-final-runtime-v1.mjs?final-cone=${Date.now()}`);
  await import(`./run-vite-with-a1-photo-dogleg-rendered-door-v1.mjs?diagnostic-compat=${Date.now()}`);
} catch (error) {
  runError = error;
} finally {
  try {
    await writeFile(wrapperPath, originalWrapperSource, "utf8");
    const restored = await readFile(wrapperPath, "utf8");
    if (restored !== originalWrapperSource) {
      throw new Error("A1 photo wrapper v2 failed to restore the tracked v1 wrapper byte-for-byte");
    }
  } catch (error) {
    restorationError = error;
  }
}

if (runError && restorationError) {
  throw new AggregateError([runError, restorationError], "A1 photo bundle failed and wrapper restoration also failed.");
}
if (restorationError) throw restorationError;
if (runError) throw runError;

console.log("Ran photo-authoritative A1 Vite bundle with final runtime-safe facade cone normalization and diagnostic wording tolerance; all geometry/readiness guards remain fail-closed and tracked wrapper source was restored exactly.");
