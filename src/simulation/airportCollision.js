const AUTHORITY = "continuous-tug-aircraft-vs-supplied-jetway-terminal-collision-v45";
const EPSILON = 1e-6;

const CRJ700_FOOTPRINT = Object.freeze([
  { x: 0, z: -3.1, radius: 1.25 },
  { x: 0, z: 2.5, radius: 1.45 },
  { x: 0, z: 8.3, radius: 1.62 },
  { x: 0, z: 14.2, radius: 1.72 },
  { x: 0, z: 20.2, radius: 1.58 },
  { x: 0, z: 25.0, radius: 1.3 },
  { x: -7.8, z: 10.7, radius: 2.65 },
  { x: 7.8, z: 10.7, radius: 2.65 },
]);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function transformLocalPoint(x, z, pose) {
  const yaw = Number(pose?.yaw) || 0;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return {
    x: Number(pose?.x) + cosine * x + sine * z,
    z: Number(pose?.z) - sine * x + cosine * z,
  };
}

function tugLocalCircles(equipmentId) {
  return equipmentId === "standup-tug"
    ? [
      { x: 0, z: -0.72, radius: 0.82 },
      { x: 0, z: 0.72, radius: 0.82 },
    ]
    : [
      { x: 0, z: -1.65, radius: 1.12 },
      { x: 0, z: 0, radius: 1.14 },
      { x: 0, z: 1.65, radius: 1.12 },
    ];
}

function footprintCircles(localCircles, pose, scale = 1) {
  return localCircles.map((circle) => {
    const point = transformLocalPoint(circle.x * scale, circle.z * scale, pose);
    return {
      x: point.x,
      z: point.z,
      radius: circle.radius * scale,
    };
  });
}

function circleObbPenetration(circle, obstacle) {
  const yaw = Number(obstacle.yaw) || 0;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const dx = circle.x - Number(obstacle.centerX);
  const dz = circle.z - Number(obstacle.centerZ);
  const localX = cosine * dx - sine * dz;
  const localZ = sine * dx + cosine * dz;
  const halfWidth = Math.max(EPSILON, Number(obstacle.halfWidth) || 0);
  const halfLength = Math.max(EPSILON, Number(obstacle.halfLength) || 0);
  const closestX = clamp(localX, -halfWidth, halfWidth);
  const closestZ = clamp(localZ, -halfLength, halfLength);
  const outsideDistance = Math.hypot(localX - closestX, localZ - closestZ);

  if (Math.abs(localX) <= halfWidth && Math.abs(localZ) <= halfLength) {
    const depthToEdge = Math.min(halfWidth - Math.abs(localX), halfLength - Math.abs(localZ));
    return circle.radius + depthToEdge;
  }
  return circle.radius - outsideDistance;
}

function distanceToSegment(x, z, x1, z1, x2, z2) {
  const segmentX = x2 - x1;
  const segmentZ = z2 - z1;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  if (lengthSquared <= EPSILON) return Math.hypot(x - x1, z - z1);
  const projection = clamp(((x - x1) * segmentX + (z - z1) * segmentZ) / lengthSquared, 0, 1);
  return Math.hypot(x - (x1 + segmentX * projection), z - (z1 + segmentZ * projection));
}

function circleSegmentPenetration(circle, obstacle) {
  const distance = distanceToSegment(
    circle.x,
    circle.z,
    Number(obstacle.x1),
    Number(obstacle.z1),
    Number(obstacle.x2),
    Number(obstacle.z2),
  );
  return circle.radius + Math.max(0, Number(obstacle.radius) || 0) - distance;
}

function circleObstaclePenetration(circle, obstacle) {
  if (obstacle?.type === "obb") return circleObbPenetration(circle, obstacle);
  if (obstacle?.type === "segment") return circleSegmentPenetration(circle, obstacle);
  return Number.NEGATIVE_INFINITY;
}

function strongestObstacleHit(circles, obstacles) {
  let strongest = null;
  for (const obstacle of obstacles || []) {
    let penetration = Number.NEGATIVE_INFINITY;
    for (const circle of circles) penetration = Math.max(penetration, circleObstaclePenetration(circle, obstacle));
    if (penetration <= 0) continue;
    if (!strongest || penetration > strongest.penetration) strongest = { obstacle, penetration };
  }
  return strongest;
}

function penetrationAgainstObstacle(circles, obstacle) {
  let penetration = Number.NEGATIVE_INFINITY;
  for (const circle of circles) penetration = Math.max(penetration, circleObstaclePenetration(circle, obstacle));
  return penetration;
}

