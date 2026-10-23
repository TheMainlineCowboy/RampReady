import fs from "node:fs";
import {chromium} from "playwright";
// Temporary diagnostic against the actual deployed Pages runtime.
// Never modifies production. Captures the *first* actual asset/decoder failure.
const site=process.env.PAGE_URL||"https://themainlinecowboy.github.io/RampReady/";
const out="artifacts/a1-live-diagnostics";fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader",
]});
const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
const failures=[],consoles=[],requests=[];
page.on("requestfailed",req=>failures.push({url:req.url(),error:req.failure()?.errorText||"unknown"}));
page.on("response",r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()})});
page.on("pageerror",e=>consoles.push("pageerror: "+e));
page.on("console",msg=>{if(msg.type()==="error")consoles.push(msg.text().slice(0,1100))});
page.on("request",req=>{if(req.url().includes("/models/"))requests.push(req.url())});
try{
 await page.goto(site,{waitUntil:"domcontentloaded",timeout:60000});
 await page.getByRole("button",{name:"Start training",exact:true}).click();
 await page.waitForFunction(()=>{
  const c=document.querySelector("canvas.trainerCanvas");
  const failed=document.body.textContent?.includes("Unable to finish loading");
  return failed||c?.dataset?.kphxSurfaceReady==="true";
 },null,{timeout:180000});
 const data=await page.evaluate(()=>{
  const c=document.querySelector("canvas.trainerCanvas");
  return {error:document.querySelector(".rr-runtime-loading-card")?.innerText,
    status:c?.dataset||{},url:location.href};
 });
 const report={data,failedRequests:failures,consoleErrors:consoles,assetRequestCount:requests.length,
   uniqueAssetRequests:[...new Set(requests)].slice(0,180)};
 fs.writeFileSync(out+"/report.json",JSON.stringify(report,null,2));
 await page.screenshot({path:out+"/live-mobile-surface-result.png",fullPage:true});
 console.log("DEPLOYED SCENERY DIAGNOSTICS\n"+JSON.stringify({
  overlay:data.error,failedRequests:failures.slice(0,35),
  consoles:consoles.slice(0,15),assetCount:requests.length,
  canvas:((({runtimeLoadError,kphxExactLiveT4Error,lastFailedAssetUrl,kphxSurfaceReady})=>
    ({runtimeLoadError,kphxExactLiveT4Error,lastFailedAssetUrl,kphxSurfaceReady}))(data.status||{})),
 },null,2));
 if(failures.length||data.error?.includes("Unable to finish loading"))process.exitCode=1;
}finally{await browser.close();}
