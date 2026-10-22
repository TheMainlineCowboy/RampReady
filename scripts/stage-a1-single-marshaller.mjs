import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const url="https://www.innerscene.com/api/library/locomotion-collection-sam-3d-person-animated-dc23800f/download";
const hash="288af86ec0581d78bb8dc495e036736adfc35f8c7c11dc6a0d6b538ad2c0d7b7";
const dest=path.resolve("public/models/a1-single-marshal/sam-locomotion.glb");
await fs.mkdir(path.dirname(dest),{recursive:true});
let blob;
try{blob=await fs.readFile(dest);}catch{}
if(!blob){const response=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error("CC0 source unavailable: "+response.status);blob=Buffer.from(await response.arrayBuffer());}
if(blob.toString("ascii",0,4)!=="glTF" || blob.readUInt32LE(8)!==blob.length)throw Error("Invalid glTF source");
if(crypto.createHash("sha256").update(blob).digest("hex")!==hash)throw Error("The licensed character binary changed; refusing substitution");
await fs.writeFile(dest,blob);
console.log("Verified CC0 Sam source:",blob.length,"bytes, SHA256",hash);
