import fs from "node:fs";

const path = "tests/browser/crj700-runtime.spec.js";
let source = fs.readFileSync(path, "utf8");

const oldTitleTelemetry = `        title: title ? {
          text: title.textContent,
          clientWidth: title.clientWidth,
          scrollWidth: title.scrollWidth,
        } : null,`;
const compactTitleTelemetry = `        title: title ? {
          text: title.textContent,
          clientWidth: title.clientWidth,
          scrollWidth: title.scrollWidth,
          whiteSpace: getComputedStyle(title).whiteSpace,
          overflow: getComputedStyle(title).overflow,
          textOverflow: getComputedStyle(title).textOverflow,
        } : null,`;

if (source.includes(oldTitleTelemetry)) {
  source = source.replace(oldTitleTelemetry, compactTitleTelemetry);
} else if (!source.includes("textOverflow: getComputedStyle(title).textOverflow")) {
  throw new Error(`${path}: compact mobile title telemetry anchor is missing`);
}

const oldNoOverflowAssertion = `    expect(layout.title?.scrollWidth).toBeLessThanOrEqual((layout.title?.clientWidth || 0) + 1);`;
const compactHudAssertions = `    // Mobile simulator chrome must stay compact instead of expanding to fit
    // the full training title. The complete accessible text remains in the DOM;
    // visual overflow is intentionally ellipsized so the airport owns the screen.
    expect(layout.hud.height).toBeLessThanOrEqual(118);
    expect(layout.metrics.height).toBeLessThanOrEqual(32);
    expect(layout.throttle.height).toBeLessThanOrEqual(46);
    expect(layout.steer.height).toBeLessThanOrEqual(44);
    expect(layout.title?.clientWidth).toBeGreaterThanOrEqual(120);
    expect(layout.title?.scrollWidth).toBeGreaterThan(0);
    expect(layout.title?.whiteSpace).toBe("nowrap");
    expect(layout.title?.overflow).toBe("hidden");
    expect(layout.title?.textOverflow).toBe("ellipsis");`;

if (source.includes(oldNoOverflowAssertion)) {
  source = source.replace(oldNoOverflowAssertion, compactHudAssertions);
} else if (!source.includes("expect(layout.hud.height).toBeLessThanOrEqual(118);")) {
  throw new Error(`${path}: obsolete mobile title-fit assertion is missing and compact HUD acceptance is not installed`);
}

for (const forbidden of [
  "expect(layout.title?.scrollWidth).toBeLessThanOrEqual((layout.title?.clientWidth || 0) + 1);",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale expanding-HUD assertion remains: ${forbidden}`);
}

for (const required of [
  "textOverflow: getComputedStyle(title).textOverflow",
  "expect(layout.hud.height).toBeLessThanOrEqual(118);",
  "expect(layout.metrics.height).toBeLessThanOrEqual(32);",
  "expect(layout.throttle.height).toBeLessThanOrEqual(46);",
  "expect(layout.steer.height).toBeLessThanOrEqual(44);",
  "expect(layout.title?.whiteSpace).toBe(\"nowrap\");",
  "expect(layout.title?.overflow).toBe(\"hidden\");",
  "expect(layout.title?.textOverflow).toBe(\"ellipsis\");",
]) {
  if (!source.includes(required)) throw new Error(`${path}: compact mobile browser requirement is missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Updated CRJ mobile browser acceptance for the compact simulator HUD: preserved full title text in the DOM, enforced ellipsis behavior, and capped the top/telemetry/throttle/steering footprints.");
