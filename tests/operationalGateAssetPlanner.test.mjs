import test from "node:test";
import assert from "node:assert/strict";
import {
 RAMPREADY_OPERATIONAL_GATES,RAMPREADY_GATE_CATALOG,RAMPREADY_UNRESOLVED_GATES,
 getRampReadyOperationalGate,requireSourceVerifiedRampReadyGate
} from "../src/config/operationalGateCatalog.js";
import {
 planKphxOperationalGateCorridor,planKphxFreeDriveVicinity,
} from "../src/environment/kphxFullAirport/vicinityAssetPlanner.js";

test("operator-defined gate names and order are exact, including ambiguous suffixes",()=>{
 const expected=["A1","B2","B8","B10","B12","B14","B1","B1A","B3","B5",
 "B7","B9","B16","B18","B22","B24","B15B","B15A","B17","B19","B21"];
 assert.deepEqual(RAMPREADY_OPERATIONAL_GATES,expected);
 assert.equal(new Set(expected).size,21);
 assert.equal(RAMPREADY_GATE_CATALOG.length,21);
 assert.equal(getRampReadyOperationalGate("b2").gate,"B2");
 assert.deepEqual(RAMPREADY_UNRESOLVED_GATES,["B1","B1A","B15B","B15A","B21"]);
 for(const label of RAMPREADY_UNRESOLVED_GATES){
  assert.throws(()=>requireSourceVerifiedRampReadyGate(label),/no verified WED ramp location/);
 }
 assert.notEqual(requireSourceVerifiedRampReadyGate("A1").rampWedObjectId,null);
 assert.notEqual(requireSourceVerifiedRampReadyGate("B2").rampWedObjectId,null);
 assert.throws(()=>requireSourceVerifiedRampReadyGate("B1B"),/not in operator-approved/);
 assert.throws(()=>requireSourceVerifiedRampReadyGate("B15C"),/not in operator-approved/);
});

test("preload chosen gate/route and defer geographically unrelated assets without deletion",()=>{
 const a1=requireSourceVerifiedRampReadyGate("A1").pose;
 const b2=requireSourceVerifiedRampReadyGate("B2").pose;
 const b14=requireSourceVerifiedRampReadyGate("B14").pose;
 const placements=[
  {id:"a1",latitude:a1.latitude,longitude:a1.longitude,resource:"gate-a1",assetUrl:"/models/a1.gltf"},
  {id:"b2",latitude:b2.latitude,longitude:b2.longitude,resource:"gate-b2",assetUrl:"/models/b2.gltf"},
  {id:"b14",latitude:b14.latitude,longitude:b14.longitude,resource:"gate-b14",assetUrl:"/models/b14.gltf"},
 ];
 const plan=planKphxOperationalGateCorridor(placements,{gate:"A1",radiusMeters:15});
 assert.deepEqual(plan.loadedPlacements.map(x=>x.id),["a1"]);
 assert.deepEqual(plan.deferredPlacements.map(x=>x.id),["b2","b14"]);
 assert.equal(plan.allPlacementsAccountedFor,true);
 const free=planKphxFreeDriveVicinity(placements,{positionMeters:b2.runtimePosition,radiusMeters:15});
 assert.deepEqual(free.loadedPlacements.map(x=>x.id),["b2"]);
 const route=planKphxOperationalGateCorridor(placements,{gate:"A1",routeMeters:[b2.runtimePosition],radiusMeters:15});
 assert.ok(route.loadedPlacements.some(x=>x.id==="b2"));
 assert.ok(route.requiredAssetUrls.includes("/models/b2.gltf"));
 assert.equal(route.loadedPlacements.length+route.deferredPlacements.length,placements.length);
});

test("reject invalid and invented route/sector details",()=>{
 assert.throws(()=>planKphxOperationalGateCorridor([],{gate:"B15B",radiusMeters:15}),/no verified WED/);
 assert.throws(()=>planKphxFreeDriveVicinity([],{positionMeters:[0,0],radiusMeters:0}),/positive/);
 assert.throws(()=>planKphxFreeDriveVicinity([],{positionMeters:"fake",radiusMeters:30}),/measured RampReady/);
});
