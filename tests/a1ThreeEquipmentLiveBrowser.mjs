// Post-publish end-to-end smoke: all supported equipment and both launch
// paths must show the ACTUAL simulator, not merely an HTTP-200 HTML shell.
// This catches the "Unable to finish loading" 25% failure on GitHub Pages.
import assert from "node:assert/strict";
import fs from "node:fs";
import {chromium} from "playwright";
const base=process.env.PAGE_URL;
if(!base||!/^https:\/\//.test(base))throw Error("PAGE_URL required");
const root=base.endsWith("/")?base:base+"/";
const output="live-phx-render-evidence";
fs.mkdirSync(output,{recursive:true});
const scenarios=[
  {id:"lektro-88",name:/Lektro 88/i,button:"Start training"},
  {id:"lektro-88",name:/Lektro 88/i,button:"Drive vehicle / inspect airport"},
  {id:"standup-tug",name:/Stand-up pushback/i,button:"Start training"},
  {id:"standup-tug",name:/Stand-up pushback/i,button:"Drive vehicle / inspect airport"},
  {id:"manager-kubota",name:/Manager Kubota RTV/i,button:"Drive vehicle / inspect airport"},
];
const browser=await chromium.launch({headless:true,args:["--enable-webgl","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader"]});
const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1});
try{
  for(const task of scenarios){
    const mode=task.button==="Start training"?"training":"inspection";
    const key=task.id+"-"+mode;
    const page=await context.newPage();
    const errors=[],httpErrors=[];
    page.on("pageerror",e=>errors.push(String(e)));
    page.on("response",r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
    try{
      await page.goto(root,{waitUntil:"domcontentloaded",timeout:60000});
      await page.getByRole("radio",{name:task.name}).click();
      await page.getByRole("button",{name:task.button,exact:true}).click();
      await page.waitForFunction(()=>{
        const el=document.querySelector(".rr-runtime-loading-card h1");
        if(el?.textContent?.includes("Unable to finish loading"))return true;
        const canvas=document.querySelector("canvas.trainerCanvas");
        if(!canvas)return false;
        const d=canvas.dataset;
        return d.tugSource && d.tugSource!=="loading" && d.tugSource!=="load-error"
          && d.kphxExactLiveT4==="ready"
          && d.kphxSurfaceReady==="true"
          && d.kphxT4ZdpMarkingsReady==="true"
          && d.kphxMisterXLinesReady==="true";
      },null,{timeout:120000});
      // The canvas may be ready just before React drops its loading overlay.
      await page.locator(".rr-runtime-loading").waitFor({state:"hidden",timeout:20000});
      const result=await page.evaluate(()=>{
        const d=document.querySelector("canvas.trainerCanvas")?.dataset||{};
        return {tugSource:d.tugSource,kphxExactLiveT4:d.kphxExactLiveT4,
          surface:d.kphxSurfaceReady,markings:d.kphxT4ZdpMarkingsReady,
          lines:d.kphxMisterXLinesReady,failedUrl:d.lastFailedAssetUrl||null,
          runtimeError:d.runtimeLoadError||d.kphxExactLiveT4Error||d.tugLoadError||null,
          loadingError:document.querySelector(".rr-runtime-loading-card p")?.textContent||null};
      });
      // Screenshots can hang on busy software-GPU runners after the fully loaded
      // scene is ready; never mask the real loading assertions behind capture.
      assert.ok(!result.loadingError,key+" never finished loading: "+JSON.stringify({result,httpErrors,errors}));
      assert.equal(result.kphxExactLiveT4,"ready",key+": shared Terminal 4 missing");
      assert.equal(result.surface,"true",key+": KPHX surfaces missing");
      assert.equal(result.markings,"true",key+": KPHX markings missing");
      assert.equal(result.lines,"true",key+": KPHX painted lines missing");
      assert.equal(httpErrors.length,0,key+": missing deployed files "+JSON.stringify(httpErrors));
      assert.deepEqual(errors,[],key+": browser JavaScript errors");
      console.log("PASS",key,JSON.stringify(result));
      try{await page.screenshot({path:`${output}/live-${key}.png`,timeout:5000});}
      catch(e){console.warn("Optional screenshot unavailable for",key,String(e).slice(0,150));}
    }catch(e){
      try{await page.screenshot({path:`${output}/FAILED-${key}.png`,timeout:5000});}catch{}
      console.error("FAILED equipment mode",key,"HTTP errors",JSON.stringify(httpErrors.slice(0,15)),String(e));
      throw e;
    }finally{await page.close();}
  }
}finally{await context.close();await browser.close();}
