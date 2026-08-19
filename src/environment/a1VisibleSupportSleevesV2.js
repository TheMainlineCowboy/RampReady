const AUTHORITY = "a1-live-visible-support-lower-sleeves-to-rendered-pavement-v2";
const GROUND_NAMES = Object.freeze([
  "PHX_KPHX_AuthoredAirportWideGround",
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);
const REQUIRED_COUNT = 4;
const MAX_EXTENSION = 4.0;
const TOP_OVERLAP = 0.08;
const PAVEMENT_BURY = 0.08;
const MIN_DISTINCT_CENTER_METERS = 0.045;
const KEY_SCALE = 10000;

function rootOf(object) { let root = object; while (root?.parent) root = root.parent; return root; }
function groundOf(root) {
  for (const name of GROUND_NAMES) { const ground = root?.getObjectByName?.(name); if (ground) return ground; }
  throw new Error("A1 V3 support sleeves cannot resolve rendered KPHX pavement");
}
function groundYAt(THREE, ground, x, z, hint) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, Math.max(20, hint + 30), z), new THREE.Vector3(0, -1, 0), 0, 200);
  const hit = ray.intersectObject(ground, true)[0];
  if (!hit?.point) throw new Error(`A1 V3 support pavement ray miss ${x},${z}`);
  return hit.point.y;
}
function centerOf(THREE, object) {
  const box = object ? new THREE.Box3().setFromObject(object) : null;
  return box && !box.isEmpty() ? box.getCenter(new THREE.Vector3()) : null;
}
function vertexKey(position, index) {
  return `${Math.round(position.getX(index) * KEY_SCALE)},${Math.round(position.getY(index) * KEY_SCALE)},${Math.round(position.getZ(index) * KEY_SCALE)}`;
}
function components(mesh) {
  const position = mesh.geometry?.getAttribute?.("position"); if (!position) return [];
  const index = mesh.geometry.index; const count = Math.floor((index?.count ?? position.count) / 3);
  const parent = new Int32Array(count); for (let i=0;i<count;i++) parent[i]=i;
  const find = (x) => { let r=x; while(parent[r]!==r) r=parent[r]; while(parent[x]!==x){const n=parent[x];parent[x]=r;x=n;} return r; };
  const union = (a,b) => { a=find(a); b=find(b); if(a!==b) parent[b]=a; };
  const seen = new Map();
  for (let t=0;t<count;t++) for (let c=0;c<3;c++) {
    const pi=index?index.getX(t*3+c):t*3+c; const key=index?`i${pi}`:vertexKey(position,pi); const prior=seen.get(key);
    if(prior===undefined) seen.set(key,t); else union(t,prior);
  }
  const grouped=new Map(); for(let t=0;t<count;t++){const r=find(t);if(!grouped.has(r))grouped.set(r,[]);grouped.get(r).push(t);} return [...grouped.values()];
}
function boundsOf(THREE, mesh, triangles) {
  const position=mesh.geometry.getAttribute("position"), index=mesh.geometry.index, box=new THREE.Box3(), p=new THREE.Vector3();
  for(const t of triangles) for(let c=0;c<3;c++){const pi=index?index.getX(t*3+c):t*3+c;p.fromBufferAttribute(position,pi).applyMatrix4(mesh.matrixWorld);box.expandByPoint(p);} return box;
}
function bridgeLocation(center, rotunda, cab) {
  const axis=cab.clone().sub(rotunda).setY(0), lengthSq=axis.lengthSq(); if(lengthSq<1) return [NaN,NaN];
  const from=center.clone().sub(rotunda).setY(0), along=from.dot(axis)/lengthSq, projected=rotunda.clone().addScaledVector(axis,along);
  return [along, Math.hypot(center.x-projected.x,center.z-projected.z)];
}
function collectCandidates(THREE, model, ground) {
  const rotunda=centerOf(THREE,model.getObjectByName("Rotunda")), cab=centerOf(THREE,model.getObjectByName("Cab"));
  if(!rotunda||!cab) throw new Error("A1 V3 support sleeves cannot resolve Rotunda/Cab axis");
  const found=[];
  model.traverse((mesh)=>{
    if(!mesh?.isMesh||mesh.visible===false||!/(?:Tunnel_B|Tunnel_C)_Jetway_0/.test(mesh.name||"")) return;
    mesh.updateWorldMatrix(true,false);
    for(const tris of components(mesh)){
      if(tris.length<2||tris.length>700) continue;
      const box=boundsOf(THREE,mesh,tris); if(box.isEmpty()) continue;
      const size=box.getSize(new THREE.Vector3()), center=box.getCenter(new THREE.Vector3()), horizontal=Math.max(size.x,size.z);
      if(!(size.y>=0.18&&size.y<=3.5&&horizontal>=0.015&&horizontal<=0.48&&size.y/Math.max(horizontal,0.01)>=1.15)) continue;
      const [along,lateral]=bridgeLocation(center,rotunda,cab); if(!(Number.isFinite(along)&&along>=0.25&&along<=1.12&&lateral<=5.5)) continue;
      const rampY=groundYAt(THREE,ground,center.x,center.z,box.max.y), extension=box.min.y-rampY;
      if(!(extension>0.04&&extension<=MAX_EXTENSION)) continue;
      found.push({mesh,tris,box,size,center,along,lateral,rampY,extension,score:extension*20+size.y*2-lateral});
    }
  });
  found.sort((a,b)=>b.score-a.score);
  const selected=[];
  for(const candidate of found){
    if(selected.some((prior)=>Math.hypot(prior.center.x-candidate.center.x,prior.center.z-candidate.center.z)<MIN_DISTINCT_CENTER_METERS)) continue;
    selected.push(candidate); if(selected.length===REQUIRED_COUNT) break;
  }
  if(selected.length!==REQUIRED_COUNT) throw new Error(`A1 V3 support sleeves resolved ${selected.length}/${REQUIRED_COUNT} visible suspended members from ${found.length} candidates`);
  return selected;
}
function material(THREE){return new THREE.MeshStandardMaterial({name:"A1 visible lower support sleeve V3",color:0x24292c,roughness:0.82,metalness:0.3});}

