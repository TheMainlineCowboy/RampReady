// Single guide-man signals for a GSE driver approaching the aircraft.
// Reference: IATA IGOM chapter 4.8.3 (guide man, NOT pilot-aircraft marshalling).
// Vehicle forward: arms slightly aside, repeated upward/backward beckoning.
// Slow: patting motion. Stop: arms rise to cross above head.
// Each target is an anatomical wrist target, reached via analytic two-bone IK,
// then smoothed from the preceding target (no instantaneous pose snapping).
export const A1_GUIDE_CUES=Object.freeze(["hold","guide","slow","stop"]);
export function createA1GroundGuideMotion(THREE,{person,bones,mixer,idleAction,walkAction,grips}) {
  const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
  let cue="hold",elapsed=0,walking=false;
  const cached={l:null,r:null};
  const sideOf={};
  const scratch={base:V(),elbow:V(),wrist:V(),pquat:Q(),dquat:Q()};
  function side(side){
    if(!sideOf[side]){
      const b=bones["upperarm_"+side];
      b.updateWorldMatrix(true,true);
      const x=person.worldToLocal(b.getWorldPosition(V())).x;
      sideOf[side]=Math.sign(x)||(side==="l"?-1:1);
    }
    return sideOf[side];
  }
  function localOf(bone){return person.worldToLocal(bone.getWorldPosition(V()));}
  function desiredHand(sideLabel,cue,t){
    const shoulder=localOf(bones["upperarm_"+sideLabel]);
    const sign=side(sideLabel);
    if(cue==="hold")return shoulder.add(new THREE.Vector3(sign*.245,-.285,.025));
    if(cue==="guide"){
      // Beckon TOWARD the guide, rising from just below shoulder height to
      // just above shoulder level; no erroneous downward 'guide' gesture.
      const wave=.5-.5*Math.cos(t*4.6);
      return shoulder.add(new THREE.Vector3(sign*.27,-.20+wave*.285,.19+wave*.025));
    }
    if(cue==="slow"){
      const pat=.5+.5*Math.cos(t*3.2);
      return shoulder.add(new THREE.Vector3(sign*.245,-.245-pat*.095,.14));
    }
    // Crossed wands overhead, bent at wrists and with both elbows outside
    // the torso. Not the straight-up un-crossed identify-gate signal.
    return shoulder.add(new THREE.Vector3(sign*.09,.375,.11));
  }
  function rotateToward(bone,child,targetWorld){
    bone.updateWorldMatrix(true,true);
    const from=child.getWorldPosition(V()).sub(bone.getWorldPosition(V())).normalize();
    const to=targetWorld.clone().sub(bone.getWorldPosition(V())).normalize();
    if(from.lengthSq()<.5||to.lengthSq()<.5)return;
    const delta=Q().setFromUnitVectors(from,to);
    const parent=bone.parent.getWorldQuaternion(Q());
    const localDelta=parent.clone().invert().multiply(delta).multiply(parent);
    bone.quaternion.premultiply(localDelta);bone.updateWorldMatrix(true,true);
  }
  function solveArm(sideLabel,targetLocal){
    const upper=bones["upperarm_"+sideLabel],fore=bones["lowerarm_"+sideLabel],hand=bones["hand_"+sideLabel];
    upper.updateWorldMatrix(true,true);
    const start=upper.getWorldPosition(V()),elbow=fore.getWorldPosition(V()),wrist=hand.getWorldPosition(V());
    const upperLen=start.distanceTo(elbow),foreLen=elbow.distanceTo(wrist);
    if(upperLen<.12||foreLen<.12)return;
    const destination=person.localToWorld(targetLocal.clone());
    const toward=destination.clone().sub(start);
    const requested=toward.length();
    const reach=Math.min(upperLen+foreLen-.008,Math.max(Math.abs(upperLen-foreLen)+.005,requested));
    toward.normalize();const target=start.clone().addScaledVector(toward,reach);
    const axial=(upperLen*upperLen-foreLen*foreLen+reach*reach)/(2*reach);
    const radial=Math.sqrt(Math.max(0,upperLen*upperLen-axial*axial));
    // Outward, slightly toward the tug: resolves a unique natural elbow bend
    // and prevents elbows tunneling into the spine or crossing each other.
    const sign=side(sideLabel);
    const reference=person.localToWorld(targetLocal.clone().add(new THREE.Vector3(sign*.32,.13,.28))).sub(destination);
    const outward=reference.addScaledVector(toward,-reference.dot(toward)).normalize();
    const elbowGoal=start.clone().addScaledVector(toward,axial).addScaledVector(outward,radial);
    rotateToward(upper,fore,elbowGoal);
    rotateToward(fore,hand,target);
  }
  function aimWands(sideLabel) {
    const grip=grips[sideLabel];
    if(!grip)return;
    const sign=side(sideLabel);
    let direction;
    if(cue==="stop")direction=new THREE.Vector3(-sign*.50,.89,.045).normalize();
    else if(cue==="hold")direction=new THREE.Vector3(sign*.13,.91,.24).normalize();
    else direction=new THREE.Vector3(sign*.06,.99,.06).normalize();
    const desiredWorld=person.getWorldQuaternion(Q())
      .multiply(Q().setFromUnitVectors(new THREE.Vector3(0,1,0),direction));
    const parentWorld=grip.parent.getWorldQuaternion(Q());
    grip.quaternion.copy(parentWorld.invert().multiply(desiredWorld));
  }
  function cueSet(next) {
    if(!A1_GUIDE_CUES.includes(next))throw Error("Unrecognized GSE guide-man cue: "+next);
    cue=next;
  }
  return {
    setCue:cueSet,
    get cue(){return cue;},
    setWalking(next){
      if(!!next===walking)return;
      walking=!!next;
      if(walking){idleAction.fadeOut(.23);walkAction.reset().fadeIn(.23).play();}
      else{walkAction.fadeOut(.23);idleAction.reset().fadeIn(.23).play();}
    },
    update(dt){
      dt=Math.min(.05,Math.max(0,Number.isFinite(dt)?dt:0));
      elapsed+=dt;mixer.update(dt);
      if(walking)return;
      for(const s of ["l","r"]){
        const intended=desiredHand(s,cue,elapsed);
        if(!cached[s])cached[s]=localOf(bones["hand_"+s]);
        // Damping is time-based. On any state change, the hands move smoothly
        // toward the next pose over multiple frames, not through a hard cut.
        const blend=1-Math.exp(-dt/.24);
        cached[s].lerp(intended,blend);
        solveArm(s,cached[s]);
        aimWands(s);
      }
    },
    getMetrics(){
      const out={};
      for(const s of ["l","r"]){
        out[s]={shoulder:localOf(bones["upperarm_"+s]).toArray(),hand:localOf(bones["hand_"+s]).toArray()};
      }
      return out;
    },
  };
}
