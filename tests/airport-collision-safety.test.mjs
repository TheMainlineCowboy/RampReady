import assert from "node:assert/strict";
import {
  AIRPORT_COLLISION_AUTHORITY,
  findAirportCollision,
  resolveAirportCollisionState,
} from "../src/simulation/airportCollision.js";
import {
  UPLOADED_JETWAY_COLLISION_AUTHORITY,
  buildUploadedAirportJetwayCollisionManifest,
} from "../src/environment/uploadedAirportJetwayCollisionManifest.js";

const placements = Array.from({ length: 58 }, (_, index) => ({
  gate: `A${index + 1}`,
  x: index * 18,
  z: 0,
  yaw: 0,
  wallConnectorLength: 8,
  connectorTowardX: 0,
  connectorTowardZ: -1,
}));

const manifest = buildUploadedAirportJetwayCollisionManifest(placements);
assert.equal(manifest.authority, UPLOADED_JETWAY_COLLISION_AUTHORITY);
assert.equal(manifest.jetwayCount, 58);
assert.equal(manifest.connectorCount, 58);
assert.ok(manifest.obstacleCount >= 116, "jetways and fixed connectors must all have collision proxies");
assert.equal(manifest.obstacles.filter((entry) => entry.kind === "supplied-jetway").length, 58);
assert.equal(manifest.obstacles.filter((entry) => entry.kind === "fixed-terminal-connector").length, 58);
assert.ok(manifest.obstacles.some((entry) => entry.kind === "terminal-wall"));

const singleObstacleManifest = {
  authority: UPLOADED_JETWAY_COLLISION_AUTHORITY,
  obstacleCount: 1,
  obstacles: [{
    type: "obb",
    kind: "supplied-jetway",
    label: "A1 jetway",
    centerX: 0,
    centerZ: 8,
    yaw: 0,
    halfWidth: 2.4,
    halfLength: 12,
  }],
};

const clearState = {
  tugX: 8,
  tugZ: -8,
  tugYaw: 0,
  aircraftX: 0,
  aircraftZ: -30,
  aircraftYaw: 0,
  speed: 0.4,
  articulation: 0,
};
const collidingState = { ...clearState, tugX: 0, tugZ: -3, speed: 0.7 };
const tugCollision = findAirportCollision({
  previousState: clearState,
  proposedState: collidingState,
  manifest: singleObstacleManifest,
  equipmentId: "standup-tug",
  inspectionActive: true,
  parkedAircraftPose: { x: 100, z: 100, yaw: 0 },
});
assert.equal(tugCollision?.body, "tug");
assert.equal(tugCollision?.label, "A1 jetway");
assert.equal(tugCollision?.authority, AIRPORT_COLLISION_AUTHORITY);

const resolvedTug = resolveAirportCollisionState(clearState, collidingState, false);
assert.equal(resolvedTug.tugX, clearState.tugX);
assert.equal(resolvedTug.tugZ, clearState.tugZ);
assert.equal(resolvedTug.speed, 0);

const movingOutPrevious = { ...clearState, tugX: 0, tugZ: 8 };
const movingOutNext = { ...clearState, tugX: 0, tugZ: -3.5 };
assert.equal(findAirportCollision({
  previousState: movingOutPrevious,
  proposedState: movingOutNext,
  manifest: singleObstacleManifest,
  equipmentId: "standup-tug",
  inspectionActive: true,
  parkedAircraftPose: { x: 100, z: 100, yaw: 0 },
}), null, "a vehicle already inside a proxy must be allowed to move out");

const parkedAircraftCollision = findAirportCollision({
  previousState: { ...clearState, tugX: 0, tugZ: -8 },
  proposedState: { ...clearState, tugX: 0, tugZ: -4.1 },
  manifest: { authority: "empty", obstacleCount: 0, obstacles: [] },
  equipmentId: "standup-tug",
  inspectionActive: true,
  parkedAircraftPose: { x: 0, z: 0, yaw: 0 },
});
assert.equal(parkedAircraftCollision?.label, "parked CRJ700");

const aircraftPrevious = {
  ...clearState,
  tugX: 80,
  tugZ: 80,
  aircraftX: 20,
  aircraftZ: -35,
};
const aircraftProposed = {
  ...aircraftPrevious,
  aircraftX: 0,
  aircraftZ: -10,
};
const aircraftCollision = findAirportCollision({
  previousState: aircraftPrevious,
  proposedState: aircraftProposed,
  manifest: singleObstacleManifest,
  equipmentId: "lektro-88",
  towing: true,
});
assert.equal(aircraftCollision?.body, "aircraft");

const resolvedTow = resolveAirportCollisionState(aircraftPrevious, aircraftProposed, true);
assert.equal(resolvedTow.aircraftX, aircraftPrevious.aircraftX);
assert.equal(resolvedTow.aircraftZ, aircraftPrevious.aircraftZ);
assert.equal(resolvedTow.tugX, aircraftPrevious.tugX);
assert.equal(resolvedTow.speed, 0);

console.log(JSON.stringify({
  authority: AIRPORT_COLLISION_AUTHORITY,
  manifestAuthority: manifest.authority,
  obstacleCount: manifest.obstacleCount,
  tugCollision: tugCollision.label,
  aircraftCollision: aircraftCollision.label,
  parkedAircraftCollision: parkedAircraftCollision.label,
}, null, 2));
