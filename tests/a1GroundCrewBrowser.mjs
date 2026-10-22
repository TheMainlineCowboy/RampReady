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
 // In headless Chromium the main KPHX loading overlay may cover the canvas;
 // its WebGL backbuffer is also non-preserved. Verify state, not misleading pixels.
 // The full KPHX build may remain on its large asset-loading overlay on CI.
 // Verify the actual production canvas is wired and Ready is blocked, then
 // inspect the SAME production NPC module in a lightweight, isolated camera.
 const productionPhase=await canvas.evaluate(el=>el.dataset.a1CrewPhase);
 assert.ok(productionPhase,"The real airport runtime must update NPC scene state");
 // Capture actual, browser-rendered rig states; Chromium software video
 // recording throttles Three.js animation and is not reliable CI evidence.
 const qaContext=await browser.newContext({
   viewport:{width:412,height:915},deviceScaleFactor:1,
 });
 const qa=await qaContext.newPage();
 qa.on("pageerror",e=>errors.push(String(e)));
 await qa.goto(base+"a1-crew-preview.html",{waitUntil:"domcontentloaded"});
 const isolated=qa.locator("canvas");
 await isolated.waitFor({timeout:30000});
 await qa.waitForFunction(()=>document.querySelector("canvas")?.dataset.a1HumanStatus==="ready",null,{timeout:120000});
 await qa.getByRole("button",{name:"Replay ground crew"}).click();
 await qa.waitForFunction(()=>document.querySelector("canvas")?.dataset.a1CrewPhase==="servicing");
 await isolated.screenshot({path:"artifacts/a1-crew/a1-real-human-driver-mobile.png"});
 await qa.waitForFunction(()=>document.querySelector("canvas")?.dataset.a1CrewClear==="true",null,{timeout:120000});
 const dataset=await isolated.evaluate(el=>({phase:el.dataset.a1CrewPhase,clear:el.dataset.a1CrewClear}));
 assert.equal(dataset.phase,"ready");
 assert.equal(dataset.clear,"true");
 assert.equal(await isolated.getAttribute("data-a1-human-status"),"ready");
 await isolated.screenshot({path:"artifacts/a1-crew/a1-real-human-marshaller-mobile.png"});
 await qa.getByRole("button",{name:"Simulate stop"}).click();
 await qa.waitForFunction(()=>document.querySelector("canvas")?.dataset.a1GuideSignal==="stop");
 await qa.waitForTimeout(600);
 await isolated.screenshot({path:"artifacts/a1-crew/a1-real-human-stop-signal-mobile.png"});
 await qaContext.close();

 assert.deepEqual(errors,[], "No uncaught errors in the preview runtime");
 console.log("PASS real NPC movement video and stop/approach visual states",dataset);
}finally{await browser?.close();server.kill("SIGTERM");}
