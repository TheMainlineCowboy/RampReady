import fs from "node:fs";

function replaceFunction(path, startMarker, endMarker, replacement) {
  let source = fs.readFileSync(path, "utf8");
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`${path}: browser evidence capture anchors are missing`);
  }
  source = `${source.slice(0, start)}${replacement}\n\n${source.slice(end)}`;
  fs.writeFileSync(path, source, "utf8");
}

replaceFunction(
  "tests/browser/uploaded-jetway-articulation-v10.spec.js",
  "async function captureCanvas(page, path) {",
  "async function captureInspectionPreset",
  `async function captureCanvas(page, path) {
  const canvas = page.locator("canvas.trainerCanvas");
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport || box.width <= 100 || box.height <= 100) {
    throw new Error("Three.js canvas is missing or not visibly rendered");
  }
  const clip = {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.max(1, Math.min(box.width, viewport.width - Math.max(0, box.x))),
    height: Math.max(1, Math.min(box.height, viewport.height - Math.max(0, box.y))),
  };
  if (clip.width <= 100 || clip.height <= 100) throw new Error(\`Jetway evidence clip is invalid: \${JSON.stringify(clip)}\`);
  fs.mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path, type: "png", clip, timeout: 30_000 });
  expect(fs.statSync(path).size).toBeGreaterThan(50_000);
}`,
);

replaceFunction(
  "scripts/verify-terminal4-fleet-visual.cjs",
  "async function capture(page, filename) {",
  "(async () => {",
  `async function capture(page, filename) {
  const outputPath = \`\${evidenceDirectory}/\${filename}\`;
  const canvas = page.locator('canvas.trainerCanvas');
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport || box.width <= 100 || box.height <= 100) {
    throw new Error(\`\${filename} cannot capture a visible Three.js canvas\`);
  }
  const clip = {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.max(1, Math.min(box.width, viewport.width - Math.max(0, box.x))),
    height: Math.max(1, Math.min(box.height, viewport.height - Math.max(0, box.y))),
  };
  if (clip.width <= 100 || clip.height <= 100) throw new Error(\`\${filename} clip is invalid: \${JSON.stringify(clip)}\`);
  await page.screenshot({ path: outputPath, type: 'png', clip, timeout: 30_000 });
  const bytes = fs.statSync(outputPath).size;
  if (bytes < 10000) throw new Error(\`\${filename} screenshot is implausibly small: \${bytes} bytes\`);
  return bytes;
}`,
);

console.log("Replaced raw CDP jetway evidence capture with bounded Playwright screenshots; geometry/readiness assertions remain unchanged.");
