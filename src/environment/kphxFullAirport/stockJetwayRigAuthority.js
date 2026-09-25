const STATIC_PREFIX_WALLS = new Set([
  "Rotunda_extension",
  "Rotunda_jetway",
  "Connection",
]);

const TUNNEL_SEGMENT_FAMILIES = Object.freeze({
  "10:11": Object.freeze({
    terminalSegment: 10,
    aircraftSegment: 11,
    terminalObject: "jw_tunnel_2_5a.obj",
    aircraftObject: "jw_tunnel_2_5b.obj",
    family: "5m",
  }),
  "12:13": Object.freeze({
    terminalSegment: 12,
    aircraftSegment: 13,
    terminalObject: "jw_tunnel_2_7a.obj",
    aircraftObject: "jw_tunnel_2_7b.obj",
    family: "7m",
  }),
  "14:15": Object.freeze({
    terminalSegment: 14,
    aircraftSegment: 15,
    terminalObject: "jw_tunnel_2_9a.obj",
    aircraftObject: "jw_tunnel_2_9b.obj",
    family: "9m",
  }),
  "16:17": Object.freeze({
    terminalSegment: 16,
    aircraftSegment: 17,
    terminalObject: "jw_tunnel_2_11a.obj",
    aircraftObject: "jw_tunnel_2_11b.obj",
    family: "11m",
  }),
  "18:19": Object.freeze({
    terminalSegment: 18,
    aircraftSegment: 19,
    terminalObject: "jw_tunnel_2_13a.obj",
    aircraftObject: "jw_tunnel_2_13b.obj",
    family: "13m",
  }),
});

function requireObject(root, name, gate) {
  const object = root.getObjectByName(name);
  if (!object) {
    throw new Error(`${gate} exact stock jetway rig is missing ${name}`);
  }
  return object;
}

export function resolveExactStockJetwayRig({
  root,
  footprint,
  wallEvidence,
  gateMap,
}) {
  if (!root?.isObject3D) throw new Error("Exact stock jetway root is required");
  if (!Array.isArray(footprint) || !Array.isArray(wallEvidence)) {
    throw new Error("Exact stock jetway footprint/wall evidence is required");
  }
  const gate = String(gateMap?.gate || "UNKNOWN");
  if (footprint.length !== wallEvidence.length + 1) {
    throw new Error(
      `${gate} open facade path mismatch footprint=${footprint.length} walls=${wallEvidence.length}`,
    );
  }

  const tunnelWalls = wallEvidence.filter((entry) =>
    String(entry.wallName || "").startsWith("Tunnel_"));
  if (tunnelWalls.length !== 1) {
    throw new Error(
      `${gate} expected exactly one authored tunnel wall, found ${tunnelWalls.length}`,
    );
  }
  const tunnelEvidence = tunnelWalls[0];
  const tunnelArrayIndex = wallEvidence.indexOf(tunnelEvidence);
  const cabinEvidence = wallEvidence[tunnelArrayIndex + 1];
  if (cabinEvidence?.wallName !== "Cabin" || tunnelArrayIndex !== wallEvidence.length - 2) {
    throw new Error(
      `${gate} must resolve as static-prefix > tunnel > Cabin; got ${wallEvidence.map((entry) => entry.wallName).join(" > ")}`,
    );
  }

  const fixedEvidence = wallEvidence.slice(0, tunnelArrayIndex);
  const invalidFixed = fixedEvidence.filter(
    (entry) => !STATIC_PREFIX_WALLS.has(entry.wallName),
  );
  if (invalidFixed.length) {
    throw new Error(
      `${gate} has unsupported fixed-prefix walls: ${invalidFixed.map((entry) => entry.wallName).join(", ")}`,
    );
  }

  const spelling = tunnelEvidence.spelling || [];
  if (spelling.length < 2) {
    throw new Error(`${gate} tunnel wall has incomplete facade spelling`);
  }
  const terminalSegment = spelling[0];
  const aircraftSegment = spelling.at(-1);
  const familyKey = `${terminalSegment}:${aircraftSegment}`;
  const tunnelFamily = TUNNEL_SEGMENT_FAMILIES[familyKey];
  if (!tunnelFamily) {
    throw new Error(
      `${gate} tunnel spelling ${spelling.join(",")} does not resolve to a stock tunnel family`,
    );
  }

  const fixedWalls = fixedEvidence.map((entry) =>
    requireObject(root, `Wall_${entry.wallNumber}_${entry.wallName}`, gate));
  const tunnelWall = requireObject(
    root,
    `Wall_${tunnelEvidence.wallNumber}_${tunnelEvidence.wallName}`,
    gate,
  );
  const cabinWall = requireObject(
    root,
    `Wall_${cabinEvidence.wallNumber}_Cabin`,
    gate,
  );

  const terminalTunnelSegment = requireObject(
    tunnelWall,
    `Segment_${terminalSegment}_0`,
    gate,
  );
  const aircraftTunnelSegment = requireObject(
    tunnelWall,
    `Segment_${aircraftSegment}_${spelling.length - 1}`,
    gate,
  );
  const terminalTunnelVisual = requireObject(
    terminalTunnelSegment,
    `Attached_${tunnelFamily.terminalObject}`,
    gate,
  );
  const aircraftTunnelVisual = requireObject(
    aircraftTunnelSegment,
    `Attached_${tunnelFamily.aircraftObject}`,
    gate,
  );
  const cabinHalfB = requireObject(
    aircraftTunnelSegment,
    "Attached_jw_cabin_1b.obj",
    gate,
  );
  const cabinHalfA = requireObject(
    cabinWall,
    "Attached_jw_cabin_1a.obj",
    gate,
  );

  const pivotFootprintIndex = tunnelEvidence.wallNumber - 1;
  const cabinJointFootprintIndex = cabinEvidence.wallNumber - 1;
  const pivot = footprint[pivotFootprintIndex];
  const cabinJoint = footprint[cabinJointFootprintIndex];
  if (!pivot || !cabinJoint) {
    throw new Error(`${gate} exact WED hinge/cabin footprint points are missing`);
  }

  return Object.freeze({
    authority:
      "KPHX-WED-open-path-static-prefix-tunnel-cabin-plus-XP11-stock-segment-family-v1",
    gate,
    fixedEvidence: Object.freeze([...fixedEvidence]),
    tunnelEvidence,
    cabinEvidence,
    fixedWalls: Object.freeze([...fixedWalls]),
    tunnelWall,
    cabinWall,
    terminalTunnelSegment,
    aircraftTunnelSegment,
    terminalTunnelVisual,
    aircraftTunnelVisual,
    terminalHingeAttachmentPivot: terminalTunnelVisual.parent,
    aircraftEntranceAttachmentPivot: aircraftTunnelVisual.parent,
    cabinHalfA,
    cabinHalfB,
    cabinHalfBAttachmentPivot: cabinHalfB.parent,
    pivot,
    cabinJoint,
    pivotFootprintIndex,
    cabinJointFootprintIndex,
    tunnelFamily,
    wallSequence: Object.freeze(wallEvidence.map((entry) => entry.wallName)),
  });
}

export const KPHX_STOCK_JETWAY_TUNNEL_SEGMENT_FAMILIES =
  TUNNEL_SEGMENT_FAMILIES;
