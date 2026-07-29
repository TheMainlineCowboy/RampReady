import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";

async function launchStandup(page) {
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  await page.getByRole("radio", { name: /Stand-up pushback/i }).click();
  const launch = page.getByRole("button", { name: "Start training" });
  await expect(launch).toBeEnabled();
  await launch.click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible();
  return canvas;
}

test("populates source-decoded Terminal 4 stands with authored static aircraft", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const canvas = await launchStandup(page);
  await expect.poll(
    async () => canvas.getAttribute("data-static-aircraft-count"),
    { timeout: 90_000, intervals: [500, 1_000, 2_000] },
  ).toBe("7");

  const runtime = await canvas.evaluate((element) => ({ ...element.dataset }));
  expect(runtime.staticAircraftCount).toBe("7");
  expect(runtime.staticAircraftGates).toBe("A2,A3,A4,A5,A6,A7,A8");
  expect(runtime.staticAircraftDetailLevel).toBe("authored-crj700-static-gate-population-v1");
  expect(runtime.environmentSource).toBe("authored-phx-terminal4-textured-source-jetways");
  expect(runtime.groundSource).toBe("authored-kphx-v181-source-textured");
  expect(runtime.photoGroundSource).toBe("source-authored-phx-photo");

  const relevantErrors = runtimeErrors.filter((message) =>
    /static aircraft load failed|static aircraft failed to load|Unexpected CRJ700 dimensions|No aircraft asset candidate|GLTFLoader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);
});
