// Build-only mobile texture derivatives. Original WED/X-Plane photos, decals,
// manifests and SHA-verified source assets remain untouched on disk and in Git.
// Mobile users get the same authored textures resampled to 1024 px max to avoid
// enormous GPU uploads (4096x4096 RGBA == 64 MiB *per map*) on phones.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
const publicRoot=path.resolve("public");
const root=path.join(publicRoot,"models/kphx-full-airport");
const manifests=["surfaces","t4-a1-zdp-surfaces","full-zdp-surfaces"];
const files=new Map();
const asLocal=url=>{
 if(!url?.startsWith("/models/kphx-full-airport/")||url.includes("..")||url.includes("?"))
   throw Error("Unsafe surface asset URL: "+url);
 return path.join(publicRoot,url.slice(1));
};
for(const folder of manifests){
 const manifest=JSON.parse(await fs.readFile(path.join(root,folder,"manifest.json"),"utf8"));
 for(const [name,art] of Object.entries(manifest.resources||{})){
  const refs=[art.texture,art.normal,...(art.decal?.decals||[]).map(x=>x.image)].filter(Boolean);
  for(const image of refs){
   const url=image.runtimeUrl||art.outputBaseUrl+"/"+image.outputName;
   if(!url.endsWith(".png"))throw Error("Expected PNG surface image "+url+" from "+name);
   if(Math.max(image.width||0,image.height||0)<=1024)continue;
   const destUrl=url.replace(/\.png$/,"-mobile.png");
   const existing=files.get(destUrl);
   if(existing && existing.src!==url)throw Error("Conflicting output mobile texture "+destUrl);
   files.set(destUrl,{src:url,dest:destUrl,folder});
  }
 }
}
let origBytes=0,derivedBytes=0,count=0;
const evidence=[];
for(const {src,dest} of files.values()){
 const srcFile=asLocal(src),destFile=asLocal(dest);
 const metadata=await sharp(srcFile).metadata();
 if(metadata.format!=="png"||!metadata.width||!metadata.height)throw Error("Invalid source PNG "+src);
 const original=await fs.readFile(srcFile);
 const sha=crypto.createHash("sha256").update(original).digest("hex");
 // Resizing original authorized materials: not substituting a new texture.
 await fs.mkdir(path.dirname(destFile),{recursive:true});
 const result=await sharp(original,{limitInputPixels:268435456})
  .resize({width:1024,height:1024,fit:"inside",kernel:"lanczos3",withoutEnlargement:true})
  .png({compressionLevel:8,palette:false}).toBuffer();
 const outInfo=await sharp(result).metadata();
 if(outInfo.width>1024||outInfo.height>1024)throw Error("Bad mobile texture dimensions "+dest);
 await fs.writeFile(destFile,result);
 origBytes+=original.length;derivedBytes+=result.length;count++;
 evidence.push({source:src,mobile:dest,sourceSha256:sha,originalBytes:original.length,
  mobileBytes:result.length,size:[metadata.width,metadata.height],
  mobileSize:[outInfo.width,outInfo.height]});
}
if(count<5)throw Error("No mobile KPHX texture variants were generated");
const reportPath=path.resolve("artifacts/a1-mobile-textures/report.json");
await fs.mkdir(path.dirname(reportPath),{recursive:true});
await fs.writeFile(reportPath,JSON.stringify({count,origBytes,derivedBytes,savedPct:
  +(100*(1-derivedBytes/origBytes)).toFixed(1),files:evidence},null,2));
console.log("A1 mobile 1024px texture variants",JSON.stringify({count,origBytes,derivedBytes,
  savedPct:+(100*(1-derivedBytes/origBytes)).toFixed(1)}));
