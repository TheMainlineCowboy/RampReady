import fs from "node:fs";

const path = "tests/browser/source-first-a1-repair.spec.js";
const marker = "source-first-a1-attached-preset-before-physical-wait-v1";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(marker)) {
  const anchor = `  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();\n\n  await page.waitForFunction(({
`;
  if (!source.includes(anchor)) {
    throw new Error(`${path}: source-first initial readiness anchor is missing`);
  }
  const replacement = `  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();\n\n  // ${marker}\n  // Final Cab-surface/door telemetry is published by the attached A1 inspection\n  // path. Enter that preset before waiting on those fields; otherwise the test\n  // deadlocks waiting for telemetry whose lifecycle it has not activated yet.\n  await chooseInspectionPreset(page, "a1Connection");\n  await page.waitForFunction(() => {\n    const data = document.querySelector("canvas.trainerCanvas")?.dataset;\n    return data?.inspectionPreset === "a1Connection";\n  }, { timeout: 30_000, polling: 100 });\n\n  await page.waitForFunction(({
`;
  source = source.replace(anchor, replacement);
}

for (const required of [
  marker,
  'await chooseInspectionPreset(page, "a1Connection")',
  'data?.inspectionPreset === "a1Connection"',
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: attached-preset sequencing is missing ${required}`);
  }
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared source-first A1 browser sequencing: attached A1 preset is activated before final physical Cab/door readiness is awaited.");
