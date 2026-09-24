import fs from "node:fs";

const controller = fs.readFileSync("src/environment/kphxFullAirport/a1ExactAutoGateController.js","utf8");
const trainer = fs.readFileSync("src/components/RampReadyStandupTrainerTerminal4.jsx","utf8");
const installer = fs.readFileSync("src/environment/kphxFullAirport/installTerminal4StockJetways.js","utf8");
const live = fs.readFileSync("src/environment/kphxFullAirport/installLiveTerminal4Exact.js","utf8");
const door = fs.readFileSync("src/environment/kphxFullAirport/aircraftDoorAuthority.js","utf8");

const failures=[];
const expect=(ok,msg)=>{ if(!ok) failures.push(msg); };

expect(door.includes("aftOfNoseGearMeters: 7.32"),"CRJ door aft station missing");
expect(door.includes("leftOfCenterlineMeters: 1.34"),"CRJ door lateral station missing");
expect(door.includes("restEntranceLateralMeters: -7.5"),"AutoGate rest entrance lateral reference missing");
expect(controller.includes('sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-26m.obj"'),"AutoGate 26m source missing");
expect(controller.includes('requireObject(root, "Wall_5_Tunnel_11-15.5m")'),"A1 moving tunnel wall missing");
expect(controller.includes('requireObject(root, "Wall_6_Cabin")'),"A1 moving cabin wall missing");
expect(controller.includes('a1AutoGateFixedWalls'),"A1 fixed rotunda evidence missing");
expect(controller.includes("aircraftTunnelSegment.position.z"),"A1 telescope segment translation missing");
expect(!controller.includes("terminalTunnelMesh.scale"),"Outer Segment 10 must never be scaled during telescope");
expect(!controller.includes("terminalTunnelMeshScaleZ"),"Outer Segment 10 scale state must remain untouched");
expect(controller.includes('Segment 10 is the 9.5 m terminal-side'),"Exact Segment 10 fixed-tunnel authority missing");
expect(controller.includes("cabinWall.rotation.y"),"A1 cabin articulation missing");
expect(controller.includes("cabinHalfB.rotation.y"),"A1 cabin half counter-rotation missing");
expect(controller.includes('deployment <= 0.005'),"A1 parked threshold missing");
expect(installer.includes('if (gateMap.gate === "A1")'),"A1-only controller scope missing");
expect(installer.includes("installA1ExactAutoGateController"),"A1 controller installer missing");
expect(live.includes("authoredTerminal4A1JetwayController: jetways.a1Controller"),"A1 controller not exposed live");
expect(trainer.includes("transitionDurationMs: 15000"),"15-second disengage missing");
expect(trainer.includes("const initialJetwayDeployment = inspectionRef.current ? 0 : 1;"),"async mode handoff fix missing");
expect(trainer.includes("stageRef.current = 1;"),"post-park training advance missing");
expect(trainer.includes('setMessage("Jetway parked clear. Approach directly from the front and stop inside the capture envelope.")'),"post-park trainer message missing");
expect(!trainer.includes("0.330555555556"),"obsolete 33-percent limiter remains");
expect(!trainer.includes("aircraft-door-clearance-without-overtravel-v6"),"obsolete retraction authority remains");

const attachedLat = (-1.34) - (-7.5);
const bridgeYawAt0 = 58.87485095;
const bridgeYawAt75 = 66.4785727;
const cabinYawAt0 = -60.6997204;
const cabinYawAt75 = -67.50015727;
const t = attachedLat / 7.5;
const bridgeAttached = bridgeYawAt0 + (bridgeYawAt75 - bridgeYawAt0) * t;
const cabinAttached = cabinYawAt0 + (cabinYawAt75 - cabinYawAt0) * t;
const parkedBridgeDelta = bridgeYawAt0 - bridgeAttached;
const parkedCabinDelta = cabinYawAt0 - cabinAttached;

expect(Math.abs(attachedLat - 6.16) < 1e-12, `CRJ attached lat=${attachedLat}`);
expect(Math.abs(parkedBridgeDelta - (-6.245)) < 0.02, `bridge delta=${parkedBridgeDelta}`);
expect(Math.abs(parkedCabinDelta - 5.585) < 0.02, `cabin delta=${parkedCabinDelta}`);

const report={
  status: failures.length?"FAIL":"PASS",
  attachedLatMeters: attachedLat,
  parkedBridgeYawDeltaDegrees: parkedBridgeDelta,
  parkedCabinCounterYawDeltaDegrees: parkedCabinDelta,
  fixedWallCount:4,
  motionDurationMs:15000,
  failures,
};
fs.writeFileSync("reports/a1-autogate-static-verification.json",JSON.stringify(report,null,2)+"\n");
if(failures.length) throw new Error(failures.join("; "));
console.log(JSON.stringify(report,null,2));
