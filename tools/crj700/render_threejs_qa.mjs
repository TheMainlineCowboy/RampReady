#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const repoRoot = path.resolve(process.cwd());
const outputDir = path.resolve(process.argv[2] || 'dist/crj700');
const modelRelative = 'dist/crj700/american_eagle_crj700_rampready_accurate.glb';
const modelPath = path.join(repoRoot, modelRelative);
if (!fs.existsSync(modelPath)) throw new Error(`Model not found: ${modelPath}`);
fs.mkdirSync(outputDir, { recursive: true });

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#eef1f4}canvas{display:block;width:100%;height:100%}
#status{position:fixed;left:18px;top:16px;padding:8px 12px;background:rgba(255,255,255,.9);border:1px solid #9da5ad;border-radius:8px;font:600 18px system-ui;color:#252a30;z-index:2}
</style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head>
<body><div id="status">Loading actual GLB…</div><canvas id="c"></canvas><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(1200,800,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xeef1f4);
const camera=new THREE.PerspectiveCamera(34,1200/800,0.05,220);
scene.add(new THREE.HemisphereLight(0xffffff,0x6f7780,2.25));
const key=new THREE.DirectionalLight(0xffffff,4.8);key.position.set(18,28,24);key.castShadow=true;scene.add(key);
const fill=new THREE.DirectionalLight(0xdbe8ff,2.0);fill.position.set(-24,14,18);scene.add(fill);
const rim=new THREE.DirectionalLight(0xfff2df,1.7);rim.position.set(0,12,-28);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.MeshStandardMaterial({color:0xd7dce1,roughness:0.94,metalness:0}));
floor.rotation.x=-Math.PI/2;floor.position.y=-0.02;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(70,35,0xb8bec5,0xcbd0d5);grid.position.y=-0.01;grid.material.transparent=true;grid.material.opacity=.30;scene.add(grid);
const views={
 'front-left':{p:[22,12,26],t:[0,3.15,0]},'front-right':{p:[-22,12,26],t:[0,3.15,0]},
 'left-side':{p:[-37,7,0],t:[0,3.0,0]},'right-side':{p:[37,7,0],t:[0,3.0,0]},
 'rear':{p:[0,9,-35],t:[0,3.1,0]},'top-oblique':{p:[20,30,20],t:[0,2.7,0]},
 'bottom-oblique':{p:[-18,-12,8],t:[0,2.6,0],up:[0,0,-1],floor:false},
 'ramp-close':{p:[15,5.3,19],t:[0,3.0,5.5]},
 'logo-close':{p:[-9.5,4.5,15.5],t:[0,3.0,9.8],fov:27},
 'tail-close':{p:[-10.5,7.5,-18.5],t:[0,4.2,-12.0],fov:27},
 'gear-close':{p:[9.5,2.5,7.0],t:[0,1.4,2.5],fov:30}
};
const label=new URLSearchParams(location.search).get('view')||'front-left';
const selected=views[label]||views['front-left'];
if(selected.fov){camera.fov=selected.fov;camera.updateProjectionMatrix();}
if(selected.up)camera.up.fromArray(selected.up);
camera.position.fromArray(selected.p);camera.lookAt(...selected.t);
if(selected.floor===false){floor.visible=false;grid.visible=false;}
document.getElementById('status').textContent=label.replaceAll('-',' ');
const loader=new GLTFLoader();
loader.load('/${modelRelative}',gltf=>{
 const model=gltf.scene;scene.add(model);const livery=[];const materials=[];
 model.traverse(o=>{
  if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
  const ms=Array.isArray(o.material)?o.material:[o.material];
  for(const m of ms){
   if(!m)continue;
   if(m.map){m.map.colorSpace=THREE.SRGBColorSpace;m.map.anisotropy=8;m.map.needsUpdate=true;}
   if(/American_Eagle_Title|Registration|Tail_Livery|Aft_Sweep/.test(o.name)){
    m.alphaTest=Math.max(m.alphaTest||0,0.015);m.depthWrite=true;m.side=THREE.DoubleSide;m.needsUpdate=true;
   }
   materials.push({object:o.name,material:m.name||'',hasMap:!!m.map,transparent:!!m.transparent,alphaTest:m.alphaTest||0});
  }
  if(/American_Eagle_Title|Registration|Tail_Livery|Aft_Sweep/.test(o.name))livery.push(o.name);
 });
 const box=new THREE.Box3().setFromObject(model);const size=box.getSize(new THREE.Vector3());
 window.__QA_REPORT__={view:label,liveryNodes:livery,materials:materials.filter(x=>/American_Eagle_Title|Registration|Tail_Livery|Aft_Sweep/.test(x.object)),dimensions:{x:size.x,y:size.y,z:size.z}};
 renderer.render(scene,camera);renderer.getContext().finish();
 const ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=1200;ctx.canvas.height=800;ctx.drawImage(canvas,0,0);
 const data=ctx.getImageData(0,0,1200,800).data;let red=0,blue=0,dark=0;
 for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];if(a<20)continue;if(r>110&&r>g*1.35&&r>b*1.2)red++;if(b>80&&b>r*1.15&&b>g*1.05)blue++;if(r<110&&g<115&&b<120)dark++;}
 window.__QA_REPORT__.pixelEvidence={red,blue,dark};window.__MODEL_READY__=true;
},undefined,e=>{window.__MODEL_ERROR__=String(e);document.getElementById('status').textContent='MODEL LOAD FAILED';});
function loop(){renderer.render(scene,camera);requestAnimationFrame(loop)}loop();
</script></body></html>`;

const mime=new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.json','application/json'],['.glb','model/gltf-binary'],['.png','image/png'],['.jpg','image/jpeg']]);
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/qa.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);return;}const clean=decodeURIComponent(url.pathname).replace(/^\/+/, '');const target=path.resolve(repoRoot,clean);if(!target.startsWith(repoRoot)||!fs.existsSync(target)||fs.statSync(target).isDirectory()){res.writeHead(404);res.end('not found');return;}res.writeHead(200,{'Content-Type':mime.get(path.extname(target).toLowerCase())||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
const viewNames=['front-left','front-right','left-side','right-side','rear','top-oblique','bottom-oblique','ramp-close','logo-close','tail-close','gear-close'];
const reports=[];
for(const view of viewNames){
 await page.goto(`http://127.0.0.1:${port}/qa.html?view=${view}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__MODEL_READY__===true||window.__MODEL_ERROR__,null,{timeout:120000});
 const error=await page.evaluate(()=>window.__MODEL_ERROR__||null);if(error)throw new Error(error);
 const report=await page.evaluate(()=>window.__QA_REPORT__);reports.push(report);
 await page.locator('canvas').screenshot({path:path.join(outputDir,`threejs_${view}.png`)});
}
await browser.close();server.close();
const liveryNames=new Set(reports.flatMap(r=>r.liveryNodes));
const mapped=reports[0].materials.filter(m=>m.hasMap).length;
const maxRed=Math.max(...reports.map(r=>r.pixelEvidence.red));
const maxBlue=Math.max(...reports.map(r=>r.pixelEvidence.blue));
const failures=[];
for(const required of ['American_Eagle_Title_Right','American_Eagle_Title_Left','Registration_Right','Registration_Left','Tail_Livery_Right','Tail_Livery_Left','Aft_Sweep_Right','Aft_Sweep_Left'])if(!liveryNames.has(required))failures.push(`missing ${required}`);
if(mapped<8)failures.push(`only ${mapped}/8 livery materials have texture maps`);
if(maxRed<500||maxBlue<500)failures.push(`insufficient visible livery color evidence red=${maxRed} blue=${maxBlue}`);
const summary={passed:failures.length===0,failures,maxRed,maxBlue,reports};
fs.writeFileSync(path.join(outputDir,'threejs_livery_QA.json'),JSON.stringify(summary,null,2));
if(failures.length)throw new Error(`Three.js livery QA failed: ${failures.join('; ')}`);
console.log(`Three.js livery QA passed. Visible pixels red=${maxRed}, blue=${maxBlue}; mapped livery materials=${mapped}/8`);
