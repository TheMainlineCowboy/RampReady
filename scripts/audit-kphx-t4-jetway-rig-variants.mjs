import fs from "node:fs";

const WED_PATH = "public/models/kphx/wed-jetways.exact.json";
const T4_PATH = "public/models/kphx/terminal4-wed-jetways.exact.json";
const FAC_PATH = "source/xplane11-stock/jetway-1-solid/Ramp_Equipment/jetways/jetway_1_solid.fac";
const REPORT_PATH = "reports/kphx-t4-jetway-rig-variants.json";
const EXPECTED_COUNT = 76;
const EXPECTED_WED_SHA256 = "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498";

const wed = JSON.parse(fs.readFileSync(WED_PATH, "utf8"));
const t4 = JSON.parse(fs.readFileSync(T4_PATH, "utf8"));
const facText = fs.readFileSync(FAC_PATH, "utf8");

if (wed?.source?.sha256 !== EXPECTED_WED_SHA256 || t4?.source?.sha256 !== EXPECTED_WED_SHA256) {
  throw new Error("KPHX WED authority hash changed");
}
if (t4?.placements?.length !== EXPECTED_COUNT) {
  throw new Error(`Expected ${EXPECTED_COUNT} T4 jetway placements, found ${t4?.placements?.length ?? 0}`);
}

const wallNames = facText
  .split(/\r?\n/)
  .filter((line) => line.startsWith("WALL "))
  .map((line) => {
    const parts = line.trim().split(/\s+/);
    return parts.at(-1);
  });

const wedById = new Map((wed.placements || []).map((entry) => [Number(entry.wedObjectId), entry]));
const variants = new Map();
const tunnelTypeCounts = new Map();
const prefixTokenCounts = new Map();
const placements = [];

for (const mapped of t4.placements) {
  const source = wedById.get(Number(mapped.facadeWedObjectId));
  if (!source) throw new Error(`Missing WED facade ${mapped.facadeWedObjectId} for ${mapped.gate}`);
  const nodes = source.rings?.[0]?.nodes || [];
  if (nodes.length !== mapped.facadeNodeCount) {
    throw new Error(`${mapped.gate} facade node count changed`);
  }

  // Jetway_1_solid.fac is RING 0, so the final WED node closes the authored
  // source path but does not create a rendered wall.
  const renderedNodes = nodes.slice(0, -1);
  const wallSequence = renderedNodes.map((node) => {
    const match = String(node.wallType || "").match(/Wall\s+(\d+)/i);
    if (!match) throw new Error(`WED node ${node.wedObjectId} lost wall choice`);
    const wallName = wallNames[Number(match[1]) - 1];
    if (!wallName) throw new Error(`Unknown facade wall ${node.wallType}`);
    return wallName;
  });

  const tunnelIndices = wallSequence
    .map((name, index) => (name.startsWith("Tunnel_") ? index : -1))
    .filter((index) => index >= 0);
  if (tunnelIndices.length !== 1) {
    throw new Error(`${mapped.gate} expected exactly one tunnel wall, found ${tunnelIndices.length}`);
  }
  const tunnelIndex = tunnelIndices[0];
  if (tunnelIndex !== wallSequence.length - 2 || wallSequence.at(-1) !== "Cabin") {
    throw new Error(`${mapped.gate} does not match static-prefix > tunnel > cabin invariant: ${wallSequence.join(" > ")}`);
  }

  const staticPrefix = wallSequence.slice(0, tunnelIndex);
  const invalidStatic = staticPrefix.filter(
    (name) => !["Rotunda_extension", "Rotunda_jetway", "Connection"].includes(name),
  );
  if (invalidStatic.length) {
    throw new Error(`${mapped.gate} has unsupported static-prefix walls: ${invalidStatic.join(", ")}`);
  }

  const tunnelWall = wallSequence[tunnelIndex];
  tunnelTypeCounts.set(tunnelWall, (tunnelTypeCounts.get(tunnelWall) || 0) + 1);
  for (const token of staticPrefix) {
    prefixTokenCounts.set(token, (prefixTokenCounts.get(token) || 0) + 1);
  }

  const signature = wallSequence.join(" > ");
  const list = variants.get(signature) || [];
  list.push(mapped.gate);
  variants.set(signature, list);

  placements.push({
    gate: mapped.gate,
    rampWedObjectId: mapped.rampWedObjectId,
    facadeWedObjectId: mapped.facadeWedObjectId,
    facadeNodeCount: mapped.facadeNodeCount,
    staticPrefix,
    tunnelWall,
    cabinWall: "Cabin",
    signature,
    bridgeEndMeters: mapped.bridgeEnd,
  });
}

const variantRows = [...variants.entries()]
  .map(([signature, gates]) => ({ signature, count: gates.length, gates }))
  .sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature));

const report = {
  schemaVersion: 1,
  status: "PASS",
  authority: {
    wedSha256: EXPECTED_WED_SHA256,
    facade: "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac",
    facadeSourcePath: FAC_PATH,
  },
  counts: {
    placementCount: placements.length,
    supportedGateNameCount: new Set(placements.map((entry) => entry.gate)).size,
    exactWallSequenceVariantCount: variantRows.length,
  },
  structuralInvariant: {
    value: "static-prefix > exactly-one-tunnel-wall > Cabin",
    staticPrefixWallTypes: ["Rotunda_extension", "Rotunda_jetway", "Connection"],
    appliesToAllPlacements: true,
    controllerImplication:
      "Discover authored tunnel/cabin from each built wallEvidence; do not hardcode gate-specific wall numbers or A1 node counts.",
  },
  tunnelWallTypeCounts: Object.fromEntries([...tunnelTypeCounts.entries()].sort()),
  staticPrefixTokenCounts: Object.fromEntries([...prefixTokenCounts.entries()].sort()),
  exactVariants: variantRows,
  placements,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
console.log(
  `PASS: ${placements.length} T4 placements, ${variantRows.length} exact signatures, one reusable structural invariant`,
);
