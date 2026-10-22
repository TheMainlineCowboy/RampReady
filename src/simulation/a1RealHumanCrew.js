// Rigged, textured CC0 MakeHuman NPCs for RampReady A1.
// Source provenance is verified in scripts/download-a1-cc0-human-references.mjs.
// The procedural figures are only stand-ins during source QA; realistic people
// are instantiated inside the SAME Three.js loader/marshaller runtime.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function sourceUrl(filename) {
  return new URL(import.meta.env.BASE_URL + "models/a1-npc-preview/" + filename, window.location.origin).href;
}
function clipFor(animations, key) {
  return animations.find(clip => key.test(clip.name)) || null;
}
function avatar(THREE, gltf, {targetHeight, highVisColor}) {
  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root);
  const height = box.max.y - box.min.y;
  if (!(height > 1.2 && height < 2.3) || gltf.animations.length < 3) {
    throw new Error("Human model is not a plausibly scaled rigged person");
  }
  const scale = targetHeight / height;
  const holder = new THREE.Group();
  holder.name = "Actual skinned human — "+(root.name||"GLB");
  holder.add(root);
  root.scale.setScalar(scale);
  root.position.y = -box.min.y*scale;
  const bones={};
  root.traverse(o => {
    if (o.isBone) bones[o.name]=o;
    if (o.isSkinnedMesh) {
      o.castShadow=true;
      o.receiveShadow=true;
      if (/male_casualsuit|female|garment|shirt|top|worksuit|jacket/i.test(o.name)) {
        const change=(mat)=>{
          const m=mat.clone();
          if (m.name && /original top|worksuit|top|shirt/i.test(m.name)) {
            m.color.set(highVisColor);
            m.roughness=.86;
          }
          return m;
        };
        o.material=Array.isArray(o.material) ? o.material.map(change) : change(o.material);
      }
    }
  });
  if (!bones.head || !bones.hand_l || !bones.hand_r) throw Error("Missing human head and hands in source skeleton");
  // Lightweight PPE attached to the original bone hierarchy, never a
  // replacement blocky head/body.
  const helmetMat=new THREE.MeshStandardMaterial({color:0xffd037,roughness:.7,metalness:.03});
  const crown=new THREE.Mesh(new THREE.SphereGeometry(.157,24,12,0,Math.PI*2,0,Math.PI*.6),helmetMat);
  crown.name="Hard hat attached to animated head";
  crown.position.set(0,.145,0);
  bones.head.add(crown);
  const brim=new THREE.Mesh(new THREE.CylinderGeometry(.19,.17,.035,24),helmetMat);
  brim.position.set(0,.10,-.028);bones.head.add(brim);
  const mixer=new THREE.AnimationMixer(root);
  const idle=clipFor(gltf.animations,/idle/i), walk=clipFor(gltf.animations,/walk_relaxed|walk/i),
    sit=clipFor(gltf.animations,/sit.?stand/i);
  if (!idle||!walk||!sit)throw Error("The human GLB is missing idle/walk/sit animation clips");
  const actions={idle:mixer.clipAction(idle),walk:mixer.clipAction(walk),sit:mixer.clipAction(sit)};
  let current=null;
  function play(which,fade=.20) {
    if(current===which)return;
    if(current)actions[current].fadeOut(fade);
    actions[which].reset().fadeIn(fade).play();
    current=which;
  }
  return {holder,bones,mixer,actions,sit,idle,walk,play,
    update(dt){mixer.update(Math.min(dt,.06));},
    dispose(){mixer.stopAllAction();holder.parent?.remove(holder)}};
}
function addWands(THREE,human){
  const mat=new THREE.MeshStandardMaterial({color:0xff9b2c,emissive:0xa94308,emissiveIntensity:.85,roughness:.32});
  for(const side of ["l","r"]) {
    const bone=human.bones["hand_"+side];
    const wand=new THREE.Mesh(new THREE.CylinderGeometry(.019,.024,.37,12),mat);
    wand.name="Animated illuminated marshal baton";
    wand.position.set(0,.255,.055); // Extend beyond the knuckles, not inside the wrist
    wand.rotation.z=.10;
    bone.add(wand);
  }
}
export async function installA1RealHumanCrew(THREE,{loader, driverProxy, marshalProxy, sceneRoot}) {
  const loader3D=new GLTFLoader();
  const [sam,harper]=await Promise.all([
    loader3D.loadAsync(sourceUrl("sam-locomotion.glb")),
    loader3D.loadAsync(sourceUrl("harper-locomotion.glb")),
  ]);
  const marshaller=avatar(THREE,sam,{targetHeight:1.79,highVisColor:0xd9e13f});
  const driver=avatar(THREE,harper,{targetHeight:1.69,highVisColor:0xf5b334});
  // Keep humans in the same physical service/guide coordinate frames as the
  // existing belt loader. No modifications to locked aircraft or LEKTRO GLBs.
  sceneRoot.add(marshaller.holder);
  loader.add(driver.holder);
  marshaller.holder.position.copy(marshalProxy.root.position);
  driver.holder.position.copy(driverProxy.root.position);
  driver.holder.rotation.copy(driverProxy.root.rotation);
  // Retain adult body proportions; the 0.8x placeholder scale made the driver
  // look miniature compared with the vehicle. The hip now rests on the seat.
  driver.holder.scale.setScalar(1);
  driver.holder.position.y = 0.08;
  // The driver is seated in the vehicle for the clearance/departure sequence;
  // a pose sampled from the original Sit_Stand clip is held rather than looping.
  driver.actions.sit.play();
  driver.mixer.setTime(driver.sit.duration*.55);
  driver.actions.sit.paused=true;
  driver.mixer.update(0);
  marshaller.holder.rotation.y = Math.PI; // Face the approaching tug, not the aircraft.
  marshaller.play("idle",0);
  addWands(THREE,marshaller);
  // Aim the real articulated arm hierarchy at physically meaningful elbow
  // and wrist positions. Never compound Euler rotations frame-over-frame.
  const vec = () => new THREE.Vector3();
  const shoulderWorld=vec(), elbowWorld=vec(), targetWorld=vec();
  const targetHand=vec(), restLocal=vec(), parentWorld=new THREE.Quaternion();
  const difference = new THREE.Quaternion();
  function alignBone(bone, child, target, strength=0.94) {
    bone.updateWorldMatrix(true,true);
    bone.getWorldPosition(shoulderWorld);
    child.getWorldPosition(elbowWorld);
    const current = elbowWorld.clone().sub(shoulderWorld).normalize();
    const desired = target.clone().sub(shoulderWorld).normalize();
    if (current.lengthSq()<.5 || desired.lengthSq()<.5) return;
    difference.setFromUnitVectors(current, desired);
    bone.parent.getWorldQuaternion(parentWorld);
    const rotated = parentWorld.clone().invert().multiply(difference)
      .multiply(parentWorld).multiply(bone.quaternion.clone());
    bone.quaternion.slerp(rotated, strength);
    bone.updateWorldMatrix(true,true);
  }
  function guideArm(side, signal, elapsed) {
    const shoulder=marshaller.bones["upperarm_"+side];
    const elbow=marshaller.bones["lowerarm_"+side];
    const wrist=marshaller.bones["hand_"+side];
    if (!shoulder || !elbow || !wrist) return;
    marshaller.holder.updateWorldMatrix(true,true);
    shoulder.getWorldPosition(shoulderWorld);
    restLocal.copy(shoulderWorld);
    marshaller.holder.worldToLocal(restLocal);
    const outward = Math.sign(restLocal.x)|| (side==="l"?-1:1);
    let elbowOffset, handOffset;
    if(signal==="stop"){
      // Two wands above the head, crossed: universal aircraft STOP cue.
      elbowOffset=[outward*.16,.29,-.20];
      handOffset=[-restLocal.x+outward*.10,.51,-.31];
    }else if(signal==="approach"){
      // Repeated, controlled beckoning motion with clear separation.
      const pulse=Math.sin(elapsed*4.5)*.12;
      elbowOffset=[outward*.26,.08,-.34];
      handOffset=[outward*.34,-.18+pulse,-.70];
    }else if(signal==="hold"){
      // Stationary signal: arms visible in front and offset from the body.
      elbowOffset=[outward*.29,.08,-.25];
      handOffset=[outward*.39,.26,-.47];
    }else{
      return; // Preserve the original idle/walk animation.
    }
    const elbowPoint=marshaller.holder.localToWorld(
      restLocal.clone().add(new THREE.Vector3(...elbowOffset)));
    const wristPoint=marshaller.holder.localToWorld(
      restLocal.clone().add(new THREE.Vector3(...handOffset)));
    alignBone(shoulder,elbow,elbowPoint);
    alignBone(elbow,wrist,wristPoint);
  }
  marshalProxy.root.visible=false;driverProxy.root.visible=false;
  let lastSignal="hold";
  return {
    update(dt,status) {
      marshaller.holder.position.copy(marshalProxy.root.position);
      const walking=status.marshalWalkProgress>0 && status.marshalWalkProgress<1;
      marshaller.play(walking?"walk":"idle");
      marshaller.update(dt);
      if (!walking) {
        for (const side of ["l","r"]) guideArm(side,status.signal,status.elapsed);
      }
      lastSignal=status.signal;
    },
    reset() {marshaller.play("idle",0);lastSignal="hold";},
    dispose() {marshaller.dispose();driver.dispose();},
    get source(){return "real-makehuman-sam-harper-animated-glb";},
    get signal(){return lastSignal;},
  };
}
