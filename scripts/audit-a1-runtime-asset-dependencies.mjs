// A1/Terminal4 dependency integrity gate.
//
// Inspect EVERY transitive GLTF buffer/image and every surface texture consumed
// by the A1 live environment, rather than only checking top-level manifests.
// Validate local assets before upload and deployed HTTP HEAD URLs after upload.
// Asset checks must fail CI; never remove the original approved source assets.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {KPHX_T4_EXACT_GSE_AUTHORITY as GSE} from "../src/environment/kphxFullAirport/terminal4GseAuthority.js";
import {KPHX_T4_EXACT_STATIC_PROP_AUTHORITY as PROPS} from "../src/environment/kphxFullAirport/terminal4StaticPropAuthority.js";

const root=process.cwd();
const publicRoot=path.join(root,"public");
const live=process.argv.includes("--live");
const dist=process.argv.includes("--dist");
const reportPath=process.env.A1_DEPENDENCY_REPORT||"artifacts/a1-asset-audit/report.json";
const base=process.env.PAGE_URL||"https://themainlinecowboy.github.io/RampReady/";
const manifestSets=[
 ["batches/structures.manifest.json",new Set(["Terminals/Terminal4.obj","Terminals/Terminal4b.obj"])],
 ["batches/t4-misterx.manifest.json",new Set([
   ...GSE.misterX.resources,...PROPS.misterXRamps.resources,...PROPS.misterXConstruction.resources
 ])],
 ["batches/t4-cdb.manifest.json",new Set(GSE.cdb.resources)],
 ["batches/airfield-details.manifest.json",new Set(PROPS.packageLights.resources)],
];
const surfaceSets=[
 ["surfaces",()=>true],
 ["t4-a1-zdp-surfaces",()=>true],
 ["full-zdp-surfaces",name=>name.startsWith("ZDP_Library/markings/")],
];
const urls=new Map();
function add(url,why,expectSize=null,expectSha=null) {
 if(!url)return;
 if(!url.startsWith("/models/"))throw Error("Unexpected asset path: "+url+" "+why);
 if(url.includes("..")||url.includes("\\"))throw Error("Unsafe manifest asset path: "+url);
 let data=urls.get(url);
 if(!data){data={url,why:[],expectSize,expectSha};urls.set(url,data);}
 data.why.push(why);
 if(expectSize!=null){
  if(data.expectSize!=null && data.expectSize!==expectSize)throw Error("Conflicting expected asset size "+url);
  data.expectSize=expectSize;
 }
 if(expectSha){
  if(data.expectSha && data.expectSha!==expectSha)throw Error("Conflicting SHA "+url);
  data.expectSha=expectSha;
 }
}
function readPublic(url){return fs.readFileSync(path.join(publicRoot,url.slice(1)));}
const missing=[],invalid=[],oversize=[],liveErrors=[];
function imageUris(j){return (j.images||[]).map(i=>i.uri).filter(Boolean);}
for(const [manifestFile,needed] of manifestSets) {
 const uri="/models/kphx-full-airport/"+manifestFile;
 add(uri,"object manifest");
 const j=JSON.parse(readPublic(uri));
 const placements=[
  ...(j.packageOwned?.placements||[]),...(j.resolvedExternal?.placements||[])
 ].filter(p=>needed.has(p.resource));
 assert.ok(placements.length>0,"No selected WED objects in "+uri);
 for(const assetUrl of new Set(placements.map(x=>x.assetUrl))) {
  add(assetUrl,"3D model used by "+manifestFile);
  const src=JSON.parse(readPublic(assetUrl));
  const dir=path.posix.dirname(assetUrl);
  for(const b of src.buffers||[])if(b.uri)add(dir+"/"+b.uri,"GLTF buffer of "+assetUrl,b.byteLength);
  for(const img of imageUris(src))add(dir+"/"+img,"GLTF image of "+assetUrl);
 }
}
for(const [folder,selection] of surfaceSets) {
 const prefix="/models/kphx-full-airport/"+folder;
 add(prefix+"/manifest.json","surface manifest");
 add(prefix+"/surface-network.json","WED polygon/line placement network");
 const j=JSON.parse(readPublic(prefix+"/manifest.json"));
 assert.equal(j.failures?.length||0,0,"Source surface materialization failures "+folder);
 for(const [resource,art] of Object.entries(j.resources||{})){
  if(!selection(resource))continue;
  const images=[art.texture,art.normal,
    ...((art.decal?.decals||[]).map(x=>x.image))].filter(Boolean);
  for(const img of images){
   const url=img.runtimeUrl||art.outputBaseUrl+"/"+img.outputName;
   add(url,"surface "+folder+" "+resource,img.outputBytes||null,img.outputSha256||null);
  }
 }
}
let checkedBytes=0;
for(const entry of urls.values()) {
 const filename=path.join(publicRoot,entry.url.slice(1));
 if(!fs.existsSync(filename)){missing.push(entry);continue;}
 const stat=fs.statSync(filename);
 if(!stat.isFile()||stat.size===0){invalid.push({...entry,detail:"not a regular nonempty file"});continue;}
 checkedBytes+=stat.size;
 if(entry.expectSize!=null && entry.expectSize!==stat.size)
   invalid.push({...entry,detail:"expected "+entry.expectSize+" bytes, observed "+stat.size});
 if(entry.url.endsWith(".png")){
  const header=Buffer.alloc(8);
  const fd=fs.openSync(filename,"r");try{fs.readSync(fd,header,0,8,0)}finally{fs.closeSync(fd)}
  if(!header.equals(Buffer.from([137,80,78,71,13,10,26,10])))
    invalid.push({...entry,detail:"not a valid PNG header"});
 }
 if(entry.url.endsWith(".glb")){
  const header=Buffer.alloc(4);
  const fd=fs.openSync(filename,"r");try{fs.readSync(fd,header,0,4,0)}finally{fs.closeSync(fd)}
  if(header.toString("ascii")!=="glTF")
    invalid.push({...entry,detail:"not a GLB header"});
 }
}
// Most important main apron texture: verify exact source hash, not existence.
for(const entry of urls.values()){
 if(!entry.expectSha||!entry.url.includes("/surfaces/resources/"))continue;
 const full=path.join(publicRoot,entry.url.slice(1));
 if(!fs.existsSync(full))continue;
 const digest=crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
 if(digest!==entry.expectSha)invalid.push({...entry,detail:"surface image SHA mismatch"});
}
async function checkOne(e){
 const link=new URL(e.url.replace(/^\//,""),base).href;
 try{
  const res=await fetch(link,{method:"HEAD",signal:AbortSignal.timeout(19000),
    headers:{"Cache-Control":"no-cache"}});
  let size=Number(res.headers.get("content-length")||0);
  if(!res.ok)throw Error("HTTP "+res.status+" "+res.statusText);
  if(size>0 && e.expectSize!=null && size!==e.expectSize)
    throw Error("live "+size+" bytes != original "+e.expectSize);
  return null;
 }catch(err){return {url:e.url,error:String(err),why:e.why.slice(0,4)};}
}
if(live){
 let todo=[...urls.values()],index=0;
 const workers=Array.from({length:8},async()=>{
  while(index<todo.length){
   const e=todo[index++];const result=await checkOne(e);
   if(result)liveErrors.push(result);
  }
 });
 await Promise.all(workers);
}
const report={
 mode:live?"live-and-local":dist?"dist-local":"local",
 checkedUrls:urls.size,checkedBytes,
 missing,invalid,liveErrors,byExtension:{},
 sampleUrls:[...urls.values()].slice(0,18),
};
for(const e of urls.values()){
 const suffix=e.url.split(".").pop();
 report.byExtension[suffix]=(report.byExtension[suffix]||0)+1;
}
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({status:missing.length||invalid.length||liveErrors.length?"FAIL":"PASS",
  checkedUrls:report.checkedUrls,checkedBytes,missing:missing.length,
  invalid:invalid.length,liveErrors:liveErrors.length,
  byExtension:report.byExtension,sampleFailures:[...missing,...invalid,...liveErrors].slice(0,15)},null,2));
if(missing.length||invalid.length||liveErrors.length)process.exitCode=1;
