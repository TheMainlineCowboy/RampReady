import { groundA1TunnelCVisibleSupportHardwareV3 as groundV11 } from "./a1TunnelCVisibleSupportGroundingV11.js";

const REGION = Object.freeze({ minX: -13.8, maxX: -10.8, minY: 0.45, maxY: 3.15, minZ: 8.8, maxZ: 10.9 });
const NAMES = Object.freeze(["Tunnel_B_Jetway_0", "Tunnel_C_Jetway_0"]);
const PHOTO_GROUND_NAMES = Object.freeze(["PHX_KPHX_SourceAuthoredPhotoGround_Tiled", "PHX_KPHX_SourceAuthoredPhotoGround"]);
const KEY_SCALE = 10000;
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
export function groundA1TunnelCVisibleSupportHardwareV3(THREE,model){
  const base=groundV11(THREE,model);const root=sceneRoot(model),g=ground(root);root.updateWorldMatrix?.(true,true);model.updateWorldMatrix(true,true);const findings=[];
  for(const name of NAMES){
    const mesh=model?.getObjectByName?.(name);if(!mesh?.isMesh)continue;mesh.updateWorldMatrix(true,false);
    const geom=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;const pos=geom.getAttribute("position");if(!pos||pos.count%3!==0)continue;
    const selected=selectRegionTriangles(THREE,mesh,pos);
    for(const group of clusterSelected(selected)){
      const box=new THREE.Box3();for(const item of group)box.union(item.box);const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      const gy=groundY(THREE,g,center.x,center.z,box.max.y),clear=Number.isFinite(gy)?box.min.y-gy:null;
      findings.push({mesh:name,tris:group.length,min:box.min.toArray().map(v=>+v.toFixed(4)),max:box.max.toArray().map(v=>+v.toFixed(4)),size:size.toArray().map(v=>+v.toFixed(4)),center:center.toArray().map(v=>+v.toFixed(4)),clearance:clear===null?null:+clear.toFixed(4)});
    }
  }
  findings.sort((a,b)=>(b.clearance??-999)-(a.clearance??-999)||b.tris-a.tris);const concise=findings.slice(0,80);
  console.error(`A1 V13 ACTUAL CONNECTED SUPPORT COMPONENTS ${JSON.stringify(concise)}`);
  model.userData.a1V13ActualConnectedSupportComponents=concise;
  return Object.freeze({...base,v13ActualConnectedSupportComponentCount:concise.length});
}
export { A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY, A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY } from "./a1TunnelCVisibleSupportGroundingV5.js";
