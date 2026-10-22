// CC0 human references for A1 NPC review. Do not commit these unoptimized
// binaries as project source; produce build-time files for isolated QA.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const out=path.resolve("public/models/a1-npc-preview");
await mkdir(out,{recursive:true});
const refs=[
 {file:"sam-locomotion.glb",url:"https://www.innerscene.com/api/library/locomotion-collection-sam-3d-person-animated-dc23800f/download",license:"CC0",purpose:"animated marshaller reference",sha256:"288af86ec0581d78bb8dc495e036736adfc35f8c7c11dc6a0d6b538ad2c0d7b7"},
 {file:"harper-locomotion.glb",url:"https://www.innerscene.com/api/library/locomotion-collection-harper-3d-person-animated-797e1e2a/download",license:"CC0",purpose:"animated belt-loader driver",sha256:"aa8cc1f80f09c6c110ddfcc534b245a41ec2efb0a8035e44e56b229711675db1"},
 // Drew is a static visual reference, not an animated runtime character.
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
 const digest=crypto.createHash("sha256").update(b).digest("hex");
 if(digest!==ref.sha256)throw Error(ref.file+" source checksum changed; refusing unexpected binary");
 const report={file:ref.file,license:ref.license,purpose:ref.purpose,sha256:digest,bytes:b.length,
   meshes:data.meshes?.length||0, skins:data.skins?.length||0,
   animations:data.animations?.map(a=>({name:a.name,channels:a.channels?.length}))||[],
   origin:ref.url};
 console.log(JSON.stringify(report));
 if(ref.file.includes("locomotion") && (!report.skins||report.animations.length<3))throw Error(ref.file+" not a suitable animated rig");
}
