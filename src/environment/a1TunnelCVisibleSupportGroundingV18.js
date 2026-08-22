import { groundA1TunnelCVisibleSupportHardwareV3 as groundV17 } from "./a1TunnelCVisibleSupportGroundingV17.js";

const GROUND_NAMES = ["PHX_KPHX_SourceAuthoredPhotoGround_Tiled", "PHX_KPHX_SourceAuthoredPhotoGround"];
const MESH_NAMES = ["Tunnel_B_Jetway_0", "Tunnel_C_Jetway_0"];
const REGION = { minX: -16, maxX: -8, minY: -0.5, maxY: 5.5, minZ: 5, maxZ: 18 };
function rootOf(o){let r=o;while(r?.parent)r=r.parent;return r;}
function groundOf(root){for(const n of GROUND_NAMES){const g=root?.getObjectByName?.(n);if(g)return g;}throw new Error("A1 V18 no rendered pavement");}
function groundY(THREE,g,x,z,y){const r=new THREE.Raycaster(new THREE.Vector3(x,y+40,z),new THREE.Vector3(0,-1,0));r.far=200;return r.intersectObject(g,true)[0]?.point?.y;}
function inRegion(p){return p.x>=REGION.minX&&p.x<=REGION.maxX&&p.y>=REGION.minY&&p.y<=REGION.maxY&&p.z>=REGION.minZ&&p.z<=REGION.maxZ;}
export function groundA1TunnelCVisibleSupportHardwareV3(THREE,model){
  groundV17(THREE,model);
  const root=rootOf(model),ground=groundOf(root),findings=[];
  root.updateWorldMatrix?.(true,true);model.updateWorldMatrix(true,true);
  for(const name of MESH_NAMES){
    const mesh=model?.getObjectByName?.(name);if(!mesh?.isMesh)continue;mesh.updateWorldMatrix(true,false);
    const geom=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),pos=geom.getAttribute("position"),l=new THREE.Vector3(),w=new THREE.Vector3();
    for(let t=0;t<pos.count/3;t++){
      const pts=[];for(let c=0;c<3;c++){l.fromBufferAttribute(pos,t*3+c);pts.push(w.copy(l).applyMatrix4(mesh.matrixWorld).clone());}
      const box=new THREE.Box3().setFromPoints(pts),center=box.getCenter(new THREE.Vector3());if(!inRegion(center))continue;
      const sx=box.max.x-box.min.x,sy=box.max.y-box.min.y,sz=box.max.z-box.min.z;
      if(sy<0.16||sx>0.28||sz>0.28)continue;
      const gy=groundY(THREE,ground,center.x,center.z,box.max.y);if(!Number.isFinite(gy))continue;const clear=box.min.y-gy;
      if(clear<=0.015||clear>1.8)continue;
      findings.push({mesh:name,triangle:t,clearance:+clear.toFixed(4),center:[+center.x.toFixed(4),+center.z.toFixed(4)],minY:+box.min.y.toFixed(4),maxY:+box.max.y.toFixed(4),size:[+sx.toFixed(4),+sy.toFixed(4),+sz.toFixed(4)]});
    }
  }
  findings.sort((a,b)=>b.clearance-a.clearance||b.size[1]-a.size[1]);
  throw new Error(`A1 V18 POST-V17 VERTICAL FACE DIAGNOSTIC ${JSON.stringify(findings.slice(0,80))}`);
}
export { A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY, A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY } from "./a1TunnelCVisibleSupportGroundingV5.js";
