// Correct the open hands in the no-wand LEKTRO approach sequence.
// The source GLB has real index/middle/pinky bones. Calibrate an anatomical
// palm basis from those bone positions, instead of guessing Euler angles.
// Palms should stay visible to the approaching tug as arms rise and cross.
export function createA1OpenPalmPose(THREE,{person,bones}) {
  const axes={},q=new THREE.Quaternion(),front=new THREE.Vector3(0,0,-1);
  person.updateWorldMatrix(true,true);
  // The visible approach guide faces the local +Z direction. Derive that
  // in world space so this still works if the model is repositioned/rotated.
  const towardTug=new THREE.Vector3(0,0,1)
    .applyQuaternion(person.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const V=()=>new THREE.Vector3();
  const calc=(id)=>{
    const wrist=bones["hand_"+id],
      middle=bones["middle_01_"+id],
      index=bones["index_01_"+id],
      pinky=bones["pinky_01_"+id];
    if(!wrist||!middle||!index||!pinky)throw Error("Source human lacks anatomical finger landmarks for open hands: "+id);
    // All these are immediate children of the hand bone in this source GLB.
    const long=middle.position.clone().normalize();
    const across=index.position.clone().sub(pinky.position);
    across.addScaledVector(long,-across.dot(long)).normalize();
    // Mirror the real L/R hand anatomy. This avoids one palm facing the
    // model's back while the other faces the tug.
    const mirrored=id==="l"?-1:1;
    const localX=across.multiplyScalar(mirrored);
    const localZ=localX.clone().cross(long).normalize();
    const localY=localZ.clone().cross(localX).normalize();
    const m=new THREE.Matrix4().makeBasis(localX,localY,localZ);
    axes[id]={wrist,middle,index,pinky,
      localPalm:localZ.clone(),localFinger:localY.clone(),
      localBasis:new THREE.Quaternion().setFromRotationMatrix(m)};
  };
  calc("l");calc("r");
  function pose(id) {
    const a=axes[id],wrist=a.wrist,fore=bones["lowerarm_"+id];
    fore.updateWorldMatrix(true,true);
    const foreWorld=fore.getWorldPosition(V());
    const handWorld=wrist.getWorldPosition(V());
    const finger=handWorld.sub(foreWorld).normalize();
    // Keep the hand aligned with its forearm (no unnatural wrist kink).
    // Project the palm-facing vector perpendicular to that finger axis.
    const facing=towardTug.clone().addScaledVector(finger,-towardTug.dot(finger));
    if(facing.lengthSq()<.01)throw Error("Palm orientation degeneracy for "+id);
    facing.normalize();
    const side=finger.clone().cross(facing).normalize();
    const targetY=facing.clone().cross(side).normalize();
    const destBasis=new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(side,targetY,facing));
    const targetWorld=destBasis.multiply(a.localBasis.clone().invert());
    const parentWorld=wrist.parent.getWorldQuaternion(q.clone());
    wrist.quaternion.copy(parentWorld.invert().multiply(targetWorld));
    wrist.updateWorldMatrix(true,true);
  }
  function metrics(id) {
    const a=axes[id],boneWorld=a.wrist.getWorldQuaternion(q.clone());
    const palm=a.localPalm.clone().applyQuaternion(boneWorld).normalize();
    const finger=a.localFinger.clone().applyQuaternion(boneWorld).normalize();
    const fore=bones["lowerarm_"+id].getWorldPosition(V());
    const wrist=a.wrist.getWorldPosition(V());
    const foreAxis=wrist.sub(fore).normalize();
    return {palmFacingTug:palm.dot(towardTug),fingerAlignedToForearm:finger.dot(foreAxis),
      palmNormalWorld:palm.toArray()};
  }
  return {pose,metrics};
}
