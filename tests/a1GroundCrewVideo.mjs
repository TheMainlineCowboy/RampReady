// Captures real frames from the *same* animated Three.js characters and
// belt-loader scene used by the A1 simulator. Not an AI-rendered video.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";
import {chromium} from "playwright";

const port=4193;
const base=`http://127.0.0.1:${port}/RampReady/`;
const out=path.resolve("artifacts/a1-crew/video");
fs.mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port),"--strictPort"],{
 stdio:["ignore","pipe","pipe"],
});
let log="";
for(const stream of [server.stdout,server.stderr])stream.on("data",chunk=>{log+=String(chunk)});
async function waitForServer(){
 for(let i=0;i<150;i++){
  if(server.exitCode!==null)throw Error("Vite stopped: "+log);
  try{if((await fetch(base)).ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error("Vite server did not start: "+log);
}
let browser;
try{
 await waitForServer();
 browser=await chromium.launch({headless:true,args:[
  "--enable-webgl","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader",
 ]});
 const page=await browser.newPage({viewport:{width:520,height:740},deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",error=>errors.push(String(error)));
 await page.goto(base+"a1-crew-preview.html",{waitUntil:"domcontentloaded",timeout:60000});
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.a1HumanStatus==="ready",null,{timeout:120000});
 await page.evaluate(()=>window.__a1Capture.begin());
 const frames=125; // 18.75 simulated seconds, including a STOP cue near the end.
 let last;
 for(let i=0;i<frames;i++){
  // Advance THREE actual animation/render code in deterministic .05s steps.
  // Rendering doesn't depend on CI video recording speed.
  const result=await page.evaluate(options=>window.__a1Capture.next(options),{
    steps:3,stop:i>=111,
  });
  assert.equal(result.humanStatus,"ready");
  fs.writeFileSync(path.join(out,`frame-${String(i).padStart(3,"0")}.png`),
    Buffer.from(result.image,"base64"));
  if(i===12 || i===104 || i===119){
    const labels={12:"belt-loader-servicing",104:"marshaller-approach",119:"marshaller-stop"};
    fs.copyFileSync(path.join(out,`frame-${String(i).padStart(3,"0")}.png`),
      path.join("artifacts/a1-crew",labels[i]+".png"));
  }
  last=result;
 }
 assert.equal(last.clear,true,"Actual service equipment and crew must be clear");
 assert.equal(last.signal,"stop","Final guide-in sequence should be STOP");
 assert.deepEqual(errors,[],"There must not be uncaught browser errors");
 await page.evaluate(()=>window.__a1Capture.end());
 const cmd=["-y","-hide_banner","-loglevel","error","-framerate","8",
  "-i",path.join(out,"frame-%03d.png"),"-c:v","libx264","-preset","fast",
  "-crf","22","-pix_fmt","yuv420p","-movflags","+faststart",
  "artifacts/a1-crew/RampReady-A1-real-NPCs.mp4"];
 const encoder=spawnSync("ffmpeg",cmd,{encoding:"utf8",timeout:180000});
 if(encoder.status!==0) {
  // Ubuntu runners don't always have ffmpeg installed. Preserve the exact
  // renderer frames; they can be losslessly handed to a local MP4 encoder.
  console.warn("MP4 assembly unavailable on runner; exporting real PNG frames.",encoder.error?.message||encoder.stderr||encoder.status);
 } else {
  const video=fs.statSync("artifacts/a1-crew/RampReady-A1-real-NPCs.mp4");
  assert.ok(video.size>10000,"MP4 should not be empty");
 }
 console.log(JSON.stringify({pass:true,frames,
  simulatedSeconds:last.elapsed,actualHumans:true,finalSignal:last.signal}));
}finally{
 await browser?.close();
 server.kill("SIGTERM");
}