function circleCirclePenetration(left, right) {
  return left.radius + right.radius - Math.hypot(left.x - right.x, left.z - right.z);
}

function strongestCircleSetHit(movingCircles, fixedCircles, obstacle) {
  let penetration = Number.NEGATIVE_INFINITY;
  for (const moving of movingCircles) {
    for (const fixed of fixedCircles) penetration = Math.max(penetration, circleCirclePenetration(moving, fixed));
  }
  return penetration > 0 ? { obstacle, penetration } : null;
}

function isMovingOut(previousCircles, nextHit) {
  if (!nextHit) return false;
  const previousPenetration = penetrationAgainstObstacle(previousCircles, nextHit.obstacle);
  return previousPenetration > 0 && nextHit.penetration < previousPenetration - 0.002;
}

function poseFromState(state, body) {
  if (body === "aircraft") {
    return {
      x: Number(state.aircraftX) || 0,
      z: Number(state.aircraftZ) || 0,
      yaw: Number(state.aircraftYaw) || 0,
    };
  }
  return {
    x: Number(state.tugX) || 0,
    z: Number(state.tugZ) || 0,
    yaw: Number(state.tugYaw) || 0,
  };
}

export function findAirportCollision({
  previousState,
  proposedState,
  manifest,
  equipmentId = "lektro-88",
  inspectionActive = false,
  towing = false,
  parkedAircraftPose = null,
  aircraftScale = 0.82,
}) {
  const obstacles = manifest?.obstacles || [];
  if (!previousState || !proposedState || !obstacles.length) return null;

  const previousTug = footprintCircles(tugLocalCircles(equipmentId), poseFromState(previousState, "tug"));
  const proposedTug = footprintCircles(tugLocalCircles(equipmentId), poseFromState(proposedState, "tug"));
  const tugHit = strongestObstacleHit(proposedTug, obstacles);
  if (tugHit && !isMovingOut(previousTug, tugHit)) {
    return {
      body: "tug",
      label: tugHit.obstacle.label || tugHit.obstacle.kind || "airport object",
      obstacle: tugHit.obstacle,
      penetration: tugHit.penetration,
      authority: AUTHORITY,
    };
  }

  if (inspectionActive && parkedAircraftPose) {
    const parkedAircraft = footprintCircles(CRJ700_FOOTPRINT, parkedAircraftPose, aircraftScale);
    const parkedObstacle = { type: "circle-set", kind: "parked-aircraft", label: "parked CRJ700" };
    const parkedHit = strongestCircleSetHit(proposedTug, parkedAircraft, parkedObstacle);
    if (parkedHit) {
      const previousHit = strongestCircleSetHit(previousTug, parkedAircraft, parkedObstacle);
      const movingOut = previousHit && parkedHit.penetration < previousHit.penetration - 0.002;
      if (!movingOut) {
        return {
          body: "tug",
          label: parkedObstacle.label,
          obstacle: parkedObstacle,
          penetration: parkedHit.penetration,
          authority: AUTHORITY,
        };
      }
    }
  }

  if (towing) {
    const previousAircraft = footprintCircles(CRJ700_FOOTPRINT, poseFromState(previousState, "aircraft"), aircraftScale);
    const proposedAircraft = footprintCircles(CRJ700_FOOTPRINT, poseFromState(proposedState, "aircraft"), aircraftScale);
    const aircraftHit = strongestObstacleHit(proposedAircraft, obstacles);
    if (aircraftHit && !isMovingOut(previousAircraft, aircraftHit)) {
      return {
        body: "aircraft",
        label: aircraftHit.obstacle.label || aircraftHit.obstacle.kind || "airport object",
        obstacle: aircraftHit.obstacle,
        penetration: aircraftHit.penetration,
        authority: AUTHORITY,
      };
    }
  }

  return null;
}

export function resolveAirportCollisionState(previousState, proposedState, towing = false) {
  const resolved = {
    ...proposedState,
    tugX: previousState.tugX,
    tugZ: previousState.tugZ,
    tugYaw: previousState.tugYaw,
    speed: 0,
  };
  if (towing) {
    resolved.aircraftX = previousState.aircraftX;
    resolved.aircraftZ = previousState.aircraftZ;
    resolved.aircraftYaw = previousState.aircraftYaw;
    resolved.articulation = previousState.articulation;
  }
  return resolved;
}

export {
  AUTHORITY as AIRPORT_COLLISION_AUTHORITY,
  CRJ700_FOOTPRINT as CRJ700_COLLISION_FOOTPRINT,
  circleObstaclePenetration,
  footprintCircles,
};
