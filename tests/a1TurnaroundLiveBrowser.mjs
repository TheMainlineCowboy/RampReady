// Smoke-test the published GitHub Pages opt-in A1 mission.
// Verifies normal visitors cannot access the preview button unless opted in.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const url = process.env.PAGE_URL;
if (!url || !/^https:\/\//.test(url)) throw new Error("GitHub Pages PAGE_URL is required");
const root = url.endsWith("/") ? url : url + "/";
fs.mkdirSync("live-phx-render-evidence", { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const exceptions = [];
  page.on("pageerror", (error) => exceptions.push(String(error)));
  await page.goto(root, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: "Start training" }).waitFor({ timeout: 45000 });
  assert.equal(await page.getByRole("button", { name: /Gate A1 turnaround/ }).count(), 0);
  await page.goto(root + "?a1Preview=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: /Gate A1 turnaround/ }).waitFor({ timeout: 45000 });
  await page.getByRole("button", { name: /Gate A1 turnaround/ }).click();
  await page.getByRole("heading", { name: "Gate A1 turnaround" }).waitFor();
  await page.screenshot({ path: "live-phx-render-evidence/a1-preview-live-mobile.png", fullPage: true });
  assert.deepEqual(exceptions, [], "Published A1 preview page should have no JavaScript exceptions");
  console.log("PASS: GitHub Pages default launch unchanged; ?a1Preview=1 serves new A1 mission.");
} finally {
  await browser.close();
}
