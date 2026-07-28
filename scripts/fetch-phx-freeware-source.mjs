import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const SOURCES = Object.freeze([
  {
    name: "unmlobo-flightsim-to",
    url: "https://flightsim.to/addon/9074/kphx-phoenix-sky-harbor",
    expectedName: "unmlobo-kphx.zip",
    selectors: [
      'a:has-text("Download")',
      'button:has-text("Download")',
      '[data-testid*="download"]',
      '[class*="download"] a',
      '[class*="download"] button',
    ],
  },
  {
    name: "legacy-phx-freeware",
    url: "https://flyawaysimulation.com/downloads/files/9028/fsx-phoenix-sky-harbor-international-scenery/",
    expectedName: "phx_sky_harbor.zip",
    selectors: [
      'button:has-text("Download Free")',
      'a:has-text("Download Free")',
      'input[type="submit"][value*="Download"]',
      'form:has-text("Download Free") button',
    ],
  },
]);
const OUTPUT_DIR = path.resolve(process.argv[2] || "source-download");
await mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1440, height: 1100 },
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
});

async function saveDownload(download, source, network) {
  const suggested = download.suggestedFilename() || source.expectedName;
  const destination = path.join(OUTPUT_DIR, suggested);
  await download.saveAs(destination);
  const bytes = await readFile(destination);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const result = {
    source: source.name,
    sourcePage: source.url,
    suggestedFilename: suggested,
    bytes: bytes.length,
    sha256,
    network,
  };
  await writeFile(path.join(OUTPUT_DIR, `${source.name}-download.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ downloaded: destination, bytes: bytes.length, sha256, source: source.name }, null, 2));
  return destination;
}

async function attemptSource(source) {
  const page = await context.newPage();
  const requests = [];
  const responses = [];
  page.on("request", (request) => {
    if (/download|9074|9028|kphx|phoenix|harbor/i.test(request.url())) {
      requests.push({ method: request.method(), url: request.url(), postData: request.postData() });
    }
  });
  page.on("response", (response) => {
    const headers = response.headers();
    if (/download|9074|9028|kphx|phoenix|harbor/i.test(response.url()) || /attachment/i.test(headers["content-disposition"] || "")) {
      responses.push({ status: response.status(), url: response.url(), headers });
    }
  });

  try {
    await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(5_000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${source.name}-initial.png`), fullPage: true });
    await writeFile(path.join(OUTPUT_DIR, `${source.name}-initial.html`), await page.content(), "utf8");

    for (const selector of source.selectors) {
      const candidates = page.locator(selector);
      const count = await candidates.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = candidates.nth(index);
        if (!(await candidate.isVisible().catch(() => false))) continue;
        const downloadPromise = page.waitForEvent("download", { timeout: 180_000 }).catch(() => null);
        const popupPromise = page.waitForEvent("popup", { timeout: 20_000 }).catch(() => null);
        await candidate.scrollIntoViewIfNeeded().catch(() => {});
        await candidate.click({ timeout: 30_000 }).catch(() => null);
        const popup = await popupPromise;
        if (popup) {
          await popup.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => {});
          await popup.screenshot({ path: path.join(OUTPUT_DIR, `${source.name}-popup.png`), fullPage: true }).catch(() => {});
          await writeFile(path.join(OUTPUT_DIR, `${source.name}-popup.html`), await popup.content(), "utf8").catch(() => {});
        }
        const download = await downloadPromise;
        if (download) return saveDownload(download, source, { requests, responses });

        await page.waitForTimeout(3_000);
        await page.screenshot({ path: path.join(OUTPUT_DIR, `${source.name}-after-click.png`), fullPage: true }).catch(() => {});
        await writeFile(path.join(OUTPUT_DIR, `${source.name}-after-click.html`), await page.content(), "utf8").catch(() => {});

        const directLinks = await page.locator('a[href]').evaluateAll((links) => links
          .map((link) => ({ href: link.href, text: link.textContent?.trim() || "", download: link.getAttribute("download") }))
          .filter((entry) => /download|\.zip(?:$|\?)/i.test(`${entry.href} ${entry.text}`)));
        for (const entry of directLinks) {
          const directPromise = page.waitForEvent("download", { timeout: 120_000 }).catch(() => null);
          await page.goto(entry.href, { waitUntil: "domcontentloaded", timeout: 120_000 }).catch(() => {});
          const directDownload = await directPromise;
          if (directDownload) return saveDownload(directDownload, source, { requests, responses, directLinks });
        }
      }
    }

    await writeFile(path.join(OUTPUT_DIR, `${source.name}-network.json`), `${JSON.stringify({ url: page.url(), title: await page.title(), requests, responses }, null, 2)}\n`);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

try {
  for (const source of SOURCES) {
    const downloaded = await attemptSource(source);
    if (downloaded) process.exitCode = 0;
    if (downloaded) break;
  }
  if (!process.exitCode && !(await import("node:fs").then(({ existsSync }) => SOURCES.some((source) => existsSync(path.join(OUTPUT_DIR, source.expectedName)))))) {
    throw new Error("Neither exact PHX source page emitted a downloadable archive; complete browser and network evidence was preserved");
  }
} finally {
  await browser.close();
}
