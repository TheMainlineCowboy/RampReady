// Rigged, textured CC0 MakeHuman NPCs for RampReady A1.
// Source provenance is verified in scripts/download-a1-cc0-human-references.mjs.
// The procedural figures are only stand-ins during source QA; realistic people
// are instantiated inside the SAME Three.js loader/marshaller runtime.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function sourceUrl(filename) {
  return new URL("models/a1-npc-preview/" + filename, document.baseURI).href;
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
    wand.position.set(0,-.15,.04);
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
  driver.holder.scale.copy(driverProxy.root.scale);
  // The driver is seated in the vehicle for the clearance/departure sequence;
  // a pose sampled from the original Sit_Stand clip is held rather than looping.
  driver.actions.sit.play();
  driver.mixer.setTime(driver.sit.duration*.55);
  driver.actions.sit.paused=true;
  driver.mixer.update(0);
  marshaller.play("idle",0);
  addWands(THREE,marshaller);
  marshalProxy.root.visible=false;driverProxy.root.visible=false;
  let lastSignal="hold";
  return {
    update(dt,status) {
      marshaller.holder.position.copy(marshalProxy.root.position);
      const walking=status.marshalWalkProgress>0 && status.marshalWalkProgress<1;
      marshaller.play(walking?"walk":"idle");
      marshaller.update(dt);
      // Hand motions are applied AFTER the skeletal animation is sampled,
      // preserving the original legs, spine and weight shifts.
      for(const side of ["l","r"]){
        const upper=marshaller.bones["upperarm_"+side];
        if(!upper)continue;
        if(status.signal==="approach"){
          upper.rotation.z += (side==="l" ? -1.00 : 1.00)+Math.sin(status.elapsed*5)*.17;
        }else if(status.signal==="stop"){
          upper.rotation.z += side==="l" ? -1.9 : 1.9;
        }else if(status.signal==="hold"){
          upper.rotation.z += side==="l" ? -.65 : .65;
        }
      }
      lastSignal=status.signal;
    },
    reset() {marshaller.play("idle",0);lastSignal="hold";},
    dispose() {marshaller.dispose();driver.dispose();},
    get source(){return "real-makehuman-sam-harper-animated-glb";},
    get signal(){return lastSignal;},
  };
}
