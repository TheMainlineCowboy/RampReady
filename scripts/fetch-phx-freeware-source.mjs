import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const SOURCES = Object.freeze([
  {
    name: "unmlobo-flightsim-to",
    url: "https://flightsim.to/addon/9074/kphx-phoenix-sky-harbor",
    expectedName: "unmlobo-kphx.zip",
  },
  {
    name: "legacy-phx-freeware",
    url: "https://flyawaysimulation.com/downloads/files/9028/fsx-phoenix-sky-harbor-international-scenery/",
    expectedName: "phx_sky_harbor.zip",
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

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function saveDownload(download, source, network) {
  const suggested = download.suggestedFilename() || source.expectedName;
  const destination = path.join(OUTPUT_DIR, suggested);
  await download.saveAs(destination);
  const bytes = await readFile(destination);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(
    path.join(OUTPUT_DIR, `${source.name}-download.json`),
    `${JSON.stringify({ source: source.name, sourcePage: source.url, suggestedFilename: suggested, bytes: bytes.length, sha256, network }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ downloaded: destination, bytes: bytes.length, sha256, source: source.name }, null, 2));
  return destination;
}

async function snapshot(page, source, stage) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${source.name}-${stage}.png`), fullPage: true }).catch(() => {});
  await writeFile(path.join(OUTPUT_DIR, `${source.name}-${stage}.html`), await page.content(), "utf8").catch(() => {});
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const matches = page.locator(selector);
    const count = await matches.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = matches.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return null;
}

async function attemptSource(source) {
  const page = await context.newPage();
  const requests = [];
  const responses = [];
  let downloaded = null;
  page.on("download", (download) => { downloaded ??= download; });
  page.on("request", (request) => {
    if (/download|9074|9028|kphx|phoenix|harbor|\.zip/i.test(request.url())) {
      requests.push({ method: request.method(), url: request.url(), postData: request.postData() });
    }
  });
  page.on("response", (response) => {
    const headers = response.headers();
    if (/download|9074|9028|kphx|phoenix|harbor|\.zip/i.test(response.url()) || /attachment/i.test(headers["content-disposition"] || "")) {
      responses.push({ status: response.status(), url: response.url(), headers });
    }
  });

  try {
    await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3_000);
    await snapshot(page, source, "round-00");

    const selectors = [
      'form:has(input[name="d_op"]) button[type="submit"]',
      'button:has-text("Download Free")',
      'button:has-text("Download now")',
      'button:has-text("Download")',
      'a:has-text("Download now")',
      'a:has-text("Download")',
      'a[href$=".zip"]',
      'a[href*="download"]',
      '[data-testid*="download"]',
    ];

    for (let round = 1; round <= 18 && !downloaded; round += 1) {
      const title = await page.title();
      const url = page.url();
      const loginWall = /log[ -]?in|sign[ -]?in/i.test(title)
        && await page.locator('input[type="password"]').count();
      if (loginWall) break;

      const candidate = await firstVisible(page, selectors);
      if (candidate) {
        await candidate.scrollIntoViewIfNeeded().catch(() => {});
        await Promise.all([
          page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {}),
          candidate.click({ timeout: 20_000 }).catch(() => {}),
        ]);
      }

      for (let tick = 0; tick < 8 && !downloaded; tick += 1) {
        await delay(1_000);
        const direct = await page.locator('a[href$=".zip"], a[href*="download"]').evaluateAll((links) => links
          .map((link) => ({ href: link.href, text: link.textContent?.trim() || "" }))
          .filter((entry) => /\.zip(?:$|\?)/i.test(entry.href) || /download/i.test(entry.text)));
        if (direct.length) {
          const target = direct.find((entry) => /\.zip(?:$|\?)/i.test(entry.href)) || direct[0];
          await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
        }
      }
      await snapshot(page, source, `round-${String(round).padStart(2, "0")}`);
      requests.push({ method: "STATE", url, postData: JSON.stringify({ title }) });
    }

    if (downloaded) return saveDownload(downloaded, source, { requests, responses });
    await writeFile(
      path.join(OUTPUT_DIR, `${source.name}-network.json`),
      `${JSON.stringify({ url: page.url(), title: await page.title(), requests, responses }, null, 2)}\n`,
    );
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

try {
  let downloaded = null;
  for (const source of SOURCES) {
    downloaded = await attemptSource(source);
    if (downloaded) break;
  }
  if (!downloaded) {
    throw new Error("Neither exact PHX source page emitted a downloadable archive; complete browser and network evidence was preserved");
  }
} finally {
  await browser.close();
}
