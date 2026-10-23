// Gate/route/camera locality planning for KPHX assets, without moving,
// deleting, inventing, or changing the original WED placements.
// Keep a shared source asset catalog on the server and load only the object
// instances a selected-gate pushback or free-drive journey can encounter.
import {kphxWedToRampReadyPosition} from "./sourceAuthority.js";
import {requireSourceVerifiedRampReadyGate} from "../../config/operationalGateCatalog.js";

function horizontal(position){
  if(Array.isArray(position)){
    if(position.length===3)return [Number(position[0]),Number(position[2])];
    if(position.length===2)return [Number(position[0]),Number(position[1])];
  }
  if(position&&Number.isFinite(position.x)&&Number.isFinite(position.z))
    return [position.x,position.z];
  throw Error("Route or drive position must have measured RampReady x/z meters");
}
function squaredDistanceToSegment(point,start,end){
  const dx=end[0]-start[0],dz=end[1]-start[1];
  const length2=dx*dx+dz*dz;
  const t=length2>1e-10?Math.max(0,Math.min(1,
    ((point[0]-start[0])*dx+(point[1]-start[1])*dz)/length2)):0;
  const ex=point[0]-start[0]-t*dx,ez=point[1]-start[1]-t*dz;
  return ex*ex+ez*ez;
}
function withinPath(point,waypoints,radiusMeters){
  const r2=radiusMeters*radiusMeters;
  if(waypoints.length===1)return squaredDistanceToSegment(point,waypoints[0],waypoints[0])<=r2;
  return waypoints.some((v,i)=>i>0&&squaredDistanceToSegment(point,waypoints[i-1],v)<=r2);
}
export function planKphxVicinityInstances(placements,{
  pathMeters,
  visualRadiusMeters,
  extraRequiredResourceNames=[],
}){
  if(!Array.isArray(placements))throw Error("Expected source-authoritative placement list");
  if(!(Number.isFinite(visualRadiusMeters)&&visualRadiusMeters>0))throw Error("Select a positive visible/prefetch radius");
  const points=pathMeters.map(horizontal);
  if(points.length===0)throw Error("Need a real gate position or a measured driving path");
  const required=new Set(extraRequiredResourceNames);
  const included=[],outside=[],urlSet=new Set();
  for(const item of placements){
    if(!item.assetUrl)throw Error("Source placement has no asset URL: "+item.resource);
    const [x,,z]=kphxWedToRampReadyPosition(item.latitude,item.longitude,item.customMsl?item.mslMeters:0);
    const keep=required.has(item.resource)||withinPath([x,z],points,visualRadiusMeters);
    (keep?included:outside).push(item);
    if(keep)urlSet.add(item.assetUrl);
  }
  return Object.freeze({
    loadedPlacements:Object.freeze(included),
    deferredPlacements:Object.freeze(outside),
    requiredAssetUrls:Object.freeze([...urlSet].sort()),
    // No missing scenery: deferred assets remain eligible for a later sector.
    allPlacementsAccountedFor:included.length+outside.length===placements.length,
  });
}
export function planKphxOperationalGateCorridor(placements,{
  gate,routeMeters=[],radiusMeters,
}){
  const resolved=requireSourceVerifiedRampReadyGate(gate);
  const startingPoint=resolved.pose.runtimePosition;
  return planKphxVicinityInstances(placements,{
    pathMeters:[startingPoint,...routeMeters],
    visualRadiusMeters:radiusMeters,
  });
}
export function planKphxFreeDriveVicinity(placements,{
  positionMeters,upcomingRouteMeters=[],radiusMeters,
}){
  return planKphxVicinityInstances(placements,{
    pathMeters:[positionMeters,...upcomingRouteMeters],
    visualRadiusMeters:radiusMeters,
  });
}
