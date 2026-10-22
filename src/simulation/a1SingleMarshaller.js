// A1 single-marshaller visual milestone. Uses the verified CC0 Sam animated GLB,
// NOT the Sketchfab reference (whose download rights aren't verified).
// Airside signals are illustrative until reviewed against ramp procedures.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const MARSHAL_CUES=Object.freeze(["hold","guide","slow","stop"]);
const assetURL=()=>new URL(import.meta.env.BASE_URL+"models/a1-single-marshal/sam-locomotion.glb",window.location.origin).href;

export async function createA1SingleMarshaller(THREE,{scene,height=1.80}){
 const gltf=await new GLTFLoader().loadAsync(assetURL());
 const root=gltf.scene;
 const bounds=new THREE.Box3().setFromObject(root);
 const rawHeight=bounds.max.y-bounds.min.y;
 if(rawHeight<1.2||rawHeight>2.3)throw Error("Invalid human size");
 if(!gltf.skins && !gltf.animations.length)throw Error("No animated human rig");
 const person=new THREE.Group();person.name="A1 single realistic human marshaller";
 const scale=height/rawHeight;
 root.scale.setScalar(scale);root.position.y=-bounds.min.y*scale;
 person.add(root);scene.add(person);
 const bones={};const materials=new Set(),geometries=new Set(),textures=new Set();
 const navy=new THREE.Color(0x172a4a),tan=new THREE.Color(0xbba07a);
 root.traverse(obj=>{
   if(obj.isBone)bones[obj.name]=obj;
   if(obj.isMesh){
     obj.castShadow=true;obj.receiveShadow=true;
     if(obj.geometry)geometries.add(obj.geometry);
     const mats=Array.isArray(obj.material)?obj.material:[obj.material];
     const modified=mats.map(mat=>{
       if(!mat)return mat;
       const m=mat.clone();
       if(/original top|original bottom/i.test(m.name))m.color.copy(navy);
       if(/shoes/i.test(m.name))m.color.copy(tan);
       materials.add(m);
       for(const v of Object.values(m))if(v?.isTexture)textures.add(v);
       return m;
     });
     obj.material=Array.isArray(obj.material)?modified:modified[0];
   }
 });
 const required=["head","spine_03","pelvis","upperarm_l","upperarm_r","lowerarm_l","lowerarm_r","hand_l","hand_r"];
 if(required.some(key=>!bones[key]))throw Error("Incomplete articulated GLB marshaller skeleton");
 const cloth=new THREE.MeshStandardMaterial({color:0xd6f139,side:THREE.DoubleSide,roughness:.89});
 const reflection=new THREE.MeshStandardMaterial({color:0xe6e8e5,metalness:.31,roughness:.42});
 const black=new THREE.MeshStandardMaterial({color:0x202a2a,roughness:.75});
 const foam=new THREE.MeshStandardMaterial({color:0x151d20,roughness:.95});
 const lime=new THREE.MeshStandardMaterial({color:0xc6e52f,roughness:.75});
 const redLight=new THREE.MeshStandardMaterial({color:0xff9a61,emissive:0xd74721,emissiveIntensity:1.35,roughness:.3});
 for(const m of [cloth,reflection,black,foam,lime,redLight])materials.add(m);
 const localMeshes=[];
 function add(parent,mesh,name,pos=[0,0,0]){
   mesh.name=name;mesh.position.set(...pos);parent.add(mesh);
   localMeshes.push(mesh);geometries.add(mesh.geometry);
   return mesh;
 }
 function mesh(geo,mat){return new THREE.Mesh(geo,mat)}
 function block(parent,name,w,h,d,mat,pos){
   return add(parent,mesh(new THREE.BoxGeometry(w,h,d),mat),name,pos);
 }
 function tube(parent,name,r,len,mat,pos,rotation=[0,0,0]){
   const p=add(parent,mesh(new THREE.CylinderGeometry(r,r,len,12),mat),name,pos);
   p.rotation.set(...rotation);return p;
 }
 // Curved, open-front vest; aligned to the animated upper torso bone rather
 // than floating against the character's static bind pose.
 const vest=new THREE.Group();vest.name="Lime safety vest following upper spine";
 bones.spine_03.add(vest);
 vest.position.set(0,.075,0);
 const outer=.278;
 const shell=add(vest,mesh(new THREE.CylinderGeometry(.245,outer,.49,28,1,true,Math.PI*.18,Math.PI*1.64),cloth),"Form-fitting open-front hi-vis shell");
 shell.position.y=.015;
 // Two reflective horizontal bands wrap the torso following the vest surface.
 for(const y of [-.105,.10]){
   const ring=add(vest,mesh(new THREE.CylinderGeometry(.252,outer+.007,.045,32,1,true,Math.PI*.18,Math.PI*1.64),reflection),"Continuous silver torso reflective band",[0,y,0]);
   ring.scale.y=1;
 }
 for(const x of [-.185,.185]){
   block(vest,"Vertical shoulder reflective tape",.055,.24,.025,reflection,[x,.145,-.176]);
 }
 // Hearing protection moves with head/neck. Supplied photo specifies
 // fluorescent green ear cups, curved headband, boom microphone and cable.
 const headset=new THREE.Group();headset.name="High-visibility communication earmuffs";
 bones.head.add(headset);
 headset.position.set(0,.055,0);
 for(const side of [-1,1]){
   const cup=add(headset,mesh(new THREE.CylinderGeometry(.087,.087,.074,22),lime),side<0?"Left neon ear defender":"Right neon ear defender",[side*.132,0,0]);
   cup.rotation.z=Math.PI/2;
   const pad=add(headset,mesh(new THREE.CylinderGeometry(.069,.069,.08,22),foam),"Noise-sealing ear cushion",[side*.105,-.003,0]);
   pad.rotation.z=Math.PI/2;
 }
 const band=add(headset,mesh(new THREE.TorusGeometry(.14,.020,10,24,Math.PI),black),"Over-head padded defender bridge",[0,.07,0]);
 band.rotation.z=Math.PI/2;
 // Articulated mouth microphone, stem from left ear cup.
 const stem=tube(headset,"Boom microphone stem",.012,.16,black,[-.105,-.056,-.094],[Math.PI/2,.18,-.24]);
 add(headset,mesh(new THREE.SphereGeometry(.027,12,8),foam),"Microphone at lips",[-.018,-.100,-.167]);
 const radio=block(bones.pelvis,"Hip-mounted black ground-radio",.10,.20,.065,black,[.17,-.065,-.135]);
 tube(bones.pelvis,"Radio antenna",.009,.21,black,[.17,.075,-.14],[0,0,0]);
 const wandMeshes=[];
 for(const side of ["l","r"]){
   const g=new THREE.Group();g.name=side+" illuminated wand grip";bones["hand_"+side].add(g);
   g.position.set(0,.14,.045);
   tube(g,"Ribbed black wand handle",.028,.21,foam,[0,0,0]);
   const glowing=tube(g,"Red illuminated guide wand",.029,.32,redLight,[0,.26,0]);
   wandMeshes.push(glowing);
 }
 const mixer=new THREE.AnimationMixer(root);
 const idle=gltf.animations.find(a=>/idle.standing/i.test(a.name));
 const walk=gltf.animations.find(a=>/walk.relaxed/i.test(a.name));
 if(!idle||!walk)throw Error("Missing human idle/walk animation");
 const idleAction=mixer.clipAction(idle), walkAction=mixer.clipAction(walk);
 idleAction.play();
 let walking=false,cue="hold",elapsed=0;
 const shoulder=new THREE.Vector3(),elbow=new THREE.Vector3(),goal=new THREE.Vector3();
 const parentQuat=new THREE.Quaternion(),delta=new THREE.Quaternion();
 function aimBone(bone,child,dest){
   bone.updateWorldMatrix(true,true);
   bone.getWorldPosition(shoulder);
   child.getWorldPosition(elbow);
   const current=elbow.clone().sub(shoulder).normalize();
   const desired=dest.clone().sub(shoulder).normalize();
   delta.setFromUnitVectors(current,desired);
   bone.parent.getWorldQuaternion(parentQuat);
   bone.quaternion.premultiply(parentQuat.clone().invert().multiply(delta).multiply(parentQuat));
   bone.updateWorldMatrix(true,true);
 }
 function applySignal(side,gesture,t){
   const upper=bones["upperarm_"+side],fore=bones["lowerarm_"+side],hand=bones["hand_"+side];
   upper.getWorldPosition(shoulder);
   const local=person.worldToLocal(shoulder.clone());
   const outward=side==="l"?-1:1;
   let elbowTarget,handTarget;
   if(gesture==="hold"){
     elbowTarget=[outward*.24,-.02,-.045];
     handTarget=[outward*.46,-.02,-.11];
   }else if(gesture==="guide"){
     const sweep=.13*Math.sin(t*4.0);
     elbowTarget=[outward*.21,-.095,-.23];
     handTarget=[outward*(.27-sweep),-.22,-.34];
   }else if(gesture==="slow"){
     const sweep=.065*Math.sin(t*2.3);
     elbowTarget=[outward*.20,-.07,-.21];
     handTarget=[outward*(.26-sweep),-.18,-.34];
   }else{
     elbowTarget=[outward*.18,.20,-.14];
     handTarget=[-outward*.08,.42,-.21];
   }
   const worldE=person.localToWorld(local.clone().add(new THREE.Vector3(...elbowTarget)));
   const worldH=person.localToWorld(local.clone().add(new THREE.Vector3(...handTarget)));
   aimBone(upper,fore,worldE);
   aimBone(fore,hand,worldH);
 }
 // The feet are placed in a deliberate, stable working stance, not a T pose.
 person.rotation.y=Math.PI;
 return {
  person,
  get cue(){return cue;},
  setCue(next){if(!MARSHAL_CUES.includes(next))throw Error("Invalid signal");cue=next;},
  setWalking(value){
    if(!!value===walking)return;
    walking=!!value;
    if(walking){idleAction.fadeOut(.25);walkAction.reset().fadeIn(.25).play();}
    else{walkAction.fadeOut(.25);idleAction.reset().fadeIn(.25).play();}
  },
  update(dt){
    dt=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));
    elapsed+=dt;mixer.update(dt);
    if(!walking){
      for(const side of ["l","r"])applySignal(side,cue,elapsed);
    }
  },
  dispose(){
    mixer.stopAllAction();
    person.parent?.remove(person);
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
    textures.forEach(t=>t.dispose());
  },
  get visibleAssetSource(){return "Sam CC0 skinned source with procedural PPE, modeled from user-supplied visual references";}
 };
}
