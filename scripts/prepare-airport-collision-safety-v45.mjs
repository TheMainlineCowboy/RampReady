import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targetPath = path.join(root, "src/components/RampReadyStandupTrainerTerminal4.jsx");
let source = fs.readFileSync(targetPath, "utf8");

const dynamicsImport = 'import { JACKKNIFE_WARNING, createPushbackState, stepPushbackDynamics } from "../simulation/pushbackDynamics.js";';
const collisionImport = 'import { findAirportCollision, resolveAirportCollisionState } from "../simulation/airportCollision.js";';
const dynamicsAnchor = "      sim.dynamics = stepPushbackDynamics(sim.dynamics, {";
const stateAnchor = "      const state = sim.dynamics;";
const simAnchor = "const sim = { renderer, scene, camera, environment, rig, aircraft, connection: createConnectionState(), dynamics: createPushbackState(), last: performance.now(), lastHud: 0 };";

if (!source.includes(collisionImport)) {
  if (!source.includes(dynamicsImport)) throw new Error("Pushback dynamics import anchor is missing");
  source = source.replace(dynamicsImport, `${dynamicsImport}\n${collisionImport}`);
}

if (!source.includes("lastCollisionMessage")) {
  if (!source.includes(simAnchor)) throw new Error("Simulator state anchor is missing");
  source = source.replace(
    simAnchor,
    "const sim = { renderer, scene, camera, environment, rig, aircraft, connection: createConnectionState(), dynamics: createPushbackState(), last: performance.now(), lastHud: 0, lastCollisionMessage: 0 };",
  );
}

if (!source.includes("const previousDynamics = sim.dynamics;")) {
  if (!source.includes(dynamicsAnchor)) throw new Error("Dynamics step anchor is missing");
  source = source.replace(dynamicsAnchor, `      const previousDynamics = sim.dynamics;\n${dynamicsAnchor}`);
}

if (!source.includes("data-collision-authority") && !source.includes("dataset.collisionAuthority")) {
  if (!source.includes(stateAnchor)) throw new Error("Dynamics state anchor is missing");
  source = source.replace(
    stateAnchor,
    `      const proposedDynamics = sim.dynamics;
      const collisionManifest = environment
        .getObjectByName("UploadedAirportJetwayFleet")
        ?.userData?.airportCollisionManifest;
      const collision = findAirportCollision({
        previousState: previousDynamics,
        proposedState: proposedDynamics,
        manifest: collisionManifest,
        equipmentId,
        inspectionActive,
        towing,
        parkedAircraftPose: inspectionActive
          ? { x: aircraft.position.x, z: aircraft.position.z, yaw: aircraft.rotation.y }
          : null,
        aircraftScale: aircraft.scale.x || 0.82,
      });
      sim.dynamics = collision
        ? resolveAirportCollisionState(previousDynamics, proposedDynamics, towing)
        : proposedDynamics;
      canvas.dataset.collisionAuthority = collision?.authority
        || collisionManifest?.authority
        || "awaiting-supplied-jetway-collision-manifest";
      canvas.dataset.collisionObstacleCount = String(collisionManifest?.obstacleCount || 0);
      canvas.dataset.collisionState = collision ? "blocked" : "clear";
      canvas.dataset.collisionBody = collision?.body || "none";
      canvas.dataset.collisionObstacle = collision?.label || "none";
      if (collision && now - sim.lastCollisionMessage > 700) {
        sim.lastCollisionMessage = now;
        driveRef.current.throttle = 0;
        setThrottle(0);
        if (!inspectionActive) scoreRef.current = Math.max(0, scoreRef.current - 2);
        setMessage(\`Stopped before contact with \${collision.label}. Steer clear before adding power.\`);
      }

${stateAnchor}`,
  );
}

for (const required of [
  collisionImport,
  "const previousDynamics = sim.dynamics;",
  "findAirportCollision({",
  "resolveAirportCollisionState(previousDynamics, proposedDynamics, towing)",
  "canvas.dataset.collisionState = collision ? \"blocked\" : \"clear\"",
]) {
  if (!source.includes(required)) throw new Error(`Airport collision safety preparation is incomplete: ${required}`);
}

fs.writeFileSync(targetPath, source);
console.log("Prepared continuous tug and towed-aircraft collision safety against all supplied jetways, fixed connectors, terminal wall segments and the parked CRJ700.");
