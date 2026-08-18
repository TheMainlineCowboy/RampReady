import { groundA1TunnelCVisibleSupportHardwareV3 as groundV11 } from "./a1TunnelCVisibleSupportGroundingV11.js";

const REGION = Object.freeze({ minX: -13.8, maxX: -10.8, minY: 0.45, maxY: 3.15, minZ: 8.8, maxZ: 10.9 });
const NAMES = Object.freeze(["Tunnel_B_Jetway_0", "Tunnel_C_Jetway_0"]);
const PHOTO_GROUND_NAMES = Object.freeze(["PHX_KPHX_SourceAuthoredPhotoGround_Tiled", "PHX_KPHX_SourceAuthoredPhotoGround"]);
const KEY_SCALE = 10000;
function sceneRoot(o){let r=o;while(r?.parent)r=r.parent;return r;}
function ground(root){for(const n of PHOTO_GROUND_NAMES){const g=root?.getObjectByName?.(n);if(g)return g;}throw new Error("A1 V13 no ground");}
function groundY(THREE,g,x,z,y){const r=new THREE.Raycaster(new THREE.Vector3(x,y+40,z),new THREE.Vector3(0,-1,0));r.far=200;return r.intersectObject(g,true)[0]?.point?.y;}
function key(v){return `${Math.round(v.x*KEY_SCALE)},${Math.round(v.y*KEY_SCALE)},${Math.round(v.z*KEY_SCALE)}`;}
function intersects(b){return b.max.x>=REGION.minX&&b.min.x<=REGION.maxX&&b.max.y>=REGION.minY&&b.min.y<=REGION.maxY&&b.max.z>=REGION.minZ&&b.min.z<=REGION.maxZ;}
function components(THREE,mesh,position){
  const count=position.count/3, parent=new Int32Array(count); for(let i=0;i<count;i++)parent[i]=i;
  const find=(x)=>{let r=x;while(parent[r]!==r)r=parent[r];while(parent[x]!==x){const n=parent[x];parent[x]=r;x=n;}return r;};
  const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  const seen=new Map(), local=new THREE.Vector3(), world=new THREE.Vector3();
  for(let t=0;t<count;t++)for(let c=0;c<3;c++){local.fromBufferAttribute(position,t*3+c);world.copy(local).applyMatrix4(mesh.matrixWorld);const k=key(world), prior=seen.get(k);if(prior===undefined)seen.set(k,t);else union(t,prior);}
  const groups=new Map(); for(let t=0;t<count;t++){const r=find(t);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(t);} return [...groups.values()];
}
function measure(THREE,mesh,position,tris){const b=new THREE.Box3(),local=new THREE.Vector3(),world=new THREE.Vector3();for(const t of tris)for(let c=0;c<3;c++){local.fromBufferAttribute(position,t*3+c);b.expandByPoint(world.copy(local).applyMatrix4(mesh.matrixWorld));}return b;}
export function groundA1TunnelCVisibleSupportHardwareV3(THREE,model){
  const base=groundV11(THREE,model); const root=sceneRoot(model),g=ground(root); root.updateWorldMatrix?.(true,true);model.updateWorldMatrix(true,true); const findings=[];
  for(const name of NAMES){const mesh=model?.getObjectByName?.(name);if(!mesh?.isMesh)continue;mesh.updateWorldMatrix(true,false);const geom=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;const pos=geom.getAttribute("position");for(const tris of components(THREE,mesh,pos)){const b=measure(THREE,mesh,pos,tris);if(!intersects(b))continue;const s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),gy=groundY(THREE,g,c.x,c.z,b.max.y),clear=Number.isFinite(gy)?b.min.y-gy:null;findings.push({mesh:name,tris:tris.length,min:b.min.toArray().map(v=>+v.toFixed(4)),max:b.max.toArray().map(v=>+v.toFixed(4)),size:s.toArray().map(v=>+v.toFixed(4)),center:c.toArray().map(v=>+v.toFixed(4)),clearance:clear===null?null:+clear.toFixed(4)});}}
  findings.sort((a,b)=>(b.clearance??-999)-(a.clearance??-999)||b.tris-a.tris);
  const concise=findings.slice(0,80);
  console.error(`A1 V13 ACTUAL CONNECTED SUPPORT COMPONENTS ${JSON.stringify(concise)}`);
  model.userData.a1V13ActualConnectedSupportComponents=concise;
  return Object.freeze({...base,v13ActualConnectedSupportComponentCount:concise.length});
}
export { A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY, A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY } from "./a1TunnelCVisibleSupportGroundingV5.js";
