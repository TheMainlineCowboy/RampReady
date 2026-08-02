const AUTHORITY = "user-supplied-jetway-58-gate-obb-and-terminal-wall-collision-v45";

// Exact footprint measured from the decoded user-supplied Tunnel A/B/C,
// Rotunda and Cab payload after its committed runtime alignment transform.
const JETWAY_LOCAL_BOUNDS = Object.freeze({
  minX: -2.02390418,
  maxX: 2.3081912,
  minZ: -1.73707991,
  maxZ: 25.73142278,
});

const JETWAY_LOCAL_CENTER = Object.freeze({
  x: (JETWAY_LOCAL_BOUNDS.minX + JETWAY_LOCAL_BOUNDS.maxX) * 0.5,
  z: (JETWAY_LOCAL_BOUNDS.minZ + JETWAY_LOCAL_BOUNDS.maxZ) * 0.5,
});

const JETWAY_HALF_WIDTH = (JETWAY_LOCAL_BOUNDS.maxX - JETWAY_LOCAL_BOUNDS.minX) * 0.5 + 0.18;
const JETWAY_HALF_LENGTH = (JETWAY_LOCAL_BOUNDS.maxZ - JETWAY_LOCAL_BOUNDS.minZ) * 0.5 + 0.18;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function rotateLocalToWorld(localX, localZ, yaw) {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return {
    x: cosine * localX + sine * localZ,
    z: -sine * localX + cosine * localZ,
  };
}

function gateNumber(gate) {
  return Number(String(gate || "").replace(/^\D+/, "")) || 0;
}

function gateConcourse(gate) {
  return String(gate || "").match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "UNKNOWN";
}

function connectorFrame(placement) {
  const measuredLength = clamp(placement.wallConnectorLength || 1.25, 1.25, 18);
  const terminalOverlap = placement.gate === "A1" ? 1.45 : 0.55;
  const length = clamp(measuredLength + terminalOverlap, 1.8, 19.5);
  const towardX = Number(placement.connectorTowardX) || 0;
  const towardZ = Number(placement.connectorTowardZ) || 0;
  const magnitude = Math.hypot(towardX, towardZ) || 1;
  const ux = towardX / magnitude;
  const uz = towardZ / magnitude;
  return {
    length,
    ux,
    uz,
    terminalX: Number(placement.x) + ux * length,
    terminalZ: Number(placement.z) + uz * length,
  };
}

export function buildUploadedAirportJetwayCollisionManifest(placements) {
  if (!Array.isArray(placements) || placements.length !== 58) {
    throw new Error(`Jetway collision manifest expected 58 placements, received ${placements?.length ?? 0}`);
  }

  const obstacles = [];
  const terminalEndpoints = [];

  for (const placement of placements) {
    const yaw = Number(placement.yaw) || 0;
    const offset = rotateLocalToWorld(JETWAY_LOCAL_CENTER.x, JETWAY_LOCAL_CENTER.z, yaw);
    const gate = String(placement.gate);
    obstacles.push({
      type: "obb",
      kind: "supplied-jetway",
      gate,
      label: `${gate} jetway`,
      centerX: Number(placement.x) + offset.x,
      centerZ: Number(placement.z) + offset.z,
      yaw,
      halfWidth: JETWAY_HALF_WIDTH,
      halfLength: JETWAY_HALF_LENGTH,
    });

    const connector = connectorFrame(placement);
    obstacles.push({
      type: "segment",
      kind: "fixed-terminal-connector",
      gate,
      label: `${gate} fixed terminal connector`,
      x1: Number(placement.x),
      z1: Number(placement.z),
      x2: connector.terminalX,
      z2: connector.terminalZ,
      radius: 1.48,
    });
    terminalEndpoints.push({
      gate,
      concourse: gateConcourse(gate),
      number: gateNumber(gate),
      x: connector.terminalX,
      z: connector.terminalZ,
    });
  }

  const byConcourse = new Map();
  for (const endpoint of terminalEndpoints) {
    if (!byConcourse.has(endpoint.concourse)) byConcourse.set(endpoint.concourse, []);
    byConcourse.get(endpoint.concourse).push(endpoint);
  }

  for (const endpoints of byConcourse.values()) {
    endpoints.sort((left, right) => left.number - right.number);
    for (let index = 1; index < endpoints.length; index += 1) {
      const previous = endpoints[index - 1];
      const current = endpoints[index];
      const distance = Math.hypot(current.x - previous.x, current.z - previous.z);
      // Adjacent source gates outline the terminal wall. Large jumps indicate
      // a concourse break and must remain open for apron/taxiway travel.
      if (distance < 4 || distance > 46) continue;
      obstacles.push({
        type: "segment",
        kind: "terminal-wall",
        gate: `${previous.gate}-${current.gate}`,
        label: `Terminal wall between ${previous.gate} and ${current.gate}`,
        x1: previous.x,
        z1: previous.z,
        x2: current.x,
        z2: current.z,
        radius: 1.65,
      });
    }
  }

  return Object.freeze({
    authority: AUTHORITY,
    obstacleCount: obstacles.length,
    jetwayCount: placements.length,
    connectorCount: placements.length,
    obstacles: Object.freeze(obstacles.map((entry) => Object.freeze(entry))),
  });
}

export {
  AUTHORITY as UPLOADED_JETWAY_COLLISION_AUTHORITY,
  JETWAY_LOCAL_BOUNDS as UPLOADED_JETWAY_LOCAL_COLLISION_BOUNDS,
};
