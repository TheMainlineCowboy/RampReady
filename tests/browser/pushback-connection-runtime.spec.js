import { expect, test } from "@playwright/test";

test("runs the full nose-gear lifecycle in the browser runtime", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start training" })).toBeEnabled();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("canvas.trainerCanvas")).toBeVisible();
  await expect(page.locator(".rr-metrics")).toContainText("Connection");
  await expect(page.locator(".rr-metrics")).toContainText("approach");

  const result = await page.evaluate(async () => {
    const moduleUrl = (path) => new URL(path, document.baseURI).href;
    const connection = await import(moduleUrl("src/simulation/noseGearConnection.js"));
    const dynamics = await import(moduleUrl("src/simulation/pushbackDynamics.js"));
    const aligned = { distance: 0.18, lateral: 0.04, heading: 0.01, speed: 0, fromFront: true };
    const phases = [];
    let state = connection.createConnectionState();

    state = connection.stepConnection(state, { metrics: aligned, speed: 0 }, 1 / 60);
    phases.push(state.phase);
    state = connection.requestCapture(state, aligned);
    phases.push(state.phase);
    for (let i = 0; i < 90; i += 1) state = connection.stepConnection(state, { metrics: aligned, speed: 0 }, 1 / 60);
    phases.push(state.phase);
    state = connection.beginTow(state);
    phases.push(state.phase);

    let motion = dynamics.createPushbackState();
    let peakArticulation = 0;
    let turnSample = null;
    for (let i = 0; i < 360; i += 1) {
      motion = dynamics.stepPushbackDynamics(motion, {
        connected: true,
        throttle: 0.65,
        direction: 1,
        steer: i > 120 ? 0.45 : 0,
        brake: false,
        cradleOffset: 3.45,
      }, 1 / 60);
      const articulationMagnitude = Math.abs(motion.articulation);
      if (articulationMagnitude > peakArticulation) {
        peakArticulation = articulationMagnitude;
        turnSample = {
          tugYaw: motion.tugYaw,
          aircraftYaw: motion.aircraftYaw,
          articulation: motion.articulation,
        };
      }
    }

    const turnTugYaw = turnSample?.tugYaw ?? motion.tugYaw;
    const turnAircraftYaw = turnSample?.aircraftYaw ?? motion.aircraftYaw;
    const turnYawLag = Math.abs(turnTugYaw) - Math.abs(turnAircraftYaw);

    let straightenFrames = 0;
    while (Math.abs(motion.articulation) > 5 * Math.PI / 180 && straightenFrames < 600) {
      const command = (steer) => ({
        connected: true,
        throttle: 0.32,
        direction: 1,
        steer,
        brake: false,
        cradleOffset: 3.45,
      });
      const left = dynamics.stepPushbackDynamics(motion, command(-0.42), 1 / 60);
      const right = dynamics.stepPushbackDynamics(motion, command(0.42), 1 / 60);
      const straight = dynamics.stepPushbackDynamics(motion, command(0), 1 / 60);
      motion = [left, right, straight].reduce((best, candidate) => (
        Math.abs(candidate.articulation) < Math.abs(best.articulation) ? candidate : best
      ));
      straightenFrames += 1;
    }

    for (let i = 0; i < 180; i += 1) {
      motion = dynamics.stepPushbackDynamics(motion, {
        connected: true,
        throttle: 0,
        direction: 1,
        steer: 0,
        brake: true,
        cradleOffset: 3.45,
      }, 1 / 60);
    }

    state = connection.requestLower(state, motion.speed, motion.articulation);
    const lowerReason = state.reason;
    phases.push(state.phase);
    for (let i = 0; i < 90; i += 1) state = connection.stepConnection(state, { speed: 0 }, 1 / 60);
    phases.push(state.phase);

    state = connection.stepConnection(state, { speed: 0, clearDistance: 3.45 }, 1 / 60);
    const baselinePhase = state.phase;
    state = connection.stepConnection(state, { speed: 0.4, clearDistance: 2.2 }, 1 / 60);
    const unsafePhase = state.phase;
    const unsafeReason = state.reason;
    state = connection.stepConnection(state, { speed: 0.4, clearDistance: 5.75 }, 1 / 60);
    phases.push(state.phase);

    return {
      phases,
      lowerReason,
      baselinePhase,
      unsafePhase,
      unsafeReason,
      speedAfterBrake: motion.speed,
      articulation: motion.articulation,
      peakArticulation,
      straightenFrames,
      turnTugYaw,
      turnAircraftYaw,
      turnYawLag,
      finalTugYaw: motion.tugYaw,
      finalAircraftYaw: motion.aircraftYaw,
    };
  });

  expect(result.phases, result.lowerReason).toEqual(["aligned", "capturing", "secured", "towing", "lowering", "released", "clear"]);
  expect(result.baselinePhase).toBe("released");
  expect(result.unsafePhase).toBe("released");
  expect(result.unsafeReason).toContain("Unsafe direction");
  expect(result.peakArticulation).toBeGreaterThan(8 * Math.PI / 180);
  expect(result.straightenFrames).toBeLessThan(600);
  expect(Math.abs(result.speedAfterBrake)).toBeLessThan(0.015);
  expect(Math.abs(result.articulation)).toBeLessThan(8 * Math.PI / 180);
  expect(Math.sign(result.turnAircraftYaw)).toBe(-Math.sign(result.turnTugYaw));
  expect(result.turnYawLag).toBeGreaterThan(0);
  expect(Math.abs(result.articulation)).toBeLessThanOrEqual(65 * Math.PI / 180);

  await page.screenshot({ path: "test-results/pushback-connection-runtime.png", fullPage: true });
});
