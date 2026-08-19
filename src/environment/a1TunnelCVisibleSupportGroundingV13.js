import { groundA1TunnelCVisibleSupportHardwareV3 as groundV11 } from "./a1TunnelCVisibleSupportGroundingV11.js";

const REGION = Object.freeze({ minX: -13.8, maxX: -10.8, minY: 0.45, maxY: 3.15, minZ: 8.8, maxZ: 10.9 });
const NAMES = Object.freeze(["Tunnel_B_Jetway_0", "Tunnel_C_Jetway_0"]);
const PHOTO_GROUND_NAMES = Object.freeze(["PHX_KPHX_SourceAuthoredPhotoGround_Tiled", "PHX_KPHX_SourceAuthoredPhotoGround"]);
const KEY_SCALE = 10000;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_EXTENSION_METERS = 2.2;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
function sceneRoot(o){let r=o;while(r?.parent)r=r.parent;return r;}
function ground(root){for(const n of PHOTO_GROUND_NAMES){const g=root?.getObjectByName?.(n);if(g)return g;}throw new Error("A1 V13 no ground");}
function groundY(THREE,g,x,z,y){const r=new THREE.Raycaster(new THREE.Vector3(x,y+40,z),new THREE.Vector3(0,-1,0));r.far=200;return r.intersectObject(g,true)[0]?.point?.y;}
function key(v){return `${Math.round(v.x*KEY_SCALE)},${Math.round(v.y*KEY_SCALE)},${Math.round(v.z*KEY_SCALE)}`;}
function intersectsBox(b){return b.max.x>=REGION.minX&&b.min.x<=REGION.maxX&&b.max.y>=REGION.minY&&b.min.y<=REGION.maxY&&b.max.z>=REGION.minZ&&b.min.z<=REGION.maxZ;}
function selectRegionTriangles(THREE,mesh,position){
  const selected=[]; const local=new THREE.Vector3(), world=new THREE.Vector3();
  for(let t=0;t<position.count/3;t++){
    const box=new THREE.Box3(); const keys=[];
    for(let c=0;c<3;c++){local.fromBufferAttribute(position,t*3+c);world.copy(local).applyMatrix4(mesh.matrixWorld);box.expandByPoint(world);keys.push(key(world));}
    if(intersectsBox(box))selected.push({triangle:t,keys,box});
  }
  return selected;
}
function clusterSelected(selected){
  const n=selected.length,parent=new Int32Array(n);for(let i=0;i<n;i++)parent[i]=i;
  const find=(x)=>{let r=x;while(parent[r]!==r)r=parent[r];while(parent[x]!==x){const q=parent[x];parent[x]=r;x=q;}return r;};
  const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  const seen=new Map();for(let i=0;i<n;i++)for(const k of selected[i].keys){const prior=seen.get(k);if(prior===undefined)seen.set(k,i);else union(i,prior);}
  const groups=new Map();for(let i=0;i<n;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(selected[i]);}return [...groups.values()];
}
function candidate(group,box,clearance){
  const s=box.getSize({x:0,y:0,z:0});
  return clearance>MAX_FINAL_CLEARANCE_METERS&&clearance<=MAX_EXTENSION_METERS&&s.y>=0.30&&s.y<=2.7&&s.x<=0.65&&s.z<=0.9&&group.length>=8&&group.length<=180;
}
function stretchGroup(THREE,mesh,position,group,rampY){
  const before=new THREE.Box3();for(const item of group)before.union(item.box);const minY=before.min.y,maxY=before.max.y,height=maxY-minY,extension=minY-rampY;
  if(!(height>0.03)||!(extension>MAX_FINAL_CLEARANCE_METERS)||extension>MAX_EXTENSION_METERS)throw new Error(`A1 V13 invalid rod extension ${extension}`);
  const inverse=mesh.matrixWorld.clone().invert(),local=new THREE.Vector3(),world=new THREE.Vector3();
  const indices=new Set();for(const item of group)for(let c=0;c<3;c++)indices.add(item.triangle*3+c);
  for(const index of indices){local.fromBufferAttribute(position,index);world.copy(local).applyMatrix4(mesh.matrixWorld);const f=Math.max(0,Math.min(1,(world.y-minY)/height));world.y=rampY+f*(maxY-rampY);local.copy(world).applyMatrix4(inverse);position.setXYZ(index,local.x,local.y,local.z);}
  return {extension,beforeTopY:maxY};
}
export function groundA1TunnelCVisibleSupportHardwareV3(THREE,model){
  const base=groundV11(THREE,model),root=sceneRoot(model),g=ground(root);root.updateWorldMatrix?.(true,true);model.updateWorldMatrix(true,true);const corrections=[];
  for(const name of NAMES){
    const mesh=model?.getObjectByName?.(name);if(!mesh?.isMesh)continue;mesh.updateWorldMatrix(true,false);
    const geom=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();mesh.geometry=geom;const pos=geom.getAttribute("position");if(!pos||pos.count%3!==0)continue;
    for(const group of clusterSelected(selectRegionTriangles(THREE,mesh,pos))){const box=new THREE.Box3();for(const item of group)box.union(item.box);const center=box.getCenter(new THREE.Vector3()),gy=groundY(THREE,g,center.x,center.z,box.max.y),clear=Number.isFinite(gy)?box.min.y-gy:null;if(clear!==null&&candidate(group,box,clear)){const result=stretchGroup(THREE,mesh,pos,group,gy);corrections.push({mesh,name,group,rampY:gy,...result});}}
    pos.needsUpdate=true;geom.computeVertexNormals();geom.computeBoundingBox();geom.computeBoundingSphere();mesh.updateMatrixWorld(true);
  }
  model.updateWorldMatrix(true,true);let maxClear=base.maximumFinalClearanceMeters,maxDrift=base.maximumTopMountDriftMeters;
  for(const c of corrections){const pos=c.mesh.geometry.getAttribute("position"),box=new THREE.Box3(),local=new THREE.Vector3(),world=new THREE.Vector3();for(const item of c.group)for(let k=0;k<3;k++){local.fromBufferAttribute(pos,item.triangle*3+k);box.expandByPoint(world.copy(local).applyMatrix4(c.mesh.matrixWorld));}const center=box.getCenter(new THREE.Vector3()),gy=groundY(THREE,g,center.x,center.z,box.max.y),clear=box.min.y-gy,drift=Math.abs(box.max.y-c.beforeTopY);maxClear=Math.max(maxClear,Math.abs(clear));maxDrift=Math.max(maxDrift,drift);if(Math.abs(clear)>MAX_FINAL_CLEARANCE_METERS)throw new Error(`A1 V13 rod final clearance ${clear}`);if(drift>MAX_TOP_MOUNT_DRIFT_METERS)throw new Error(`A1 V13 rod top drift ${drift}`);}
  const findings=[];for(const name of NAMES){const mesh=model?.getObjectByName?.(name);if(!mesh?.isMesh)continue;mesh.updateWorldMatrix(true,false);const pos=mesh.geometry.getAttribute("position");for(const group of clusterSelected(selectRegionTriangles(THREE,mesh,pos))){const box=new THREE.Box3();for(const item of group)box.union(item.box);const center=box.getCenter(new THREE.Vector3()),gy=groundY(THREE,g,center.x,center.z,box.max.y),clear=Number.isFinite(gy)?box.min.y-gy:null;if(clear!==null&&candidate(group,box,clear))findings.push({mesh:name,tris:group.length,clearance:+clear.toFixed(4)});}}
  if(findings.length)throw new Error(`A1 V13 remaining suspended visible rods ${JSON.stringify(findings)}`);
  const extraTriangles=corrections.reduce((s,c)=>s+c.group.length,0),extra=corrections.length,correctedSupportSetCount=base.correctedSupportSetCount+extra;
  return Object.freeze({...base,secondaryMeshGroundedCount:base.secondaryMeshGroundedCount+extra,secondaryMeshGroundedTriangleCount:base.secondaryMeshGroundedTriangleCount+extraTriangles,spatialRodClusterCount:base.spatialRodClusterCount+extra,spatialRodTriangleCount:base.spatialRodTriangleCount+extraTriangles,spatialRodVertexCount:base.spatialRodVertexCount+extraTriangles*3,correctedSupportSetCount,visibleLoadLegCount:correctedSupportSetCount,remainingSuspendedSupportCount:0,maximumFinalClearanceMeters:maxClear,maximumTopMountDriftMeters:maxDrift,maximumExtensionMeters:Math.max(base.maximumExtensionMeters,...corrections.map(c=>c.extension)),rampReferenceComponentCount:correctedSupportSetCount,v13ConnectedRodGroundedCount:extra,v13ConnectedRodTriangleCount:extraTriangles});
}
export { A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY, A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY } from "./a1TunnelCVisibleSupportGroundingV5.js";
