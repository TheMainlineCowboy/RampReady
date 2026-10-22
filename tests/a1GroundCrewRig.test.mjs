import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createA1GroundCrewScene } from "../src/simulation/a1GroundCrewScene.js";

test("real Three.js runtime creates two animated NPCs and a belt loader, then clears",()=>{
 const scene=new THREE.Scene();
 const aircraft=new THREE.Group();
 aircraft.position.set(12,0,-40);
 aircraft.rotation.y=.38;
 scene.add(aircraft);
 const crew=createA1GroundCrewScene(THREE,{scene,aircraft});
 assert.ok(scene.children.includes(crew.root));
 assert.ok(crew.root.getObjectByName("NPC belt loader operator"));
 assert.ok(crew.root.getObjectByName("NPC A1 LEKTRO approach guide"));
 assert.ok(crew.root.getObjectByName("NPC operated belt loader"));
 assert.equal(crew.isClear(),false);
 const loader=crew.root.getObjectByName("NPC operated belt loader");
 const start=loader.position.x;
 let phase="servicing";
 for(let i=0;i<420;i++){
   const state=crew.update(.04,{tugPosition:new THREE.Vector3(12,0,-48),stage:0,inspection:false});
   phase=state.phase;
 }
 assert.equal(phase,"ready");
 assert.equal(crew.isClear(),true);
 assert.ok(loader.position.x > start+10);
 assert.ok(crew.status.equipmentClear);
 crew.reset();
 assert.equal(crew.isClear(),false);
 assert.equal(loader.position.x,start);
 const inspection=crew.update(.04,{inspection:true});
 assert.equal(crew.root.visible,false);
 crew.update(.04,{inspection:false});
 assert.equal(crew.root.visible,true);
 crew.dispose();
 assert.ok(!scene.children.includes(crew.root));
});
