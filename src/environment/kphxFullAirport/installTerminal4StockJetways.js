import * as THREE_NS from "three";
import { kphxWedToRampReadyPosition } from "./sourceAuthority.js";
import { buildXp11Type2Facade } from "./xp11Type2Facade.js";
import { installA1ExactAutoGateController } from "./a1ExactAutoGateController.js";

const RESOURCE = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";
const STOCK_BASE = "/models/xplane11-stock/jetway1";
const WED_URL = "/models/kphx/wed-jetways.exact.json";
const T4_MAP_URL = "/models/kphx/terminal4-wed-jetways.exact.json";
const EXPECTED_JETWAY_COUNT = 76;
const EXPECTED_WED_SHA256 = "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498";

function runtimeUrl(url) {
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  const clean = String(url).startsWith("/") ? url : `/${url}`;
  return base && base !== "/" ? `${base}${clean}` : clean;
}

function wallChoice(node) {
  const match = String(node.wallType || node.wall_type || "").match(/Wall\s+(\d+)/i);
  if (!match) throw new Error(`WED node ${node.wedObjectId} lost wall choice`);
  return Number(match[1]) - 1;
}

function sameSourceAuthority(wed, map) {
  return wed?.source?.sha256 === EXPECTED_WED_SHA256
    && map?.source?.sha256 === EXPECTED_WED_SHA256;
}


function restoreA1ExactStaticRotundaTunnelShells(root) {
  const restored = [];
  const fixedWalls = [1, 2, 3, 4].map((number) =>
    root.getObjectByName(`Wall_${number}_Rotunda_extension`));

  if (fixedWalls.some((wall) => !wall)) {
    throw new Error("A1 exact static Rotunda_extension walls are incomplete");
  }

  // XP11 Jetway_1_solid.fac uses Segment 4/5/6 as the actual 1.5 m,
  // 3.0 m, and 6.0 m enclosed static tunnel shells. The importer hides
  // facade meshes globally because many other segment meshes are only thin
  // WED/control planes. Restore ONLY these authored 3D shell templates on
  // A1's four terminal-side Rotunda_extension walls. Keep Segment 3/21/22
  // control/end planes hidden so the earlier blade-thin wall regression
  // does not return.
  const exactStaticShellName = /^FacadeMesh_(4|5|6)_/;
  for (const wall of fixedWalls) {
    wall.traverse((node) => {
      if (!node.isMesh || !exactStaticShellName.test(node.name || "")) return;
      node.visible = true;
      node.userData.kphxStockJetwayFacadePlaneHidden = false;
      node.userData.a1ExactStaticRotundaTunnelShellRestored = true;
      restored.push(node.name);
    });
  }

  if (!restored.length) {
    throw new Error("A1 exact static Rotunda tunnel shell meshes were not found");
  }

  root.userData.a1ExactStaticRotundaTunnelShellCount = restored.length;
  root.userData.a1ExactStaticRotundaTunnelShells = restored.join("|");
  root.userData.a1ExactStaticRotundaTunnelAuthority =
    "XP11-Jetway_1_solid.fac-Segment-4-5-6-on-WED-104804-fixed-Rotunda_extension";
  return restored;
}

