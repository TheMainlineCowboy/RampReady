// Full locally staged Pages build, simulated Android phone, real WebGL pixels.
// Fails if page only returns HTTP 200 while the loading overlay remains stuck.
import {spawn} from "node:child_process";
import fs from "node:fs";
import {chromium} from "playwright";
import assert from "node:assert/strict";
// Test local packaged site in PR and the *real* Pages URL after deployment.
const live=Boolean(process.env.PAGE_URL);
const base=live?new URL(".",process.env.PAGE_URL.endsWith("/")?process.env.PAGE_URL:process.env.PAGE_URL+"/").href:"http://127.0.0.1:4198/RampReady/";
const out="artifacts/a1-mobile-load";
fs.mkdirSync(out,{recursive:true});
const server=live?null:spawn(process.execPath,["node_modules/vite/bin/vite.js","preview",
 "--host","127.0.0.1","--port","4198","--strictPort"],{stdio:["ignore","pipe","pipe"]});
let startup="";if(server)for(const stream of [server.stdout,server.stderr])stream.on("data",x=>startup+=String(x));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){
  if(server&&server.exitCode!==null)throw Error("Vite preview exited: "+startup);
  try{const response=await fetch(base);if(response.ok){ready=true;break;}}catch{}
  await sleep(180);
 }
 if(!ready)throw Error("Vite preview never opened: "+startup);
 browser=await chromium.launch({headless:true,args:[
  "--enable-webgl","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader",
 ]});
 const ctx=await browser.newContext({
  viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  userAgent:"Mozilla/5.0 (Linux; Android 17; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36",
 });
 const page=await ctx.newPage();
 const failed=[],mobileUrls=[],consoleErrors=[];
 page.on("response",res=>{if(res.status()>=400)failed.push({status:res.status(),url:res.url()})});
 page.on("requestfailed",req=>failed.push({url:req.url(),detail:req.failure()?.errorText}));
 page.on("request",req=>{if(req.url().includes("-mobile.png"))mobileUrls.push(req.url())});
 page.on("pageerror",e=>consoleErrors.push(String(e)));
 try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:60000});
  await page.getByRole("button",{name:"Start training",exact:true}).click();
  await page.waitForFunction(()=>{
   const c=document.querySelector("canvas.trainerCanvas");
   if(document.querySelector(".rr-runtime-loading-card h1")?.textContent?.includes("Unable to finish loading"))return true;
   return c?.dataset?.kphxSurfaceReady==="true"&&c?.dataset?.kphxExactLiveT4==="ready"
    &&c?.dataset?.kphxT4ZdpMarkingsReady==="true"
    &&c?.dataset?.kphxMisterXLinesReady==="true";
  },null,{timeout:180000});
  let overlayCleared=true;
  try{await page.locator(".rr-runtime-loading").waitFor({state:"hidden",timeout:15000})}
  catch{overlayCleared=false}
  const info=await page.evaluate(()=>{
   const data=document.querySelector("canvas.trainerCanvas")?.dataset||{};
   return {surfaceReady:data.kphxSurfaceReady,terminal:data.kphxExactLiveT4,
    zdp:data.kphxT4ZdpMarkingsReady,lines:data.kphxMisterXLinesReady,
    mobileTextureCount:data.kphxSurfaceMobileTextureCount,
    sourceTextureCount:data.kphxSurfaceOriginalTextureCount,
    failure:data.kphxSurfaceLoadError||data.runtimeLoadError||data.kphxExactLiveT4Error,
    overlay:document.querySelector(".rr-runtime-loading-card")?.innerText||"",
    mode:data.a1MarshallerMode};
  });
  // Save the factual result before attempting heavyweight raster screenshot.
  // SwiftShader can stall page.screenshot even after the entire scene loaded.
  fs.writeFileSync(out+"/report.json",JSON.stringify({info,overlayCleared,failed,
   mobileRequests:[...new Set(mobileUrls)],consoleErrors},null,2));
  console.log("Android full simulator",JSON.stringify({info,overlayCleared,failedCount:failed.length,
   mobileRequests:new Set(mobileUrls).size,errors:consoleErrors.slice(0,4)}));
  assert.ok(overlayCleared,"Mobile loading overlay did not clear");
  assert.equal(info.surfaceReady,"true","Mobile KPHX surfaces failed: "+info.failure);
  assert.equal(info.terminal,"ready","Exact A1 terminal did not finish");
  assert.ok(Number(info.mobileTextureCount)>=3,
   "Actual mobile surfaces did not use the generated 1024px textures");
  assert.ok(new Set(mobileUrls).size>=3,
   "The browser never requested mobile-friendly KPHX textures");
  assert.deepEqual(failed,[],"Missing or rejected live local-model dependencies");
  assert.deepEqual(consoleErrors,[],"Browser script threw an error");
  // Optional visual evidence cannot invalidate successful runtime checks.
  try{await page.screenshot({path:out+"/real-android-webgl.png",timeout:8000,animations:"disabled"});}
  catch(err){console.warn("Optional browser screenshot timed out; actual scene assertions passed:",String(err).slice(0,240));}
 }finally{await page.close();await ctx.close();}
}finally{await browser?.close();server?.kill("SIGTERM");}
