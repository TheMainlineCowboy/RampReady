// One A1 GSE guide-man prototype; no other crew or belt-loader scope.
// Uses a verifiable CC0 skinned human. Real PPE is topology-fitted to its
// original shirt, not free-floating barrels, cuboids or billboard costumes.
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {installA1MarshallingPPE} from "./a1MarshallerPPE.js";
import {A1_GUIDE_CUES,createA1GroundGuideMotion} from "./a1GroundGuideMotion.js";

export const MARSHAL_CUES=A1_GUIDE_CUES;
const assetURL=()=>new URL(
 import.meta.env.BASE_URL+"models/a1-single-marshal/sam-locomotion.glb",window.location.origin
).href;

export async function createA1SingleMarshaller(THREE,{scene,height=1.80}={}){
 const gltf=await new GLTFLoader().loadAsync(assetURL());
 const root=gltf.scene;
 const bounds=new THREE.Box3().setFromObject(root);
 const rawHeight=bounds.max.y-bounds.min.y;
 if(!(rawHeight>1.2 && rawHeight<2.3))throw Error("CC0 animated human is not correctly scaled");
 const person=new THREE.Group();
 person.name="A1 single human GSE guide man";
 root.scale.setScalar(height/rawHeight);
 root.position.y=-bounds.min.y*(height/rawHeight);
 person.add(root);person.rotation.y=Math.PI;
 scene.add(person);

 const bones={},originalMaterials=new Set(),originalGeometries=new Set();
 const navy=new THREE.Color(0x25364b),boot=new THREE.Color(0x867359);
 root.traverse(obj=>{
   if(obj.isBone)bones[obj.name]=obj;
   if(!obj.isMesh)return;
   obj.castShadow=true;obj.receiveShadow=true;
   originalGeometries.add(obj.geometry);
   const recolor=(m)=>{
     if(!m)return m;
     const c=m.clone();
     if(/original top|original bottom/i.test(c.name))c.color.copy(navy);
     if(/shoes/i.test(c.name))c.color.copy(boot);
     originalMaterials.add(c);return c;
   };
   obj.material=Array.isArray(obj.material)?obj.material.map(recolor):recolor(obj.material);
 });
 const required=["head","spine_03","pelvis",
   "upperarm_l","upperarm_r","lowerarm_l","lowerarm_r","hand_l","hand_r"];
 if(required.some(n=>!bones[n]))throw Error("The real human GLB lacks required arm/hand/head skeleton bones");
 const ppe=installA1MarshallingPPE(THREE,{root,bones,withWands:false});
 const mixer=new THREE.AnimationMixer(root);
 const idle=gltf.animations.find(c=>/idle.standing/i.test(c.name));
 const walk=gltf.animations.find(c=>/walk.relaxed/i.test(c.name));
 if(!idle||!walk)throw Error("CC0 GLB lacks source idle/walk animations");
 const idleAction=mixer.clipAction(idle),walkAction=mixer.clipAction(walk);
 idleAction.play();
 const guide=createA1GroundGuideMotion(THREE,{
   person,bones,mixer,idleAction,walkAction,grips:ppe.grips
 });
 return {
   person,
   setCue:guide.setCue,
   setDistanceMeters:guide.setDistanceMeters,
   setWalking:guide.setWalking,
   get cue(){return guide.cue;},
   update:guide.update,
   getPoseMetrics:()=>({...guide.getMetrics(),headsetFit:ppe.headsetFit,vestApplied:ppe.vestApplied}),
   dispose(){
     mixer.stopAllAction();ppe.dispose();
     person.parent?.remove(person);
     const images=new Set();
     for(const m of originalMaterials){
       for(const v of Object.values(m))if(v?.isTexture)images.add(v);
       m.dispose();
     }
     originalGeometries.forEach(x=>x.dispose());
     images.forEach(x=>x.dispose());
   },
   get visibleAssetSource(){
     return "CC0 MakeHuman Sam; skin-fitted safety vest; anatomically sized PELTOR-like hearing protection";
   },
 };
}
