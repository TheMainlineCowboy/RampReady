import fs from "node:fs";

const glbPath="public/models/crj700-user.glb";
const outPath="reports/crj700-door-geometry-inspection.json";
const buffer=fs.readFileSync(glbPath);
if(buffer.toString("utf8",0,4)!=="glTF") throw new Error("Not a GLB");
let offset=12,json=null;
while(offset+8<=buffer.length){
  const len=buffer.readUInt32LE(offset);
  const type=buffer.readUInt32LE(offset+4);
  const start=offset+8,end=start+len;
  if(type===0x4E4F534A){
    json=JSON.parse(buffer.toString("utf8",start,end).replace(/\u0000+$/g,"").trim());
    break;
  }
  offset=end;
}
if(!json) throw new Error("Missing GLB JSON chunk");

const nodes=json.nodes||[];
const meshes=json.meshes||[];
const accessors=json.accessors||[];
const parents=new Map();
nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));

function matMul(a,b){
  const o=new Array(16).fill(0);
  for(let r=0;r<4;r++) for(let c=0;c<4;c++) for(let k=0;k<4;k++) o[c*4+r]+=a[k*4+r]*b[c*4+k];
  return o;
}
function trs(n){
  if(n.matrix) return [...n.matrix];
  const t=n.translation||[0,0,0], q=n.rotation||[0,0,0,1], s=n.scale||[1,1,1];
  const [x,y,z,w]=q;
  const xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
  return [
    (1-2*(yy+zz))*s[0], (2*(xy+wz))*s[0], (2*(xz-wy))*s[0], 0,
    (2*(xy-wz))*s[1], (1-2*(xx+zz))*s[1], (2*(yz+wx))*s[1], 0,
    (2*(xz+wy))*s[2], (2*(yz-wx))*s[2], (1-2*(xx+yy))*s[2], 0,
    t[0],t[1],t[2],1
  ];
}
const worldMemo=new Map();
function worldMatrix(i){
  if(worldMemo.has(i)) return worldMemo.get(i);
  const local=trs(nodes[i]||{});
  const p=parents.get(i);
  const m=p===undefined?local:matMul(worldMatrix(p),local);
  worldMemo.set(i,m); return m;
}
function transformPoint(m,p){
  const [x,y,z]=p;
  return [
    m[0]*x+m[4]*y+m[8]*z+m[12],
    m[1]*x+m[5]*y+m[9]*z+m[13],
    m[2]*x+m[6]*y+m[10]*z+m[14],
  ];
}
function boundsForNode(i){
  const n=nodes[i];
  if(!Number.isInteger(n?.mesh)) return null;
  const mesh=meshes[n.mesh];
  const m=worldMatrix(i);
  const mins=[Infinity,Infinity,Infinity], maxs=[-Infinity,-Infinity,-Infinity];
  let primitiveCount=0;
  for(const prim of mesh?.primitives||[]){
    const ai=prim.attributes?.POSITION;
    const a=Number.isInteger(ai)?accessors[ai]:null;
    if(!a?.min||!a?.max) continue;
    primitiveCount++;
    for(const x of [a.min[0],a.max[0]]) for(const y of [a.min[1],a.max[1]]) for(const z of [a.min[2],a.max[2]]){
      const p=transformPoint(m,[x,y,z]);
      for(let k=0;k<3;k++){mins[k]=Math.min(mins[k],p[k]);maxs[k]=Math.max(maxs[k],p[k]);}
    }
  }
  if(!primitiveCount) return null;
  return {min:mins,max:maxs,center:mins.map((v,k)=>(v+maxs[k])/2),size:mins.map((v,k)=>maxs[k]-v),primitiveCount};
}

const rx=/(door|entry|passenger|stair|step|exit|cabin)/i;
const candidates=[];
nodes.forEach((n,i)=>{
  const meshName=Number.isInteger(n.mesh)?(meshes[n.mesh]?.name||""):"";
  if(rx.test(n.name||"")||rx.test(meshName)){
    candidates.push({
      nodeIndex:i,
      nodeName:n.name||"",
      meshIndex:Number.isInteger(n.mesh)?n.mesh:null,
      meshName,
      parent:parents.get(i)??null,
      bounds:boundsForNode(i),
    });
  }
});
const allNamed=nodes.map((n,i)=>({nodeIndex:i,nodeName:n.name||"",meshIndex:Number.isInteger(n.mesh)?n.mesh:null,meshName:Number.isInteger(n.mesh)?(meshes[n.mesh]?.name||""):""}));

const report={
  schemaVersion:1,
  glbPath,
  bytes:buffer.length,
  nodeCount:nodes.length,
  meshCount:meshes.length,
  candidates,
  allNamed,
};
fs.mkdirSync("reports",{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({nodeCount:report.nodeCount,meshCount:report.meshCount,candidates},null,2));
