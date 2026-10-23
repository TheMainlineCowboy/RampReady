// Real LEKTRO approach guide: continuously raises both arms as the tug nears.
// This is based on the user's PHX ramp procedure, not aircraft-to-pilot
// marshalling cards. At the nose-gear stop point forearms cross overhead.
// No wand gestures are required for this specific tug positioning workflow.
import {createA1OpenPalmPose} from "./a1OpenPalmPose.js";

export const A1_GUIDE_CUES=Object.freeze(["hold","guide","slow","stop"]);
export const A1_APPROACH_DISTANCE_METERS=7.0;
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const smooth=(x)=>{const y=clamp(x,0,1);return y*y*(3-2*y);};
export function getA1ApproachPose(meters){
  const distanceMeters=clamp(Number.isFinite(meters)?meters:A1_APPROACH_DISTANCE_METERS,0,A1_APPROACH_DISTANCE_METERS);
  const progress=1-distanceMeters/A1_APPROACH_DISTANCE_METERS;
  const raise=smooth(progress);
  const crossed=smooth((progress-.88)/.12);
  return {distanceMeters,progress,raise,crossed,
    phase:distanceMeters<=.2?"nose-gear-stop":progress<.72?"straight-arms":"arms-rising"};
}
export function createA1GroundGuideMotion(THREE,{person,bones,mixer,idleAction,walkAction,grips}) {
  const vec=()=>new THREE.Vector3(),quat=()=>new THREE.Quaternion();
  const worldPoint=()=>new THREE.Vector3();
  let targetDistance=A1_APPROACH_DISTANCE_METERS;
  let renderedDistance=A1_APPROACH_DISTANCE_METERS;
  // Timing override only at an actual aligned stop. All arm IK/pose geometry
  // below is byte-for-byte the same as the previously integrated marshaller.
  let immediateStop=false;
  let cue="hold",walking=false;
  const last={l:null,r:null},signs={};
  const palms=createA1OpenPalmPose(THREE,{person,bones});
  // Important: save shoulder-chain translations. IK is rotation-only;
  // translation on upper-arm or clavicle bones visually pulls sleeves out
  // of their sockets and is never a valid marshalling pose.
  const bindOffsets={};
  for(const id of ["l","r"]){
    bindOffsets[id]=bones["upperarm_"+id].position.clone();
  }
  function localOf(bone){return person.worldToLocal(bone.getWorldPosition(vec()));}
  function signFor(id){
    if(signs[id])return signs[id];
    person.updateWorldMatrix(true,true);
    const x=localOf(bones["upperarm_"+id]).x;
    signs[id]=Math.sign(x)||(id==="l"?-1:1);
    return signs[id];
  }
  function targetWrist(id,pose){
    const start=localOf(bones["upperarm_"+id]);
    const sign=signFor(id);
    // Arms begin horizontally out at shoulder height. They gradually rotate
    // upward; wrists only cross the midline in the last part of the approach.
    const outer=.50*(1-pose.raise);
    // The old +0.54m wrist lift nearly fully extended both arm chains,
    // leaving no elbow-bend freedom and visually pulling the sleeve away from
    // the shoulder. Crossing needs to happen via bent FOREARMS, not via
    // upper arms pointing inward through the neck.
    // Bring crossed bare hands ABOVE the hairline at the last approach position.
    // The preceding .32m rise stopped at eye level despite correct IK.
    // Gradually raise throughout approach, with an extra controlled lift as
    // the forearms cross in the final fraction of a metre.
    const rising=.375*pose.raise+.030*pose.crossed;
    // Cross *forearms* above the forehead, not shoulder joints. Keep the
    // wrists ahead of the face as they converge so the upper arms remain
    // seated at the clavicles instead of folding through the neck.
    const crossing=-.18*pose.crossed;
    return start.add(new THREE.Vector3(
      sign*(outer+crossing),rising-.025,.07+.11*pose.crossed));
  }
  function boneToward(bone,child,target){
    bone.updateWorldMatrix(true,true);
    const origin=bone.getWorldPosition(vec());
    const from=child.getWorldPosition(vec()).sub(origin).normalize();
    const toward=target.clone().sub(origin).normalize();
    if(from.lengthSq()<.9||toward.lengthSq()<.9)return;
    const change=quat().setFromUnitVectors(from,toward);
    const parent=bone.parent.getWorldQuaternion(quat());
    bone.quaternion.premultiply(parent.clone().invert().multiply(change).multiply(parent));
    bone.updateWorldMatrix(true,true);
  }
  function solve(id,wristLocal,pose){
    const upper=bones["upperarm_"+id],fore=bones["lowerarm_"+id],hand=bones["hand_"+id];
    upper.updateWorldMatrix(true,true);
    const a=upper.getWorldPosition(vec()),b=fore.getWorldPosition(vec()),c=hand.getWorldPosition(vec());
    const l1=a.distanceTo(b),l2=b.distanceTo(c);
    if(l1<.12||l2<.12)throw Error("NPC arm bone length implausible");
    const request=person.localToWorld(wristLocal.clone());
    const axis=request.clone().sub(a);
    const distance=clamp(axis.length(),Math.abs(l1-l2)+.003,l1+l2-.003);
    axis.normalize();
    const finish=a.clone().addScaledVector(axis,distance);
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
    const side=signFor(id);
    const radial=Math.sqrt(Math.max(0,l1*l1-along*along));
    // Never switch elbow pole abruptly at the stop threshold: the old
    // crossed>.5 branch snapped an arm over a different IK solution and
    // made the shoulder look dislocated. Interpolate the SAME outward,
    // anterior elbow plane continuously for the entire tug approach.
    // Pole reference is based on the FIXED shoulder, not the moving wrist.
    // A wrist-relative elbow pole followed the crossed hands inward above
    // the face, making the entire humerus look displaced. The elbow should
    // stay OUTSIDE its shoulder while the forearms cross above the forehead.
    const shoulderLocal=localOf(upper);
    const outwardPole=new THREE.Vector3(side*.41,-.025,.11)
      .lerp(new THREE.Vector3(side*.62,-.11,.11),pose.crossed);
    const targetBend=person.localToWorld(shoulderLocal.add(outwardPole)).sub(a);
    targetBend.addScaledVector(axis,-targetBend.dot(axis));
    if(targetBend.lengthSq()<1e-8){
      const fallback=person.getWorldQuaternion(quat())
        .multiply(new THREE.Quaternion());
      targetBend.set(side,0,.25).applyQuaternion(fallback);
      targetBend.addScaledVector(axis,-targetBend.dot(axis));
    }
    targetBend.normalize();
    const targetElbow=a.clone().addScaledVector(axis,along).addScaledVector(targetBend,radial);
    boneToward(upper,fore,targetElbow);
    boneToward(fore,hand,finish);
  }
  function moveWands(id,pose){
    const grip=grips[id];if(!grip)return;
    const side=signFor(id);
    const lean=pose.crossed;
    const desired=new THREE.Vector3(-side*.9*lean+side*.05*(1-lean),1-.6*lean,.04).normalize();
    const rot=person.getWorldQuaternion(quat())
      .multiply(quat().setFromUnitVectors(new THREE.Vector3(0,1,0),desired));
    const parent=grip.parent.getWorldQuaternion(quat());
    grip.quaternion.copy(parent.invert().multiply(rot));
  }
  function setDistanceMeters(meters, snapAtCapture=false){
    if(!Number.isFinite(meters))throw Error("Approach distance must be finite");
    targetDistance=clamp(meters,0,A1_APPROACH_DISTANCE_METERS);
    immediateStop=!!snapAtCapture && targetDistance<=0;
  }
  function setCue(next){
    if(!A1_GUIDE_CUES.includes(next))throw Error("Invalid guide cue "+next);
    cue=next;
    setDistanceMeters(({hold:7,guide:4.2,slow:1.3,stop:0})[next]);
  }
  return {
    get cue(){return cue;},
    setCue,setDistanceMeters,
    get targetDistanceMeters(){return targetDistance;},
    setWalking(next){
      if(!!next===walking)return;
      walking=!!next;
      if(walking){idleAction.fadeOut(.23);walkAction.reset().fadeIn(.23).play();}
      else{walkAction.fadeOut(.23);idleAction.reset().fadeIn(.23).play();}
    },
    update(dt){
      const animationDt=clamp(Number.isFinite(dt)?dt:0,0,1);
      // Retain the original arm interpolation cap, but play the authored
      // walk clip at wall-clock speed even when WebGL renders slowly.
      dt=Math.min(animationDt,.05);
      mixer.update(animationDt);
      if(walking)return;
      // If the collision/capture authority confirms the tug is at its stop,
      // do not leave the signal lagging the tug by another second.
      if(immediateStop)renderedDistance=0;
      else{
        const alpha=1-Math.exp(-dt/.16);
        renderedDistance+=(targetDistance-renderedDistance)*alpha;
        if(Math.abs(targetDistance-renderedDistance)<.002)renderedDistance=targetDistance;
      }
      const pose=getA1ApproachPose(renderedDistance);
      for(const id of ["l","r"]){
        const desired=targetWrist(id,pose);
        if(!last[id])last[id]=localOf(bones["hand_"+id]);
        if(immediateStop)last[id].copy(desired);
        else last[id].lerp(desired,1-Math.exp(-dt/.19));
        solve(id,last[id],pose);
        // Solve wrist roll from actual finger bones AFTER the arm is posed.
        // Fingers follow the forearm, both PALMS face the oncoming tug.
        palms.pose(id);
        if(grips[id]?.visible)moveWands(id,pose);
        // Enforce rotational IK. The source arm joint remains at the
        // shoulder even while the forearm crosses above the head.
        if(bones["upperarm_"+id].position.distanceTo(bindOffsets[id])>.002){
          throw Error("Marshaller shoulder joint translated out of socket: "+id);
        }
      }
    },
    getMetrics(){
      const out={distanceMeters:renderedDistance,targetDistanceMeters:targetDistance,pose:getA1ApproachPose(renderedDistance)};
      for(const id of ["l","r"]){
        out[id]={shoulder:localOf(bones["upperarm_"+id]).toArray(),
          elbow:localOf(bones["lowerarm_"+id]).toArray(),
          hand:localOf(bones["hand_"+id]).toArray(),
          shoulderLocalPosition:bones["upperarm_"+id].position.toArray(),
          shoulderBindPosition:bindOffsets[id].toArray(),
          ...palms.metrics(id)};
      }
      return out;
    }
  };
}
