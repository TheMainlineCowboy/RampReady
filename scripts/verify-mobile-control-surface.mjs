import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/components/throttle-force.css", import.meta.url), "utf8");

for (const required of [
  "--rr-safe-left",
  "--rr-safe-right",
  "--rr-safe-bottom",
  "env(safe-area-inset-left)",
  "env(safe-area-inset-right)",
  "env(safe-area-inset-bottom)",
  "grid-template-columns: 1fr 1.2fr 1fr",
  "right: calc(var(--rr-safe-right) + var(--rr-throttle-width) + 8px)",
  "max-height: 168px",
  ".rr-shell .rr-checklist",
  "display: none",
  "@media (max-width: 820px) and (max-height: 520px)",
]) {
  assert.ok(css.includes(required), `mobile control surface missing required contract: ${required}`);
}

const mobileBlock = css.slice(css.indexOf("@media (max-width: 820px)"));
assert.ok(mobileBlock.includes("bottom: var(--rr-safe-bottom)"), "mobile controls must remain inside the bottom safe area");
assert.ok(mobileBlock.includes("overflow: hidden"), "mobile throttle deck must prevent viewport overflow");
assert.ok(mobileBlock.includes("min-height: 64px"), "primary steering and braking controls must remain large touch targets");
assert.ok(mobileBlock.includes("opacity: 0.001"), "full throttle deck must remain an active drag target without obscuring compact buttons");
assert.ok(!mobileBlock.includes("right: 104px;\n    bottom: calc(60px"), "legacy fixed mobile offsets must not remain in the force override");

console.log("RampReady mobile control-surface verification passed: safe-area aware compact HUD, non-overlapping bottom control deck, large touch targets, and short-landscape compression are enforced.");
