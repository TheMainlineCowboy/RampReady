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
  ".github/workflows/pages.yml",
  ".github/workflows/verify-crj700-side-views.yml",
  ".github/workflows/verify-pages-aircraft-extent.yml",
  ".github/workflows/verify-pages-aircraft-views.yml",
  ".github/workflows/verify-crj700-after-live-status.yml",
];
for (const path of obsoleteWorkflows) assert.equal(await exists(path), false, `${path} must remain removed`);

const workflow = await read(".github/workflows/verify-rampready-live-experience.yml");
for (const required of [
  "workflow_run:",
  'workflows: ["Deploy RampReady to GitHub Pages"]',
  "github.event.workflow_run.head_sha",
  "github.event.workflow_run.conclusion == 'success'",
  "scripts/verify-live-experience-browser.cjs",
  "continue-on-error: true",
  "live-experience-evidence/error.txt",
  "live-experience-evidence/release-marker.log",
  "releases/${EXPECTED_SHA}.txt",
  "for attempt in $(seq 1 60)",
  "Pages deployment succeeded but immutable marker",
  "production/rampready-live-experience",
  "production/crj700-side-views",
  "Enforce live-experience verdict",
]) assert.ok(workflow.includes(required), `live workflow missing ${required}`);
assert.ok(!workflow.includes("\n  push:\n"), "live experience verification must not start for commits whose Pages deployment may be cancelled");

const deployWorkflow = await read(".github/workflows/deploy-pages.yml");
for (const required of [
  "push:",
  "branches: [main]",
  "actions/upload-pages-artifact@v3",
  "actions/deploy-pages@v4",
  "public/releases/${GITHUB_SHA}.txt",
  "dist/releases/${GITHUB_SHA}.txt",
  "releases/${EXPECTED_SHA}.txt",
  "Immutable release marker appeared",
  "Verify the rendered Sky Harbor simulator scene",
  "npx playwright test --config=playwright.live-phx.config.js",
]) assert.ok(deployWorkflow.includes(required), `Pages deployment workflow missing ${required}`);
assert.ok(!deployWorkflow.includes("pull_request:"), "feature branches must never deploy GitHub Pages");
assert.ok(!deployWorkflow.includes("release-commit.txt?verify="), "production verification must not rely on a mutable cached marker path");
assert.ok(!deployWorkflow.includes("playwright test scripts/verify-live-phx-render.spec.js"), "PHX render verification must not be filtered out by the default browser test directory");

const phxPlaywrightConfig = await read("playwright.live-phx.config.js");
for (const required of [
  'testDir: "./scripts"',
  'testMatch: "verify-live-phx-render.spec.js"',
  "timeout: 240_000",
  "workers: 1",
]) assert.ok(phxPlaywrightConfig.includes(required), `live PHX Playwright config missing ${required}`);
assert.ok(!phxPlaywrightConfig.includes("webServer"), "live PHX verification must target the deployed site rather than starting a local server");

const browserVerifier = await read("scripts/verify-live-experience-browser.cjs");
for (const required of [
  "Choose pushback equipment",
  "Start training",
  "Verified stand-up runtime is not launchable",
  "standupResponses",
  "/models/standup-tug.glb",
  "authored-standup",
  "canvas.trainerCanvas",
  "data-camera-yaw",
  ".rr-power-slider",
  ".rr-view-select",
  "view: rect('.rr-view-select')",
  "setCameraView",
  "newCDPSession",
  "Page.captureScreenshot",
  "inspectCompositedPng",
  "uniqueColorBuckets",
  "blank or visually flat",
  "/models/crj700-user.glb",
  "/models/crj700-mobile.glb",
  "mobile-layout.json",
  "error.txt",
]) assert.ok(browserVerifier.includes(required), `live browser verifier missing ${required}`);
assert.ok(!browserVerifier.includes("page.screenshot"), "live render evidence must not use Playwright page.screenshot because it can hang on the composited Three.js scene");
assert.ok(!browserVerifier.includes("Stand-up model is launchable without its runtime GLB"), "production verifier must not preserve the obsolete pending-asset gate");
assert.ok(!browserVerifier.includes("toDataURL('image/png')"), "live render evidence must not use the cleared default WebGL framebuffer");
assert.ok(!browserVerifier.includes("page.selectOption('.rr-view-select'"), "camera verification must not depend on Playwright visibility after evidence overlays are hidden");

const selection = await read("src/components/PushbackTrainer.jsx");
assert.ok(selection.includes("useState(null)"), "equipment screen must be the real initial route");
assert.ok(!selection.includes("side-view-verification"), "production verification must not bypass equipment selection");
assert.ok(!selection.includes("extent-verification"), "extent verification must not bypass equipment selection");
assert.ok(selection.includes("RampReadyLektroPrototypeTrainer"), "active pushback trainer route must remain connected");

const profiles = await read("src/config/equipmentProfiles.js");
assert.ok(profiles.includes('DEFAULT_EQUIPMENT_ID = "lektro-88"'), "Lektro must remain the default runtime");
assert.ok(profiles.includes('id: "standup-tug"'), "stand-up option must remain visible");
assert.ok(profiles.includes('statusLabel: "Verified runtime"'), "stand-up verified runtime state must be explicit");
assert.match(profiles, /id: "standup-tug"[\s\S]*?available: true/, "verified stand-up model must remain launchable");

const equipmentVisual = await read("src/tug/runtimeEquipmentVisual.js");
for (const required of [
  '"standup-tug"',
  "GLTFLoader",
  "models/standup-tug.glb",
  'rig.visual.visible = false',
  'runtimeVisualSource = "authored-standup"',
]) assert.ok(equipmentVisual.includes(required), `authored stand-up runtime loader missing ${required}`);

const terminal4Preparation = await read("scripts/prepare-terminal4-runtime.mjs");
for (const required of [
  "installRuntimeEquipmentVisual",
  "supportsRuntimeEquipmentVisual(equipmentId)",
  'dataset.tugSource = equipmentId === "standup-tug" ? "loading" : "procedural-lektro"',
]) assert.ok(terminal4Preparation.includes(required), `active Terminal 4 equipment routing missing ${required}`);

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

console.log("RampReady live release gate verified: successful-deploy-only live experience verification, one authoritative PHX browser render gate, immutable release markers, CDP compositor-backed evidence, verified authored stand-up equipment routing, touch camera orbit, visible mobile controls, and diagnosable production evidence are enforced.");