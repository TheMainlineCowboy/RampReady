// Source-faithful, fitted ramp PPE for an existing skin-animated human.
// Reference authority: actual worker photos, 3M PELTOR headsets (boom/cup/band),
// and high-visibility workwear. No unlicensed Sketchfab model geometry copied.
//
// Rather than cylinders over a body, the vest is extracted from the animated
// clothing's own torso surface and bound to the exact same skeleton.
export function installA1MarshallingPPE(THREE,{root,bones}) {
  const geometries=new Set(), materials=new Set();
  const make=(color,roughness=.8,metalness=.02,extra={})=>{
    const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
    materials.add(m);return m;
  };
  const neon=make(0xc6e63a,.78), dark=make(0x22282a,.86),
    seal=make(0x11171a,.97), graphite=make(0x46505a,.6,.18),
    cushion=make(0x34373a,.99), lamp=make(0xff9564,.3,0,{
      emissive:0xe14924,emissiveIntensity:1.6,
    });
  const add=(parent,geometry,material,name,pos=[0,0,0],scale=null)=>{
    geometries.add(geometry);
    const m=new THREE.Mesh(geometry,material);
    m.name=name;m.position.set(...pos);
    if(scale)m.scale.set(...scale);
    m.castShadow=true;m.receiveShadow=true;
    parent.add(m);return m;
  };
  const ellipsoid=(parent,name,material,position,radii)=>{
    return add(parent,new THREE.SphereGeometry(1,28,18),material,name,position,radii);
  };
  const tube=(parent,name,points,radius,material)=>{
    return add(parent,new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map(x=>new THREE.Vector3(...x))),
      28,radius,9,false),material,name);
  };
  const suitMeshes=[];
  root.traverse(obj=>{
    if(!obj.isSkinnedMesh || !/male_casualsuit02/i.test(obj.name))return;
    const m=Array.isArray(obj.material)?obj.material:[obj.material];
    const topIndex=m.findIndex(x=>/original top/i.test(x?.name||""));
    if(topIndex>=0)suitMeshes.push({mesh:obj,index:topIndex});
  });
  if(!suitMeshes.length)throw Error("Animated original suit surface unavailable: cannot fit a vest without the source skin");
  let applied=0;
  for(const {mesh,index:matIndex} of suitMeshes){
    const src=mesh.geometry,xyz=src.getAttribute("position"),normal=src.getAttribute("normal");
    if(!xyz||!normal||!src.getAttribute("skinIndex")||!src.getAttribute("skinWeight"))throw Error("Source suit lacks skin data");
    const originalIndices=src.index?.array || Uint32Array.from({length:xyz.count},(_,i)=>i);
    const chunks=src.groups?.length?src.groups:[{start:0,count:originalIndices.length,materialIndex:0}];
    const selection=[];
    for(const part of chunks){
      if(part.materialIndex!==matIndex)continue;
      for(let i=part.start;i<part.start+part.count;i+=3){
        const a=originalIndices[i],b=originalIndices[i+1],c=originalIndices[i+2];
        const x=(xyz.getX(a)+xyz.getX(b)+xyz.getX(c))/3;
        const y=(xyz.getY(a)+xyz.getY(b)+xyz.getY(c))/3;
        // Exactly follow shirt chest/back; exclude upper-arm and lower sleeve.
        if(Math.abs(x)<.236 && y>1.012 && y<1.48)selection.push(a,b,c);
      }
    }
    if(selection.length<90)continue;
    const g=src.clone();g.setIndex(selection);g.clearGroups();
    // Cloth surface is slightly offset from the rigged jacket, avoiding
    // both clipping and the previous oversized barrel/armor silhouette.
    const p=g.getAttribute("position"),n=g.getAttribute("normal");
    const colors=new Float32Array(p.count*3);
    const color=new THREE.Color();
    for(let v=0;v<p.count;v++){
      p.setXYZ(v,p.getX(v)+n.getX(v)*.0055,
        p.getY(v)+n.getY(v)*.0055,p.getZ(v)+n.getZ(v)*.0055);
      const x=p.getX(v),y=p.getY(v),z=p.getZ(v);
      // Front of the original jacket looks along positive model Z.
      const front=z>.065;
      const openFront=front&&Math.abs(x)<.024;
      const horizontal=(Math.abs(y-1.11)<.026||Math.abs(y-1.28)<.029);
      const vertical=front && Math.abs(Math.abs(x)-.137)<.026 && y>1.26;
      const edge=front&&Math.abs(Math.abs(x)-.037)<.014;
      if(openFront)color.setRGB(.025,.05,.075);
      else if(horizontal||vertical)color.setRGB(.72,.76,.75);
      else if(edge)color.setRGB(.65,.76,.19);
      else color.setRGB(.59,.76,.08);
      colors[v*3]=color.r;colors[v*3+1]=color.g;colors[v*3+2]=color.b;
    }
    g.setAttribute("color",new THREE.BufferAttribute(colors,3));p.needsUpdate=true;
    g.computeBoundingSphere();geometries.add(g);
    const vestMat=make(0xffffff,.92,.0,{vertexColors:true,side:THREE.DoubleSide});
    const vest=new THREE.SkinnedMesh(g,vestMat);
    vest.name="Torso-fitted high visibility fabric vest (shared skin weights)";
    vest.bindMode=mesh.bindMode;
    vest.position.copy(mesh.position);vest.rotation.copy(mesh.rotation);
    vest.scale.copy(mesh.scale);vest.bind(mesh.skeleton,mesh.bindMatrix.clone());
    mesh.parent.add(vest);vest.castShadow=true;vest.receiveShadow=true;
    applied++;
  }
  if(!applied)throw Error("No valid torso surface triangles for fitted vest");
  const head=bones.head;
  const headset=new THREE.Group();headset.name="Realistic oval-cup ramp radio headset";
  headset.position.set(0,-.014,0);head.add(headset);
  // PELTOR-like oval ear cups, compression cushions, outer reinforcing shell,
  // and separate thin wire/yoke. Not two cylinders attached to temples.
  for(const sign of [-1,1]){
    ellipsoid(headset,"soft rubber ear seal",seal,[sign*.094,-.014,0],[.021,.059,.045]);
    ellipsoid(headset,"neon earmuff acoustic shell",neon,[sign*.117,-.013,0],[.029,.071,.051]);
    ellipsoid(headset,"outer shell control plate",graphite,[sign*.143,-.012,.006],[.003,.023,.031]);
    tube(headset,"slim fork and attachment yoke",[
      [sign*.127,.020,0],[sign*.126,.075,0],[sign*.108,.092,0]
    ],.007,graphite);
  }
  tube(headset,"slim padded spring headband",[
    [-.11,.08,0],[-.092,.142,0],[-.05,.165,0],
    [0,.169,0],[.05,.165,0],[.092,.142,0],[.11,.08,0]
  ],.009,dark);
  tube(headset,"boom microphone stalk",[
    [-.118,-.032,.014],[-.108,-.063,.052],
    [-.074,-.083,.103],[-.027,-.091,.136]
  ],.008,graphite);
  ellipsoid(headset,"small noise-canceling mic capsule",seal,
    [-.027,-.091,.136],[.023,.017,.018]);
  // Compact grounded radio on hip, plus antenna: not a floating rectangle.
  const pelvis=bones.pelvis;
  const radio=add(pelvis,new THREE.BoxGeometry(.071,.121,.040),dark,
    "hip two-way communications radio",[.17,-.035,.095]);
  radio.rotation.z=-.1;
  tube(pelvis,"short flexible radio antenna",[
    [.178,.023,.10],[.176,.076,.108],[.173,.105,.107]
  ],.006,seal);
  const grips={};
  for(const side of ["l","r"]){
    const hand=bones["hand_"+side];
    const grip=new THREE.Group();grip.name=side+" articulated marshalling wand";
    grip.position.set(0,.128,.022);hand.add(grip);
    add(grip,new THREE.CylinderGeometry(.019,.023,.125,16),dark,
      "soft grip rubber handle",[0,0,0]);
    add(grip,new THREE.CylinderGeometry(.020,.020,.250,16),lamp,
      "emitting orange-red illuminated wand",[0,.187,0]);
    ellipsoid(grip,"translucent wand tip",lamp,[0,.324,0],[.021,.023,.021]);
    grips[side]=grip;
  }
  function dispose(){
    grips.l.parent?.remove(grips.l);grips.r.parent?.remove(grips.r);
    headset.parent?.remove(headset);radio.parent?.remove(radio);
    geometries.forEach(x=>x.dispose());
    materials.forEach(x=>x.dispose());
  }
  return {grips,vestApplied:applied,dispose};
}