export function addA1VisibleSupportSleevesToPavementV2(THREE, model) {
  if(!model?.isObject3D) throw new Error("A1 V3 support sleeves require final exact A1 model");
  const existing=model.getObjectByName?.("A1VisibleSupportSleevesToPavementV2"); if(existing) return existing.userData.report;
  const root=rootOf(model), ground=groundOf(root); root.updateWorldMatrix?.(true,true); model.updateWorldMatrix(true,true);
  const selected=collectCandidates(THREE,model,ground), group=new THREE.Group(); group.name="A1VisibleSupportSleevesToPavementV2"; model.add(group); model.updateWorldMatrix(true,true);
  const mat=material(THREE), evidence=[]; let maxExtension=0,maxClearance=0;
  for(let i=0;i<selected.length;i++){
    const s=selected[i], bottomY=s.rampY-PAVEMENT_BURY, topY=s.box.min.y+TOP_OVERLAP, height=topY-bottomY;
    const worldCenter=new THREE.Vector3(s.center.x,(topY+bottomY)/2,s.center.z), localCenter=group.worldToLocal(worldCenter.clone());
    const width=Math.max(0.08,Math.min(0.22,s.size.x)), depth=Math.max(0.08,Math.min(0.22,s.size.z));
    const sleeve=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat); sleeve.name=`A1VisibleSupportSleeveV2_${i+1}`; sleeve.position.copy(localCenter); sleeve.castShadow=true; sleeve.receiveShadow=true; group.add(sleeve);
    maxExtension=Math.max(maxExtension,s.extension); maxClearance=Math.max(maxClearance,Math.abs((bottomY+PAVEMENT_BURY)-s.rampY));
    evidence.push(Object.freeze({sourceMesh:s.mesh.name,triangleCount:s.tris.length,x:s.center.x,z:s.center.z,sourceBottomY:s.box.min.y,rampY:s.rampY,extension:s.extension,alongRatio:s.along,lateralDistance:s.lateral}));
  }
  group.updateWorldMatrix(true,true);
  const report=Object.freeze({authority:AUTHORITY,sleeveCount:group.children.length,maximumExtensionMeters:maxExtension,maximumFinalClearanceMeters:maxClearance,sourceGeometryMutated:false,detectionAuthority:"four-distinct-live-suspended-tunnel-b-c-members-v3",distinctCenterThresholdMeters:MIN_DISTINCT_CENTER_METERS,evidence});
  group.userData.report=report; model.userData.a1VisibleSupportSleevesV2=report; return report;
}
export { AUTHORITY as A1_VISIBLE_SUPPORT_SLEEVE_V2_AUTHORITY };
