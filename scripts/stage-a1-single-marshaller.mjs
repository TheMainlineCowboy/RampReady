// Stage the original CC0 Sam GLB. Reuse our own previously deployed,
// checksum-verified Pages copy before falling back to its upstream host.
// An intermittent upstream HTTP 525 must not block unchanged game releases.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const sources=[
  "https://themainlinecowboy.github.io/RampReady/models/a1-single-marshal/sam-locomotion.glb",
  "https://www.innerscene.com/api/library/locomotion-collection-sam-3d-person-animated-dc23800f/download",
];
const hash="288af86ec0581d78bb8dc495e036736adfc35f8c7c11dc6a0d6b538ad2c0d7b7";
const dest=path.resolve("public/models/a1-single-marshal/sam-locomotion.glb");

function verified(buffer){
  return buffer?.length>=20 && buffer.toString("ascii",0,4)==="glTF" &&
    buffer.readUInt32LE(8)===buffer.length &&
    crypto.createHash("sha256").update(buffer).digest("hex")===hash;
}
await fs.mkdir(path.dirname(dest),{recursive:true});
let blob;
try{
  const local=await fs.readFile(dest);
  if(verified(local))blob=local;
}catch{}
const errors=[];
if(!blob){
  for(const url of sources){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
      if(!response.ok)throw Error("HTTP "+response.status);
      const incoming=Buffer.from(await response.arrayBuffer());
      if(!verified(incoming))throw Error("GLB v2 structure or SHA256 mismatch");
      blob=incoming;
      console.log("Verified original Sam binary from",new URL(url).host);
      break;
    }catch(error){
      errors.push(new URL(url).host+": "+String(error));
      console.warn("Sam download candidate rejected:",errors.at(-1));
    }
  }
}
if(!blob)throw Error("No original checksum-verified Sam model available: "+errors.join(" | "));
await fs.writeFile(dest,blob);
console.log("Verified CC0 Sam source:",blob.length,"bytes, SHA256",hash);
