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
  fs.mkdirSync("test-results", { recursive: true });
  // Heavy Three.js frames make every separate Playwright/renderer round trip
  // expensive. Validate the visible canvas, force the live render and encode the
  // PNG in one browser turn so four evidence views do not consume the entire
  // articulation timeout merely crossing the protocol boundary.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 100 || bounds.height <= 100) throw new Error("Three.js canvas is not visibly rendered");
    if (typeof window.__rampReadyCaptureEvidencePng !== "function") {
      throw new Error("Live Three.js render hook is unavailable");
    }
    return window.__rampReadyCaptureEvidencePng();
  });
  if (!dataUrl || !dataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("Live Three.js render hook did not return PNG evidence");
  }
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
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.trainerCanvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Three.js canvas is missing');
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 100 || bounds.height <= 100) throw new Error('Three.js canvas is not visibly rendered');
    if (typeof window.__rampReadyCaptureEvidencePng !== 'function') {
      throw new Error('Live Three.js render hook is unavailable');
    }
    return window.__rampReadyCaptureEvidencePng();
  });
  if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('Live Three.js render hook did not return PNG evidence');
  }
  const png = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  fs.writeFileSync(outputPath, png);
  if (png.length < 10000) throw new Error(\`\${filename} screenshot is implausibly small: \${png.length} bytes\`);
  return png.length;
}`,
);

const articulationPath = "tests/browser/uploaded-jetway-articulation-v10.spec.js";
let articulationSource = fs.readFileSync(articulationPath, "utf8");
if (articulationSource.includes("test.setTimeout(780_000);")) {
  articulationSource = articulationSource.replace("test.setTimeout(780_000);", "test.setTimeout(1_200_000);");
}
if (!articulationSource.includes("test.setTimeout(1_200_000);")) {
  throw new Error(`${articulationPath}: articulation evidence timeout could not be extended for the heavy exact scene`);
}
fs.writeFileSync(articulationPath, articulationSource, "utf8");

console.log("Replaced stale-backbuffer canvas reads with one-turn live Three.js render/encode capture and extended only the browser evidence budget; all geometry/readiness assertions remain unchanged.");