export async function installKphxTerminal4StockJetways(
  THREE = THREE_NS,
  environment,
  { strict = true } = {},
) {
  if (!environment?.isObject3D) throw new Error("KPHX environment Object3D is required");

  const [facadeResponse, wedResponse, mapResponse, manifestResponse] = await Promise.all([
    fetch(runtimeUrl(`${STOCK_BASE}/jetway_1_solid.fac`), { cache: "no-store" }),
    fetch(runtimeUrl(WED_URL), { cache: "no-store" }),
    fetch(runtimeUrl(T4_MAP_URL), { cache: "no-store" }),
    fetch(runtimeUrl(`${STOCK_BASE}/manifest.json`), { cache: "no-store" }),
  ]);

  if (!facadeResponse.ok) throw new Error(`XP11 stock facade HTTP ${facadeResponse.status}`);
  if (!wedResponse.ok) throw new Error(`KPHX WED jetways HTTP ${wedResponse.status}`);
  if (!mapResponse.ok) throw new Error(`T4 jetway map HTTP ${mapResponse.status}`);
  if (!manifestResponse.ok) throw new Error(`XP11 stock manifest HTTP ${manifestResponse.status}`);

  const [facadeText, wed, map, stockManifest] = await Promise.all([
    facadeResponse.text(),
    wedResponse.json(),
    mapResponse.json(),
    manifestResponse.json(),
  ]);

  if (!sameSourceAuthority(wed, map)) {
    throw new Error("T4 jetway WED authority hash changed");
  }
  if (stockManifest.facade !== "jetway_1_solid.fac") {
    throw new Error(`Unexpected XP11 stock facade: ${stockManifest.facade}`);
  }
  if (stockManifest.files?.["jetway_1_solid.fac"]?.sha256 !== "a98a61b6de28a0db6548f748163494fc24513267dee40322502d5800eff8feb5") {
    throw new Error("XP11 stock jetway facade hash changed");
  }
  if (map.jetwayCount !== EXPECTED_JETWAY_COUNT || map.placements?.length !== EXPECTED_JETWAY_COUNT) {
    throw new Error(`Expected ${EXPECTED_JETWAY_COUNT} T4 jetways, mapped ${map.placements?.length ?? 0}`);
  }

  const wedById = new Map((wed.placements || []).map((entry) => [entry.wedObjectId, entry]));
  const layer = new THREE.Group();
  layer.name = "KPHX_T4_Exact_XP11_Stock_Jetways";

  const evidence = [];
  let totalEdges = 0;
  let a1Controller = null;

  for (const gateMap of map.placements) {
    const placement = wedById.get(gateMap.facadeWedObjectId);
    if (!placement) throw new Error(`Missing WED facade ${gateMap.facadeWedObjectId} for ${gateMap.gate}`);
    if (placement.resource !== RESOURCE) {
      throw new Error(`${gateMap.gate} resource changed: ${placement.resource}`);
    }
    if (Number(placement.height) !== 3) {
      throw new Error(`${gateMap.gate} facade height changed: ${placement.height}`);
    }
    if (placement.rings?.length !== 1) {
      throw new Error(`${gateMap.gate} expected one authored facade ring, found ${placement.rings?.length ?? 0}`);
    }

    const nodes = placement.rings[0]?.nodes || [];
    if (nodes.length !== gateMap.facadeNodeCount) {
      throw new Error(
        `${gateMap.gate} node count mismatch map=${gateMap.facadeNodeCount} WED=${nodes.length}`,
      );
    }

    const footprint = nodes.map((node) => {
      const [x, , z] = kphxWedToRampReadyPosition(
        Number(node.latitude),
        Number(node.longitude),
        0,
      );
      return new THREE.Vector2(x, z);
    });
    const wallChoices = nodes.map(wallChoice);

    const built = await buildXp11Type2Facade({
      facadeText,
      footprint,
      wallChoices,
      basePath: STOCK_BASE,
    });

    if (built.facade.ringMode !== 0) {
      throw new Error(`${gateMap.gate} stock facade is not RING 0`);
    }
    if (built.wallEvidence.length !== nodes.length - 1) {
      throw new Error(
        `${gateMap.gate} rendered edge count ${built.wallEvidence.length} does not match open path ${nodes.length - 1}`,
      );
    }

    built.root.name = `KPHX_${gateMap.gate}_FAC_${gateMap.facadeWedObjectId}_Exact_XP11_Stock_Jetway`;
    built.root.userData.gate = gateMap.gate;
    built.root.userData.rampWedObjectId = gateMap.rampWedObjectId;
    built.root.userData.facadeWedObjectId = gateMap.facadeWedObjectId;
    built.root.userData.sourceResource = RESOURCE;
    built.root.userData.sourceWedSha256 = EXPECTED_WED_SHA256;
    built.root.userData.oldAirportJetwayGlbUsed = false;

    if (gateMap.gate === "A1") {
      // Restore the exact XP11 static terminal-side tunnel shells before
      // installing the already-locked moving-bridge controller. This changes
      // visibility only on fixed Rotunda_extension Segment 4/5/6 meshes and
      // does not alter any A1 animation transform/hierarchy.
      restoreA1ExactStaticRotundaTunnelShells(built.root);

      a1Controller = installA1ExactAutoGateController({
        THREE,
        root: built.root,
        footprint,
        wallEvidence: built.wallEvidence,
        gateMap,
      });
      built.root.userData.a1ExactAutoGateControllerInstalled = true;
    }

    layer.add(built.root);

    totalEdges += built.wallEvidence.length;
    evidence.push({
      gate: gateMap.gate,
      rampWedObjectId: gateMap.rampWedObjectId,
      facadeWedObjectId: gateMap.facadeWedObjectId,
      nodeCount: nodes.length,
      renderedEdgeCount: built.wallEvidence.length,
      wallChoices: wallChoices.map((value) => value + 1),
      wallNames: built.wallEvidence.map((wall) => wall.wallName),
      ringMode: built.facade.ringMode,
    });
  }

  if (strict && layer.children.length !== EXPECTED_JETWAY_COUNT) {
    throw new Error(
      `T4 stock jetway layer incomplete: expected ${EXPECTED_JETWAY_COUNT}, loaded ${layer.children.length}`,
    );
  }

  layer.userData.sourceAuthority = "KPHX 1.75.1 earth.wed.xml + exact XP11 stock Jetway_1_solid.fac";
  layer.userData.sourceWedSha256 = EXPECTED_WED_SHA256;
  layer.userData.sourceFacadeSha256 = stockManifest.files["jetway_1_solid.fac"].sha256;
  layer.userData.jetwayCount = layer.children.length;
  layer.userData.authoredOpenEdgeCount = totalEdges;
  layer.userData.oldAirportJetwayGlbUsed = false;
  layer.userData.substitutionPolicy = "none";
  layer.userData.evidence = evidence;
  layer.userData.a1JetwayController = a1Controller;
  layer.userData.a1JetwayAnimationAuthority = a1Controller
    ? "exact-WED-104804-XP11-stock-facade-plus-MisterX-AutoGate-26m-horizontal-kinematics-v1"
    : "missing";
  layer.userData.a1JetwayAttachedLatMeters = a1Controller?.getAttachedLatMeters?.() ?? Number.NaN;
  layer.userData.a1JetwayMotionDurationMs = a1Controller?.getMotionDurationMs?.() ?? Number.NaN;
  layer.userData.a1JetwayVerticalResolved = a1Controller?.getDoorTargets?.().verticalResolved === true;
  layer.userData.a1JetwayFixedWallCount = 4;

  environment.add(layer);

  return {
    layer,
    evidence,
    wed,
    map,
    stockManifest,
    a1Controller,
  };
}
