import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/components/mobile-runtime-recovery.css", import.meta.url), "utf8");

for (const required of [
  "--rr-recovery-safe",
  "env(safe-area-inset-bottom)",
  "grid-template-columns: 76px minmax(0, 1fr) 58px",
  "grid-template-columns: 1fr 1.2fr 1fr",
  "bottom: calc(var(--rr-recovery-safe) + 66px)",
  "bottom: var(--rr-recovery-safe)",
  ".rr-shell .rr-throttle input[type=\"range\"]",
  "transform: none !important",
  "opacity: 1 !important",
  ".rr-session-menu-popover",
  ".rr-equipment-actions",
  "position: sticky",
  "@media (max-width: 820px) and (max-height: 560px)",
]) {
  assert.ok(css.includes(required), `mobile recovery surface missing required contract: ${required}`);
}

const mobileBlock = css.slice(css.indexOf("@media (max-width: 820px)"));
assert.ok(mobileBlock.includes("height: 56px !important"), "mobile throttle must be a visible compact horizontal deck");
assert.ok(mobileBlock.includes("height: 58px !important"), "mobile steering controls must remain visible above the safe area");
assert.ok(mobileBlock.includes("min-height: 46px !important"), "steering and braking controls must remain large touch targets");
assert.ok(mobileBlock.includes("overflow: hidden !important"), "mobile decks must not extend beyond the viewport");
assert.ok(!mobileBlock.includes("opacity: 0.001"), "the power slider must not be hidden behind an invisible drag layer");

console.log("RampReady mobile control-surface verification passed: horizontal power, visible steering/brake controls, safe-area containment, compact telemetry, and non-blocking session menu are enforced.");
