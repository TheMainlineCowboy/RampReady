import { groundA1TunnelCVisibleSupportHardwareV3 as groundV20 } from "./a1TunnelCVisibleSupportGroundingV20.js";

const GROUND_NAMES = Object.freeze(["PHX_KPHX_SourceAuthoredPhotoGround_Tiled", "PHX_KPHX_SourceAuthoredPhotoGround"]);
const TARGETS = Object.freeze([
  Object.freeze({ name: "rod-outboard-a", minX: -11.31, maxX: -11.20, minZ: 10.04, maxZ: 10.17, maxHeightAboveRamp: 2.35 }),
  Object.freeze({ name: "rod-outboard-b", minX: -13.10, maxX: -13.00, minZ: 10.27, maxZ: 10.40, maxHeightAboveRamp: 2.20 }),
  Object.freeze({ name: "rod-thin-a", minX: -11.87, maxX: -11.74, minZ: 9.96, maxZ: 10.18, maxHeightAboveRamp: 2.45 }),
  Object.freeze({ name: "rod-thin-b", minX: -12.43, maxX: -12.30, minZ: 10.02, maxZ: 10.23, maxHeightAboveRamp: 2.45 }),
]);
const TOL = 0.015;
const MAX_VISIBLE_GAP = 0.12;
const TAPER_HEIGHT = 0.22;
const MIN_CONTACT_VERTICES = 6;

function rootOf(object){let root=object;while(root?.parent)root=root.parent;return root;}
function groundOf(root){for(const name of GROUND_NAMES){const g=root?.getObjectByName?.(name);if(g)return g;}throw new Error("A1 V22 no rendered KPHX pavement");}
function groundYAt(THREE,ground,x,z,yHint=4){const ray=new THREE.Raycaster(new THREE.Vector3(x,yHint+40,z),new THREE.Vector3(0,-1,0));ray.far=200;const hit=ray.intersectObject(ground,true)[0];if(!hit?.point)throw new Error(`A1 V22 pavement ray miss ${x},${z}`);return hit.point.y;}
function inTarget(world,target,rampY){return world.x>=target.minX&&world.x<=target.maxX&&world.z>=target.minZ&&world.z<=target.maxZ&&world.y>=rampY-TOL&&world.y<=rampY+target.maxHeightAboveRamp;}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE,model){
  const base=groundV20(THREE,model),root=rootOf(model),ground=groundOf(root),meshes=[];
  root.updateWorldMatrix?.(true,true);model.updateWorldMatrix(true,true);
  model.traverse?.(o=>{if(o?.isMesh&&o.name==="Tunnel_B_Jetway_0")meshes.push(o);});
  if(!meshes.length)throw new Error("A1 V22 no rendered Tunnel_B_Jetway_0 meshes");
  let correctedVertices=0,maxCorrection=0;const evidence=[];
  for(const mesh of meshes){
    mesh.updateWorldMatrix(true,false);mesh.geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    const position=mesh.geometry.getAttribute("position"),local=new THREE.Vector3(),world=new THREE.Vector3(),inverse=mesh.matrixWorld.clone().invert();
    for(const target of TARGETS){
      const cx=(target.minX+target.maxX)/2,cz=(target.minZ+target.maxZ)/2,rampY=groundYAt(THREE,ground,cx,cz);
      let lowestSuspended=Infinity,candidateCount=0;
      for(let i=0;i<position.count;i++){
        local.fromBufferAttribute(position,i);world.copy(local).applyMatrix4(mesh.matrixWorld);
        if(!inTarget(world,target,rampY))continue;candidateCount++;
        const gap=world.y-rampY;if(gap>TOL&&gap<=MAX_VISIBLE_GAP)lowestSuspended=Math.min(lowestSuspended,world.y);
      }
      if(candidateCount<MIN_CONTACT_VERTICES)continue;
      let moved=0;
      if(Number.isFinite(lowestSuspended)){
        const gap=lowestSuspended-rampY;
        for(let i=0;i<position.count;i++){
          local.fromBufferAttribute(position,i);world.copy(local).applyMatrix4(mesh.matrixWorld);
          if(!inTarget(world,target,rampY)||world.y<lowestSuspended-TOL||world.y>lowestSuspended+TAPER_HEIGHT)continue;
          const t=Math.max(0,Math.min(1,(world.y-lowestSuspended)/TAPER_HEIGHT));
          const delta=gap*(1-t);world.y-=delta;local.copy(world).applyMatrix4(inverse);position.setXYZ(i,local.x,local.y,local.z);moved++;maxCorrection=Math.max(maxCorrection,delta);
        }
        correctedVertices+=moved;
      }
      evidence.push({target:target.name,candidateCount,moved,initialVisibleGap:Number.isFinite(lowestSuspended)?lowestSuspended-rampY:0});
    }
    position.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();mesh.updateMatrixWorld(true);
  }
  model.updateWorldMatrix(true,true);
  // Each diagnosed rod footprint must now visibly reach the actual rendered pavement.  We count
  // true final-world vertices at pavement; unlike V21 this does not discard already-grounded
  // vertices and then accidentally reinterpret the next vertex row as a new hanging rod.
  const failures=[];const contacts={};
  for(const target of TARGETS){
    const cx=(target.minX+target.maxX)/2,cz=(target.minZ+target.maxZ)/2,rampY=groundYAt(THREE,ground,cx,cz);let contact=0,total=0,minGap=Infinity;
    for(const mesh of meshes){const position=mesh.geometry.getAttribute("position"),local=new THREE.Vector3(),world=new THREE.Vector3();for(let i=0;i<position.count;i++){local.fromBufferAttribute(position,i);world.copy(local).applyMatrix4(mesh.matrixWorld);if(!inTarget(world,target,rampY))continue;total++;const gap=world.y-rampY;minGap=Math.min(minGap,gap);if(Math.abs(gap)<=TOL)contact++;}}
    contacts[target.name]={contact,total,minGap:Number.isFinite(minGap)?minGap:null};if(contact<MIN_CONTACT_VERTICES)failures.push({target:target.name,contact,total,minGap});
  }
  if(failures.length)throw new Error(`A1 V22 rod pavement contact failure ${JSON.stringify(failures)}`);
  model.userData.a1V22RodLowerEndContact=Object.freeze({correctedVertices,maxCorrectionMeters:maxCorrection,contacts,evidence});
  return Object.freeze({...base,remainingSuspendedSupportCount:0,maximumFinalClearanceMeters:Math.max(base.maximumFinalClearanceMeters,0),v22RodCorrectedVertexCount:correctedVertices,v22RodMaximumCorrectionMeters:maxCorrection});
}

export { A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY, A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY } from "./a1TunnelCVisibleSupportGroundingV5.js";
