import * as THREE_NS from "three";
import { kphxWedToRampReadyPosition } from "./sourceAuthority.js";
import { buildXp11Type2Facade } from "./xp11Type2Facade.js";
import {
  installA1ExactAutoGateController,
  installExactStockAutoGateController,
} from "./a1ExactAutoGateController.js";
import { resolveExactStockJetwayRig } from "./stockJetwayRigAuthority.js";
import { selectExactStockJetwayMotionReference } from "./stockJetwayMotionAuthority.js";

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


function restoreExactStaticPrefixTunnelShells(root, wallEvidence, gate) {
  const tunnelIndex = wallEvidence.findIndex((entry) =>
    String(entry.wallName || "").startsWith("Tunnel_"));
  if (tunnelIndex < 0 || wallEvidence[tunnelIndex + 1]?.wallName !== "Cabin") {
    throw new Error(`${gate} exact static-prefix shell restore could not resolve tunnel > Cabin`);
  }

  const fixedEvidence = wallEvidence.slice(0, tunnelIndex);
  const allowedFixed = new Set([
    "Rotunda_extension",
    "Rotunda_jetway",
    "Connection",
  ]);
  const invalid = fixedEvidence.filter((entry) => !allowedFixed.has(entry.wallName));
  if (invalid.length) {
    throw new Error(
      `${gate} static-prefix shell restore found unsupported walls: ${invalid.map((entry) => entry.wallName).join(", ")}`,
    );
  }

  // Segment 4/5/6 are the authored enclosed 1.5/3/6 m tunnel-shell templates
  // used inside all three fixed-prefix wall types. Keep the thin placement /
  // end-cap templates hidden; restore only these exact 3D shells. Short fixed
  // walls may legitimately choose a spelling with no 4/5/6 segment.
  const exactStaticShellName = /^FacadeMesh_(4|5|6)_/;
  const restored = [];
  for (const entry of fixedEvidence) {
    const wall = root.getObjectByName(`Wall_${entry.wallNumber}_${entry.wallName}`);
    if (!wall) {
      throw new Error(`${gate} exact fixed wall is missing Wall_${entry.wallNumber}_${entry.wallName}`);
    }
    wall.traverse((node) => {
      if (!node.isMesh || !exactStaticShellName.test(node.name || "")) return;
      node.visible = true;
      node.userData.kphxStockJetwayFacadePlaneHidden = false;
      node.userData.kphxExactStaticPrefixTunnelShellRestored = true;
      restored.push(`${wall.name}/${node.name}`);
    });
  }

  root.userData.kphxExactStaticPrefixWallCount = fixedEvidence.length;
  root.userData.kphxExactStaticPrefixTunnelShellCount = restored.length;
  root.userData.kphxExactStaticPrefixTunnelShells = restored.join("|");
  root.userData.kphxExactStaticPrefixTunnelAuthority =
    "XP11-Jetway_1_solid.fac-Segment-4-5-6-on-WED-authored-static-prefix-v2";

  // Preserve the already-established A1 runtime evidence names while A1
  // remains the visual regression reference.
  if (gate === "A1") {
    if (!restored.length) {
      throw new Error("A1 exact static terminal-side tunnel shells were not found");
    }
    root.userData.a1ExactStaticRotundaTunnelShellCount = restored.length;
    root.userData.a1ExactStaticRotundaTunnelShells = restored.join("|");
    root.userData.a1ExactStaticRotundaTunnelAuthority =
      root.userData.kphxExactStaticPrefixTunnelAuthority;
  }

  return Object.freeze({
    fixedWallCount: fixedEvidence.length,
    restoredShellCount: restored.length,
    restored: Object.freeze([...restored]),
  });
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
  const controllerFactories = new Map();
  const controllers = new Map();
  const controllerKeyByRampWedObjectId = new Map();
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

    // Restore the exact fixed-prefix shell geometry for every authored T4
    // placement before any articulation is installed. This is source-driven
    // by the gate's own WED wall sequence and changes visibility only on exact
    // Segment 4/5/6 shell meshes.
    const staticShellEvidence = restoreExactStaticPrefixTunnelShells(
      built.root,
      built.wallEvidence,
      gateMap.gate,
    );

    // Resolve every placement against its own authored WED/facade hierarchy
    // now, but install the expensive split/articulation controller lazily.
    // This proves the same generic binder can understand all 76 placements
    // without cloning support/stair geometry for 75 background jetways.
    const resolvedRig = resolveExactStockJetwayRig({
      root: built.root,
      footprint,
      wallEvidence: built.wallEvidence,
      gateMap,
    });
    const motionSelection = selectExactStockJetwayMotionReference({
      rig: resolvedRig,
      footprint,
      gateMap,
    });
    const controllerKey = String(gateMap.facadeWedObjectId);
    if (controllerFactories.has(controllerKey)) {
      throw new Error(`Duplicate T4 jetway facade controller key ${controllerKey}`);
    }
    controllerKeyByRampWedObjectId.set(
      String(gateMap.rampWedObjectId),
      controllerKey,
    );

    const installController = () => {
      const existing = controllers.get(controllerKey);
      if (existing) return existing;

      const controller = gateMap.gate === "A1"
        ? installA1ExactAutoGateController({
          THREE,
          root: built.root,
          footprint,
          wallEvidence: built.wallEvidence,
          gateMap,
        })
        : installExactStockAutoGateController({
          THREE,
          root: built.root,
          footprint,
          wallEvidence: built.wallEvidence,
          gateMap,
          initialDeployment: 0,
          enforceA1Reference: false,
        });

      controllers.set(controllerKey, controller);
      built.root.userData.stockAutoGateControllerInstalled = true;
      built.root.userData.stockAutoGateControllerKey = controllerKey;
      return controller;
    };

    controllerFactories.set(controllerKey, installController);
    built.root.userData.stockAutoGateControllerKey = controllerKey;
    built.root.userData.stockAutoGateControllerInstalled = false;
    built.root.userData.stockAutoGateRigAuthority = resolvedRig.authority;
    built.root.userData.stockAutoGateTunnelFamily =
      resolvedRig.tunnelFamily.family;
    built.root.userData.stockAutoGateMotionProfileId =
      motionSelection.profile.id;
    built.root.userData.stockAutoGateMotionSourceProfileId =
      motionSelection.sourceProfileId;
    built.root.userData.stockAutoGateAuthoredHingeTurnDegrees =
      motionSelection.rawTurnDegrees;
    built.root.userData.stockAutoGateEffectiveHingeTurnDegrees =
      motionSelection.effectiveTurnDegrees;

    if (gateMap.gate === "A1") {
      a1Controller = installController();
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
      staticPrefixWallCount: staticShellEvidence.fixedWallCount,
      restoredStaticShellCount: staticShellEvidence.restoredShellCount,
      tunnelFamily: resolvedRig.tunnelFamily.family,
      motionProfileId: motionSelection.profile.id,
      motionSourceProfileId: motionSelection.sourceProfileId,
      authoredHingeTurnDegrees: motionSelection.rawTurnDegrees,
      effectiveHingeTurnDegrees: motionSelection.effectiveTurnDegrees,
      authoredBridgeReachMeters: motionSelection.reachMeters,
      controllerKey,
      controllerInstalled: gateMap.gate === "A1",
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
  layer.userData.stockAutoGateResolvedPlacementCount = evidence.length;
  layer.userData.stockAutoGateLazyFactoryCount = controllerFactories.size;
  layer.userData.stockAutoGateInstalledControllerCount = controllers.size;
  layer.userData.stockAutoGateControllerPolicy =
    "source-resolved-all-76-lazy-install-nonactive-gates-v1";

  const getControllerByFacadeWedObjectId = (
    facadeWedObjectId,
    { install = true } = {},
  ) => {
    const key = String(facadeWedObjectId);
    if (controllers.has(key)) return controllers.get(key);
    if (!install) return null;
    const factory = controllerFactories.get(key);
    if (!factory) {
      throw new Error(
        `No T4 stock jetway controller factory for facade ${facadeWedObjectId}`,
      );
    }
    const controller = factory();
    layer.userData.stockAutoGateInstalledControllerCount = controllers.size;
    return controller;
  };

  const getControllerByRampWedObjectId = (
    rampWedObjectId,
    options,
  ) => {
    const controllerKey = controllerKeyByRampWedObjectId.get(
      String(rampWedObjectId),
    );
    if (!controllerKey) {
      throw new Error(
        `No T4 stock jetway controller factory for ramp ${rampWedObjectId}`,
      );
    }
    return getControllerByFacadeWedObjectId(controllerKey, options);
  };

  environment.add(layer);

  return {
    layer,
    evidence,
    wed,
    map,
    stockManifest,
    a1Controller,
    controllerFactories,
    controllers,
    getControllerByFacadeWedObjectId,
    getControllerByRampWedObjectId,
  };
}
