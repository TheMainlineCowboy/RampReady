import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const SOURCE_PAGE = "https://flyawaysimulation.com/downloads/files/9028/fsx-phoenix-sky-harbor-international-scenery/";
const OUTPUT_DIR = path.resolve(process.argv[2] || "source-download");
await mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const requests = [];
const responses = [];
page.on("request", (request) => {
  if (/download|9028|phx_sky_harbor/i.test(request.url())) requests.push({ method: request.method(), url: request.url(), postData: request.postData() });
});
page.on("response", (response) => {
  const headers = response.headers();
  if (/download|9028|phx_sky_harbor/i.test(response.url()) || /attachment/i.test(headers["content-disposition"] || "")) {
    responses.push({ status: response.status(), url: response.url(), headers });
  }
});

try {
  await page.goto(SOURCE_PAGE, { waitUntil: "networkidle", timeout: 120_000 });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "source-page.png"), fullPage: true });
  await writeFile(path.join(OUTPUT_DIR, "source-page.html"), await page.content(), "utf8");

  const candidates = [
    page.getByRole("button", { name: /Download Free/i }),
    page.getByRole("link", { name: /Download Free/i }),
    page.locator('input[type="submit"][value*="Download"]'),
    page.locator('input[type="button"][value*="Download"]'),
    page.locator('form:has-text("Download Free") input'),
  ];
  let clicked = false;
  for (const candidate of candidates) {
    if (await candidate.count() && await candidate.first().isVisible()) {
      const downloadPromise = page.waitForEvent("download", { timeout: 480_000 }).catch(() => null);
      await candidate.first().click({ timeout: 30_000 });
      const download = await downloadPromise;
      if (download) {
        const suggested = download.suggestedFilename() || "phx_sky_harbor.zip";
        const destination = path.join(OUTPUT_DIR, suggested);
        await download.saveAs(destination);
        const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(destination));
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        await writeFile(path.join(OUTPUT_DIR, "download.json"), `${JSON.stringify({ sourcePage: SOURCE_PAGE, suggestedFilename: suggested, bytes: bytes.length, sha256, requests, responses }, null, 2)}\n`);
        console.log(JSON.stringify({ downloaded: destination, bytes: bytes.length, sha256 }, null, 2));
        clicked = true;
        break;
      }
      await page.waitForTimeout(2_000);
    }
  }
  if (!clicked) {
    await writeFile(path.join(OUTPUT_DIR, "network.json"), `${JSON.stringify({ url: page.url(), title: await page.title(), requests, responses }, null, 2)}\n`);
    throw new Error("The public freeware download did not emit a browser download; page/network evidence was saved for the next extraction path");
  }
} finally {
  await browser.close();
}
