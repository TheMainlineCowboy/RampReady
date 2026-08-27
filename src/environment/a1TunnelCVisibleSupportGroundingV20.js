import { groundA1TunnelCVisibleSupportHardwareV3 as groundV19 } from "./a1TunnelCVisibleSupportGroundingV19.js";

const GROUND_NAMES=["PHX_KPHX_SourceAuthoredPhotoGround_Tiled","PHX_KPHX_SourceAuthoredPhotoGround"];
const TARGETS=[
 {name:"outboard-a",minX:-11.31,maxX:-11.20,minZ:10.04,maxZ:10.17,minHeight:.30},
 {name:"outboard-b",minX:-13.10,maxX:-13.00,minZ:10.27,maxZ:10.40,minHeight:.30},
 {name:"thin-a",minX:-11.86,maxX:-11.75,minZ:9.97,maxZ:10.17,minHeight:.08},
 {name:"thin-b",minX:-12.42,maxX:-12.31,minZ:10.03,maxZ:10.22,minHeight:.08},
];
const TOL=.015,MAX_EXT=2.2;
function rootOf(o){let r=o;while(r?.parent)r=r.parent;return r;}
function groundOf(root){for(const n of GROUND_NAMES){const g=root?.getObjectByName?.(n);if(g)return g;}throw new Error("A1 V20 no rendered pavement");}
function groundY(THREE,g,x,z,y){const r=new THREE.Raycaster(new THREE.Vector3(x,y+40,z),new THREE.Vector3(0,-1,0));r.far=200;const h=r.intersectObject(g,true)[0];if(!h?.point)throw new Error("A1 V20 pavement ray miss");return h.point.y;}
function tri(THREE,m,p,t){const l=new THREE.Vector3(),w=new THREE.Vector3(),a=[];for(let c=0;c<3;c++){l.fromBufferAttribute(p,t*3+c);a.push(w.copy(l).applyMatrix4(m.matrixWorld).clone());}return a;}
function idsFor(THREE,m,p,q){const ids=[];for(let t=0;t<p.count/3;t++){const b=new THREE.Box3().setFromPoints(tri(THREE,m,p,t)),c=b.getCenter(new THREE.Vector3());if(c.x>=q.minX&&c.x<=q.maxX&&c.z>=q.minZ&&c.z<=q.maxZ)ids.push(t);}return ids;}
function boxFor(THREE,m,p,ids){const b=new THREE.Box3();for(const t of ids)for(const v of tri(THREE,m,p,t))b.expandByPoint(v);return b;}
function stretch(THREE,m,p,ids,gy,q){if(!ids.length)return null;const b=boxFor(THREE,m,p,ids),h=b.max.y-b.min.y,ext=b.min.y-gy;if(!(h>q.minHeight&&h<1.5)||ext<=TOL||ext>MAX_EXT)return null;const inv=m.matrixWorld.clone().invert(),l=new THREE.Vector3(),w=new THREE.Vector3();for(const t of ids)for(let c=0;c<3;c++){const i=t*3+c;l.fromBufferAttribute(p,i);w.copy(l).applyMatrix4(m.matrixWorld);const f=Math.max(0,Math.min(1,(w.y-b.min.y)/h));w.y=gy+f*(b.max.y-gy);l.copy(w).applyMatrix4(inv);p.setXYZ(i,l.x,l.y,l.z);}return {ids,top:b.max.y,ext,q};}
export function groundA1TunnelCVisibleSupportHardwareV3(THREE,model){
 const base=groundV19(THREE,model),root=rootOf(model),g=groundOf(root),meshes=[];root.updateWorldMatrix?.(true,true);model.updateWorldMatrix(true,true);
 model.traverse?.(o=>{if(o?.isMesh&&o.name==="Tunnel_B_Jetway_0")meshes.push(o);});
 if(!meshes.length)throw new Error("A1 V20 no Tunnel_B meshes");
 let moved=0,tris=0,maxClear=base.maximumFinalClearanceMeters,maxDrift=base.maximumTopMountDriftMeters,maxExt=base.maximumExtensionMeters;
 for(const m of meshes){m.updateWorldMatrix(true,false);m.geometry=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();const p=m.geometry.getAttribute("position"),done=[];for(const q of TARGETS){const ids=idsFor(THREE,m,p,q);if(!ids.length)continue;const b=boxFor(THREE,m,p,ids),cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2,gy=groundY(THREE,g,cx,cz,b.max.y),d=stretch(THREE,m,p,ids,gy,q);if(d)done.push(d);}p.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingBox();m.geometry.computeBoundingSphere();m.updateMatrixWorld(true);for(const d of done){const b=boxFor(THREE,m,p,d.ids),cx=(d.q.minX+d.q.maxX)/2,cz=(d.q.minZ+d.q.maxZ)/2,gy=groundY(THREE,g,cx,cz,b.max.y),clear=b.min.y-gy,drift=Math.abs(b.max.y-d.top);if(Math.abs(clear)>TOL)throw new Error(`A1 V20 final clearance ${d.q.name} ${clear}`);if(drift>TOL)throw new Error(`A1 V20 top drift ${d.q.name} ${drift}`);maxClear=Math.max(maxClear,Math.abs(clear));maxDrift=Math.max(maxDrift,drift);maxExt=Math.max(maxExt,d.ext);moved++;tris+=d.ids.length;}}
 // Fail closed on every matching rendered instance: no diagnosed rod window may remain >1.5 cm above pavement.
 const remaining=[];for(const m of meshes){const p=m.geometry.getAttribute("position");for(const q of TARGETS){const ids=idsFor(THREE,m,p,q);if(!ids.length)continue;const b=boxFor(THREE,m,p,ids),cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2,gy=groundY(THREE,g,cx,cz,b.max.y),clear=b.min.y-gy;if(clear>TOL&&clear<=MAX_EXT)remaining.push({mesh:m.uuid,target:q.name,clearance:+clear.toFixed(4),triangles:ids.length});}}
 if(remaining.length)throw new Error(`A1 V20 remaining rendered rod instances ${JSON.stringify(remaining)}`);
 const count=base.correctedSupportSetCount+moved;model.userData.a1V20AllRenderedTunnelBRods=Object.freeze({meshInstanceCount:meshes.length,correctedSetCount:moved,triangleCount:tris,remaining:0});
 return Object.freeze({...base,correctedSupportSetCount:count,visibleLoadLegCount:count,remainingSuspendedSupportCount:0,maximumFinalClearanceMeters:maxClear,maximumTopMountDriftMeters:maxDrift,maximumExtensionMeters:maxExt,secondaryMeshGroundedCount:base.secondaryMeshGroundedCount+moved,secondaryMeshGroundedTriangleCount:base.secondaryMeshGroundedTriangleCount+tris,spatialRodClusterCount:base.spatialRodClusterCount+moved,spatialRodTriangleCount:base.spatialRodTriangleCount+tris,spatialRodVertexCount:base.spatialRodVertexCount+tris*3,rampReferenceComponentCount:count,v20RenderedTunnelBMeshCount:meshes.length,v20RenderedRodGroundedCount:moved,v20RenderedRodTriangleCount:tris});
}
export { A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY, A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY } from "./a1TunnelCVisibleSupportGroundingV5.js";
