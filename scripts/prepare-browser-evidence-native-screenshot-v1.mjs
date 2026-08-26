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
  if (!box || box.width <= 100 || box.height <= 100) {
    throw new Error("Three.js canvas is missing or not visibly rendered");
  }
  fs.mkdirSync("test-results", { recursive: true });
  const dataUrl = await canvas.evaluate((node) => {
    const encoded = node.toDataURL("image/png");
    if (!encoded || !encoded.startsWith("data:image/png;base64,")) {
      throw new Error("Three.js canvas did not return PNG evidence");
    }
    return encoded;
  });
  const png = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
  fs.writeFileSync(path, png);
  expect(png.length).toBeGreaterThan(50_000);
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
  if (!box || box.width <= 100 || box.height <= 100) {
    throw new Error(\`\${filename} cannot capture a visible Three.js canvas\`);
  }
  const dataUrl = await canvas.evaluate((node) => {
    const encoded = node.toDataURL('image/png');
    if (!encoded || !encoded.startsWith('data:image/png;base64,')) {
      throw new Error('Three.js canvas did not return PNG evidence');
    }
    return encoded;
  });
  const png = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  fs.writeFileSync(outputPath, png);
  if (png.length < 10000) throw new Error(\`\${filename} screenshot is implausibly small: \${png.length} bytes\`);
  return png.length;
}`,
);

console.log("Replaced compositor screenshots with frame-independent direct rendered-canvas PNG capture; geometry/readiness assertions remain unchanged.");
