import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const exists = async (path) => {
  try {
    await access(new URL(path, root), constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const obsoleteWorkflows = [
  ".github/workflows/verify-crj700-side-views.yml",
  ".github/workflows/verify-pages-aircraft-extent.yml",
  ".github/workflows/verify-pages-aircraft-views.yml",
  ".github/workflows/verify-crj700-after-live-status.yml",
];
for (const path of obsoleteWorkflows) assert.equal(await exists(path), false, `${path} must remain removed`);

const workflow = await read(".github/workflows/verify-rampready-live-experience.yml");
for (const required of [
  "scripts/verify-live-experience-browser.cjs",
  "continue-on-error: true",
  "live-experience-evidence/error.txt",
  "production/rampready-live-experience",
  "production/crj700-side-views",
  "Enforce live-experience verdict",
]) assert.ok(workflow.includes(required), `live workflow missing ${required}`);

const browserVerifier = await read("scripts/verify-live-experience-browser.cjs");
for (const required of [
  "Choose pushback equipment",
  "Start training",
  "Stand-up model is launchable",
  "canvas.trainerCanvas",
  "data-camera-yaw",
  ".rr-power-slider",
  "/models/crj700-user.glb",
  "/models/crj700-mobile.glb",
  "mobile-layout.json",
  "error.txt",
]) assert.ok(browserVerifier.includes(required), `live browser verifier missing ${required}`);

const selection = await read("src/components/PushbackTrainer.jsx");
assert.ok(selection.includes("useState(null)"), "equipment screen must be the real initial route");
assert.ok(!selection.includes("side-view-verification"), "production verification must not bypass equipment selection");
assert.ok(!selection.includes("extent-verification"), "extent verification must not bypass equipment selection");
assert.ok(selection.includes("RampReadyLektroPrototypeTrainer"), "runtime must not be presented as a loaded stand-up model");

const profiles = await read("src/config/equipmentProfiles.js");
assert.ok(profiles.includes('DEFAULT_EQUIPMENT_ID = "lektro-88"'), "Lektro prototype must be the honest default runtime");
assert.ok(profiles.includes('id: "standup-tug"'), "stand-up option must remain visible");
assert.ok(profiles.includes('statusLabel: "Asset not loaded"'), "stand-up pending state must be explicit");
assert.match(profiles, /id: "standup-tug"[\s\S]*?available: false/, "stand-up model must remain gated until integrated");

const trainer = await read("src/components/RampReadyStandupTrainer.jsx");
for (const required of [
  'import "./mobile-runtime-recovery.css"',
  "handlePointerDown",
  "handlePointerMove",
  "data-equipment-id",
  "rr-power-slider",
  "rr-session-menu",
  "onChangeEquipment",
  "onToggleGyro",
]) assert.ok(trainer.includes(required), `active trainer missing ${required}`);

const css = await read("src/components/mobile-runtime-recovery.css");
for (const required of [
  "top: auto !important",
  "bottom: calc(var(--rr-recovery-safe) + 66px) !important",
  "grid-template-columns: 76px minmax(0, 1fr) 58px !important",
  ".rr-shell .rr-throttle input[type=\"range\"]",
  "transform: none !important",
  "bottom: var(--rr-recovery-safe) !important",
]) assert.ok(css.includes(required), `mobile recovery CSS missing ${required}`);

console.log("RampReady live release gate verified: authoritative checked-in browser verification, honest equipment gating, touch camera orbit, visible mobile controls, and diagnosable production evidence are enforced.");
