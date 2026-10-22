// CC0 human references for A1 NPC review. Do not commit these unoptimized
// binaries as project source; produce build-time files for isolated QA.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const out=path.resolve("public/models/a1-npc-preview");
await mkdir(out,{recursive:true});
const refs=[
 {file:"sam-locomotion.glb",url:"https://www.innerscene.com/api/library/locomotion-collection-sam-3d-person-animated-dc23800f/download",license:"CC0",purpose:"animated marshaller reference"},
 {file:"drew-hivis.glb",url:"https://www.innerscene.com/api/library/drew-3d-person-construction-worker-with-hard-hat-and-hi-vis-a4aa98af/download",license:"CC0",purpose:"phototextured PPE reference"},
];
for(const ref of refs){
 const dest=path.join(out,ref.file);
 let b;try{b=await readFile(dest);}catch{}
 if(!b){
  const response=await fetch(ref.url,{signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw Error(ref.file+" download failed HTTP "+response.status);
  b=Buffer.from(await response.arrayBuffer());
  if(b.length<1e6||b.toString("ascii",0,4)!=="glTF")throw Error(ref.file+" not a GLB");
  await writeFile(dest,b);
 }
 const length=b.readUInt32LE(8);
 if(length!==b.length)throw Error(ref.file+" bad GLB length");
 const jsonLength=b.readUInt32LE(12);
 if(b.toString("ascii",16,20)!=="JSON") throw Error(ref.file+" missing JSON chunk");
 const data=JSON.parse(b.subarray(20,20+jsonLength).toString("utf8"));
 const report={file:ref.file,license:ref.license,purpose:ref.purpose,sha256:crypto.createHash("sha256").update(b).digest("hex"),bytes:b.length,
   meshes:data.meshes?.length||0, skins:data.skins?.length||0,
   animations:data.animations?.map(a=>({name:a.name,channels:a.channels?.length}))||[],
   origin:ref.url};
 console.log(JSON.stringify(report));
 if(ref.file==="sam-locomotion.glb" && (!report.skins||report.animations.length<3))throw Error("sam not a suitable animated rig");
}
