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
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.marshallerLoaded==="true",null,{timeout:80000});
 assert.equal(await page.locator("canvas").getAttribute("data-marshaller-loaded"),"true");
 await page.evaluate(()=>window.__reviewCapture.begin());
 const plan=[["hold",10],["guide",25],["slow",20],["stop",25]];
 let index=0;
 for(const [cue,count] of plan){
  for(let n=0;n<count;n++){
   const render=await page.evaluate(c=>window.__reviewCapture.render({cue:c,stepCount:4}),cue);
   assert.equal(render.cue,cue);
   // Physical check: during guide/slow, each hand must remain outside its
   // own shoulder; crossed arms are not a valid toward-guide signal.
   if((cue==="guide"||cue==="slow") && n>10){
     for(const side of ["l","r"]){
       const pose=render.metrics[side];
       const dx=pose.hand[0]-pose.shoulder[0];
       assert.ok(Math.sign(dx)===Math.sign(pose.shoulder[0]),
         cue+" crosses body: "+JSON.stringify(render.metrics));
     }
   }
   if(cue==="stop" && n>14){
     for(const side of ["l","r"]){
       const pose=render.metrics[side];
       assert.ok(pose.hand[1]>pose.shoulder[1]+.24,
         "STOP wrists must rise overhead: "+JSON.stringify(pose));
     }
   }
   const buffer=Buffer.from(render.png,"base64");
   assert.ok(buffer.length>5000,"Expected rendered nonempty PNG");
   const filename=`frame-${String(index).padStart(3,"0")}.png`;
   fs.writeFileSync(path.join(frames,filename),buffer);
   if(n===Math.floor(count/2))fs.writeFileSync(path.join(out,`${cue}.png`),buffer);
   index++;
  }
 }
 await page.evaluate(()=>window.__reviewCapture.end());
 assert.deepEqual(errors,[],"No browser errors");
 console.log(JSON.stringify({passed:true,frames:index,states:plan.map(x=>x[0]),humanModel:"CC0 rigged Sam; one NPC only",output:out}));
}finally{await browser?.close();server.kill("SIGTERM");}
