// Tests the exported, real Three.js simulator on a mobile-sized Chromium
// screen (not a generated illustration). The option is hidden for ordinary users.
import assert from "node:assert/strict";
import fs from "node:fs";
import {spawn} from "node:child_process";
import {chromium} from "playwright";
const port=4183, base=`http://127.0.0.1:${port}/RampReady/`;
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port),"--strictPort"],{stdio:["ignore","pipe","pipe"]});
let log="";for(const stream of [server.stdout,server.stderr])stream.on("data",c=>{log+=String(c)});
async function started(){for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error("vite died "+log);try{const r=await fetch(base);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error("vite never responded "+log);}
let browser;
try{
 await started();
 browser=await chromium.launch({headless:true,args:["--enable-webgl","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 await page.goto(base,{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Start training"}).waitFor({timeout:60000});
 // A normal visit cannot activate the preview scene.
 assert.equal(await page.locator("[data-a1-crew-preview='active']").count(),0);
 await page.goto(base+"?crewPreview=1",{waitUntil:"domcontentloaded"});
 const launch=page.getByRole("button",{name:"Start training"});
 await launch.waitFor({timeout:45000});await launch.click();
 const canvas=page.locator("canvas.trainerCanvas[data-a1-crew-preview='active']");
 await canvas.waitFor({timeout:120000});
 await page.getByRole("button",{name:"Wait for ground crew"}).waitFor({timeout:10000});
 assert.equal(await page.getByRole("button",{name:"Wait for ground crew"}).isDisabled(),true);
 fs.mkdirSync("artifacts/a1-crew",{recursive:true});
 await page.waitForTimeout(1200);
 // Capture the REAL WebGL drawing surface, not the large runtime-loading UI.
 await canvas.screenshot({path:"artifacts/a1-crew/a1-belt-loader-servicing-mobile.png"});
 await page.waitForFunction(()=>document.querySelector("canvas.trainerCanvas")?.dataset.a1CrewClear==="true",null,{timeout:120000});
 assert.equal(await page.getByRole("button",{name:"Ready",exact:true}).isEnabled(),true);
 const dataset=await canvas.evaluate(el=>({phase:el.dataset.a1CrewPhase,signal:el.dataset.a1CrewSignal,loaderMeters:el.dataset.a1CrewBeltLoaderMeters}));
 assert.equal(dataset.phase,"ready");
 assert.ok(Number(dataset.loaderMeters)>10,"belt loader actually traveled clear");
 await canvas.screenshot({path:"artifacts/a1-crew/a1-crew-cleared-mobile.png"});
 assert.deepEqual(errors,[], "No uncaught errors in the preview runtime");
 console.log("PASS real Three.js preview: NPCs present; belt loader cleared; tug/Ready held until guide arrived",dataset);
}finally{await browser?.close();server.kill("SIGTERM");}
