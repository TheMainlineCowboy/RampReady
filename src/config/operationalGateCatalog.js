// Exact ordered operational gates supplied for RampReady. Do not substitute
// similar KPHX signage (B1B/B15C/B21A) for unresolved names without evidence.
import {getKphxTerminal4GatePoses} from "../environment/kphxFullAirport/terminal4GatePoseAuthority.js";

export const RAMPREADY_OPERATIONAL_GATES=Object.freeze([
  "A1","B2","B8","B10","B12","B14","B1","B1A","B3","B5","B7",
  "B9","B16","B18","B22","B24","B15B","B15A","B17","B19","B21",
]);

export const RAMPREADY_GATE_CATALOG=Object.freeze(RAMPREADY_OPERATIONAL_GATES.map(gate=>{
  const poses=getKphxTerminal4GatePoses(gate);
  if(poses.length>1)throw Error("Ambiguous WED gate "+gate+": "+poses.length+" positions");
  return Object.freeze({
    gate,
    status:poses.length===1?"source-verified":"needs-source-reconciliation",
    rampWedObjectId:poses[0]?.rampWedObjectId||null,
    // Unmodified WED-derived coordinates/headings; never guessed.
    pose:poses.length===1?poses[0]:null,
  });
}));

const byGate=new Map(RAMPREADY_GATE_CATALOG.map(x=>[x.gate,x]));
export function getRampReadyOperationalGate(gate){
  return byGate.get(String(gate||"").toUpperCase())||null;
}
export function requireSourceVerifiedRampReadyGate(gate){
  const item=getRampReadyOperationalGate(gate);
  if(!item)throw Error("Gate not in operator-approved RampReady list: "+gate);
  if(!item.pose)throw Error("Gate "+item.gate+" has no verified WED ramp location; cannot invent a spawn point");
  return item;
}
export const RAMPREADY_UNRESOLVED_GATES=Object.freeze(
  RAMPREADY_GATE_CATALOG.filter(x=>!x.pose).map(x=>x.gate)
);
