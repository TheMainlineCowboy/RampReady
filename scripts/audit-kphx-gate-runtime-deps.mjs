// Read-only audit of the ACTUAL gate-scene dependency closure.
// A *.gltf is not valid in deployment unless its adjacent *.bin and every
// referenced texture/image exist as well. Check the 21-gate Terminal 4 set,
// not just the currently selected A1 tug/aircraft GLB.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const workspace=process.cwd();
const root=path.resolve(workspace,process.argv[2]||"public");
const manifests=[
  "models/kphx-full-airport/batches/t4-misterx.manifest.json",
  "models/kphx-full-airport/batches/t4-cdb.manifest.json",
  "models/kphx-full-airport/batches/structures.manifest.json",
  "models/kphx-full-airport/batches/airfield-details.manifest.json",
  "models/kphx-full-airport/batches/gate-numbers.manifest.json",
];
const failures=[],checked=new Map(),requiredGlbUrls=new Set();
const internalAssetPath=(relative)=>{
  const normalized=relative.replace(/^\//,"");
  const resolved=path.resolve(root,normalized);
  if(!resolved.startsWith(root+path.sep))throw Error("Unsafe asset reference "+relative);
  return resolved;
};
const record=(url,expectedLength=null,sha=null)=>{
  const file=internalAssetPath(url);
  let stat;
  try{stat=fs.statSync(file);}catch{failures.push("Missing: "+url);return;}
  if(!stat.isFile()||stat.size===0){failures.push("Empty or non-file: "+url);return;}
  if(expectedLength!=null&&stat.size!==expectedLength)
    failures.push("Incorrect byte length "+url+" "+stat.size+" vs "+expectedLength);
  if(sha&&crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")!==sha)
    failures.push("Checksum mismatch: "+url);
  checked.set(url,stat.size);
};
for(const manifest of manifests){
  const data=JSON.parse(fs.readFileSync(internalAssetPath(manifest),"utf8"));
  const resources={...data.packageOwned?.resources,...data.resolvedExternal?.resources};
  const placements=[...(data.packageOwned?.placements||[]),...(data.resolvedExternal?.placements||[])];
  if(!placements.length)throw Error("Runtime manifest contains no source placements: "+manifest);
  for(const placement of placements){
    const uri=placement.assetUrl;
    if(!uri?.endsWith(".gltf"))continue;
    if(requiredGlbUrls.has(uri))continue;
    requiredGlbUrls.add(uri);
    const modelPath=uri.replace(/^\//,"");
    record(modelPath);
    if(!fs.existsSync(internalAssetPath(modelPath)))continue;
    const gltf=JSON.parse(fs.readFileSync(internalAssetPath(modelPath),"utf8"));
    const prefix=modelPath.slice(0,modelPath.lastIndexOf("/")+1);
    const resource=resources[placement.resource]||null;
    for(const buffer of gltf.buffers||[]){
      if(!buffer.uri||buffer.uri.startsWith("data:"))continue;
      record(prefix+buffer.uri,buffer.byteLength,
        buffer.uri.endsWith(".bin") ? resource?.binSha256||null : null);
    }
    for(const image of gltf.images||[]){
      if(!image.uri||image.uri.startsWith("data:"))continue;
      record(prefix+image.uri);
    }
  }
}
// Additional source files are not deleted or declared obsolete by this audit.
const summary={
  root,manifestCount:manifests.length,
  uniqueModels:requiredGlbUrls.size,
  uniqueDependentFiles:checked.size-requiredGlbUrls.size,
  bytes: [...checked.values()].reduce((a,b)=>a+b,0),
  failures,
};
console.log(JSON.stringify(summary,null,2));
assert.ok(requiredGlbUrls.size>=30,"Expected every authored T4 resource, not an A1-only subset");
assert.deepEqual(failures,[],"Required glTF or linked bin/texture missing or altered");
