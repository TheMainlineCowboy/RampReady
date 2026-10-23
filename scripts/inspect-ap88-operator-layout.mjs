// Non-mutating forensic audit of the *live* AP88 R187A GLB's panel hierarchy.
// Preserve the GLB exactly. Do not treat this AP88 as the AP8750B V49C master.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as THREE from "three";

const source="public/models/lektro-88/LEKTRO_AP88_TVO914.glb";
const bytes=fs.readFileSync(source);
const sha=crypto.createHash("sha256").update(bytes).digest("hex");
const approved="1a199a43b5339924693a20bd55d5c8c05f15019e6845a085b0be669fc38bd140";
if(sha!==approved)throw Error("Live R187A GLB changed; reject panel audit on an unknown asset: "+sha);
if(bytes.toString("ascii",0,4)!=="glTF"||bytes.readUInt32LE(4)!==2)throw Error("Expected GLB v2");
const jsonLength=bytes.readUInt32LE(12),jsonType=bytes.toString("ascii",16,20);
if(jsonType!=="JSON")throw Error("GLB first chunk is not JSON");
const gltf=JSON.parse(bytes.toString("utf8",20,20+jsonLength));
const nodeList=gltf.nodes??[],parentCount=new Array(nodeList.length).fill(0);
for(const node of nodeList)for(const child of node.children??[])parentCount[child]++;
const world=new Map();
const local=(node)=>{
 if(node.matrix)return new THREE.Matrix4().fromArray(node.matrix);
 const p=new THREE.Vector3(...(node.translation??[0,0,0]));
 const q=new THREE.Quaternion(...(node.rotation??[0,0,0,1]));
 const s=new THREE.Vector3(...(node.scale??[1,1,1]));
 return new THREE.Matrix4().compose(p,q,s);
};
function visit(id,parent,depth=0){
 if(depth>150||world.has(id))return;
 const n=nodeList[id];if(!n)return;
 const m=parent.clone().multiply(local(n));world.set(id,m);
 for(const child of n.children??[])visit(child,m,depth+1);
}
for(const sc of gltf.scenes??[])for(const nodeId of sc.nodes??[])visit(nodeId,new THREE.Matrix4());
for(let i=0;i<nodeList.length;i++)if(!parentCount[i])visit(i,new THREE.Matrix4());
const matches=/panel|switch|selector|console|control|dash|operator|lever|steer|battery|power|screen|emergency|instrument|button|key|gauge|joystick|plate|label/i;
const candidate=nodeList.map((node,id)=>{
 const p=new THREE.Vector3().setFromMatrixPosition(world.get(id)??new THREE.Matrix4());
 return {id,name:node.name??"",mesh:node.mesh??null,children:(node.children??[]).length,
   worldXYZ:p.toArray().map(n=>Math.round(n*1000)/1000),
   authoredTranslation:node.translation??null,authoredRotation:node.rotation??null,
   authoredScale:node.scale??null};
}).filter(x=>matches.test(x.name));
const report={asset:source,sha256:sha,unchanged:true,totalNodes:nodeList.length,
  candidateCount:candidate.length,candidates:candidate};
const output="artifacts/a1-single-marshaller/ap88-operator-node-audit.json";
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log("AP88 GLB SHA256 verified; node hierarchy read; candidate operator nodes="+candidate.length);
console.log(JSON.stringify(candidate.slice(0,110),null,2));
console.log("Non-mutating audit only: no control-panel geometry changed or approved.");
