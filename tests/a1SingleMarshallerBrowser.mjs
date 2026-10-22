import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {chromium} from "playwright";
const port=4197,base=`http://127.0.0.1:${port}/RampReady/`;
const out=path.resolve("artifacts/a1-single-marshaller");
const frames=path.join(out,"frames");fs.mkdirSync(frames,{recursive:true});
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port),"--strictPort"],{stdio:["ignore","pipe","pipe"]});
let logs="";for(const stream of [server.stdout,server.stderr])stream.on("data",chunk=>{logs+=String(chunk)});
async function ready(){
 for(let i=0;i<150;i++){
  if(server.exitCode!==null)throw Error("Vite stopped: "+logs);
  try{if((await fetch(base)).ok)return;}catch{}
  await new Promise(r=>setTimeout(r,200));
 }throw Error("Vite did not launch");
}
let browser;
try{
 await ready();
 browser=await chromium.launch({headless:true,args:["--enable-webgl","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:600,height:820},deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 await page.goto(base+"a1-single-marshaller.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>["true","error"].includes(document.querySelector("canvas")?.dataset.marshallerLoaded),null,{timeout:50000});
 const status=await page.locator("canvas").getAttribute("data-marshaller-loaded");
 if(status==="error")throw Error("Actual NPC model/load error: "+await page.locator("#errors").innerText()+" browser: "+JSON.stringify(errors));
 const width=Number(await page.locator("canvas").getAttribute("data-ear-fit-width"));
 assert.ok(width>.11&&width<.29,"Ear defenders must be fitted to measured human head");
 await page.evaluate(()=>window.__reviewCapture.begin());
 const distances=[7,6,5,4,3,2,1,.5,0];
 let index=0, previous=-Infinity, final;
 for(const distance of distances){
  let result;
  for(let i=0;i<10;i++){
   result=await page.evaluate(d=>window.__reviewCapture.render({distance:d,stepCount:4}),distance);
   assert.ok(result.png.length>6000,"Missing actual WebGL canvas frame");
   const buffer=Buffer.from(result.png,"base64");
   fs.writeFileSync(path.join(frames,`frame-${String(index++).padStart(3,"0")}.png`),buffer);
   if(i===9)fs.writeFileSync(path.join(out,`distance-${String(distance).replace(".","_")}m.png`),buffer);
  }
  const pose=result.metrics;
  const yRising=(pose.l.hand[1]-pose.l.shoulder[1]+pose.r.hand[1]-pose.r.shoulder[1])/2;
  assert.ok(yRising>=previous-.065,"Arms went down when tug approached "+distance+" m; wrist data "+JSON.stringify(pose));
  previous=yRising;
  if(distance>1.5){
   for(const hand of ["l","r"]){
    const p=pose[hand];assert.ok(Math.sign(p.hand[0])===Math.sign(p.shoulder[0]),
      "Approach arm crosses torso before stop "+distance+"m");
   }
  }
  console.log(JSON.stringify({distance,actual:pose.distanceMeters,progress:pose.pose.progress,
    handAboveShoulder:yRising,skullWidth:pose.headsetFit.width}));
  final=pose;
 }
 assert.ok(final.pose.crossed>.98,"At the nose gear, stop animation must cross forearms");
 for(const s of ["l","r"])assert.ok(final[s].hand[1]>final[s].shoulder[1]+.34,
    "STOP must cross the hands over the head");
 assert.ok(final.vestApplied>=1,"Body-fitted vest should remain attached");
 // Side-on view is mandatory: front views can hide ear cups floating forward
 // of the head or detached from the skull.
 const profile=await page.evaluate(()=>window.__reviewCapture.render({distance:7,stepCount:70,angle:90}));
 fs.writeFileSync(path.join(out,"earfit-profile.png"),Buffer.from(profile.png,"base64"));
 assert.ok(profile.png.length>6000,"Missing ear-protector profile render");
 assert.deepEqual(errors,[],"Browser must have no uncaught errors");
 await page.evaluate(()=>window.__reviewCapture.end());
 console.log(JSON.stringify({passed:true,frames:index,states:distances,humanModel:"CC0 actual skinned person; one NPC; distance linked",output:out}));
}finally{await browser?.close();server.kill("SIGTERM");}
