// Fit ear defenders to the REAL 3D head bone and skin, not guessed offsets.
// Measured once from the CC0 GLB's head-skinned vertices in head-bone space.
// Reject implausible dimensions rather than render an oversized floating set.
export function measureHeadForPPE(THREE, {root,head}) {
  root.updateWorldMatrix(true,true);
  head.updateWorldMatrix(true,true);
  const points=[],local=new THREE.Vector3();
  const meshes=[];
  root.traverse(obj=>{
    if(obj.isSkinnedMesh && /(^base$|eyebrow|eyelash|short|low-poly)/i.test(obj.name))meshes.push(obj);
  });
  for(const mesh of meshes){
    const positions=mesh.geometry?.getAttribute("position");
    const joints=mesh.geometry?.getAttribute("skinIndex");
    const weights=mesh.geometry?.getAttribute("skinWeight");
    if(!positions||!joints||!weights)continue;
    const index=mesh.skeleton.bones.findIndex(b=>b===head);
    if(index<0)continue;
    mesh.updateWorldMatrix(true,true);
    // Deterministic bounded sample of head-influenced vertices (not torso).
    for(let i=0;i<positions.count;i+=Math.max(1,Math.floor(positions.count/8500))){
      let influence=0;
      for(let k=0;k<4;k++)if(joints.getComponent(i,k)===index)influence+=weights.getComponent(i,k);
      if(influence<.76)continue;
      local.fromBufferAttribute(positions,i);
      mesh.applyBoneTransform(i,local);
      mesh.localToWorld(local);
      head.worldToLocal(local);
      if(Math.abs(local.x)<.24 && Math.abs(local.y)<.32 && Math.abs(local.z)<.28)
        points.push(local.clone());
    }
  }
  if(points.length<75)throw Error("Head geometry could not be measured from real skin weights");
  const quantile=(arr,q)=>{
    const sorted=arr.sort((a,b)=>a-b);
    return sorted[Math.min(sorted.length-1,Math.round((sorted.length-1)*q))];
  };
  // Quantiles avoid hair strand and eyelash extremes.
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
  const left=quantile(xs,.05),right=quantile(xs,.95),
    bottom=quantile(ys,.08),top=quantile(ys,.95),
    back=quantile(zs,.08),front=quantile(zs,.92);
  const width=right-left,height=top-bottom;
  if(width<.11||width>.29||height<.095||height>.43)
    throw Error("Head dimensions outside human range: "+JSON.stringify({width,height,points:points.length}));
  // This vertical extent is the *head-bone-influenced skin patch*, not the
  // entire anatomical cranium; hairline and neck often use other bones.
  // Horizontal face/skull extents are still strong for locating the ear seals.
  // Ear landmark lies slightly behind the face, just below eye level.
  const earsY=bottom+height*.50;
  const earZ=back+(front-back)*.46;
  const centerX=(left+right)/2;
  return {
    centerX,halfWidth:width*.5,earsY,earZ,
    top,front,back,width,height,
    points:points.length,
    earLeft:[left+.003,earsY,earZ],
    earRight:[right-.003,earsY,earZ],
  };
}
