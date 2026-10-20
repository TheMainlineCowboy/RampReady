// Browser smoke test of the *actual* React launch screen + A1 mission board.
// Intentionally stops before the high-memory airport runtime is loaded.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

const port = 4177;
const base = `http://127.0.0.1:${port}/RampReady/`;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env },
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 150; i += 1) {
    if (server.exitCode !== null) throw new Error(`Vite exited: ${output}`);
    try {
      const result = await fetch(base);
      if (result.ok) return;
    } catch { /* Server starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite did not start: ${output}`);
}

const errors = [];
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Gate A1 turnaround" }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Gate A1 turnaround" }).click();
  await page.getByRole("heading", { name: "Gate A1 turnaround" }).waitFor();
  await page.getByRole("button", { name: "Accept assignment" }).click();
  const release = page.getByRole("button", { name: "Begin live A1 pushback" });
  assert.equal(await release.isDisabled(), true, "Release must be locked until all tasks are complete");
  await page.getByRole("button", { name: "Confirm secured" }).click();
  await page.getByRole("button", { name: "Confirm safety zone" }).click();
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: /Record next .* unloaded/ }).click();
  }
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole("button", { name: /Record next .* loaded/ }).click();
  }
  await page.getByRole("button", { name: "Confirm GSE clear" }).click();
  await page.getByRole("button", { name: "Confirm cones removed" }).click();
  await page.getByRole("button", { name: "Confirm chocks removed" }).click();
  assert.equal(await release.isEnabled(), true, "Pushback release should unlock after all checks");
  assert.match(await page.locator(".a1-summary").innerText(), /12\s*\/\s*12/);
  assert.match(await page.locator(".a1-summary").innerText(), /16\s*\/\s*16/);
  assert.match(await page.locator(".a1-summary").innerText(), /8\s*\/\s*9/);
  fs.mkdirSync("artifacts/a1", { recursive: true });
  await page.screenshot({ path: "artifacts/a1/a1-ready-mobile.png", fullPage: true });
  assert.deepEqual(errors, [], "Browser page errors");
  console.log("PASS: actual React equipment selection -> A1 briefing -> recorded baggage -> gated pushback release");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
