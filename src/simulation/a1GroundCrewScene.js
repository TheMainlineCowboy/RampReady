import { createA1CrewClock } from "./a1GroundCrewTimeline.js";

// Lightweight articulated NPCs and working service vehicle for the real A1
// Three.js scene. Geometries are temporary runtime visuals, never changes to
// a locked LEKTRO, aircraft or baggage-cart source file.
export function createA1GroundCrewScene(THREE, { scene, aircraft }) {
  const sceneRoot = new THREE.Group();
  sceneRoot.name = "A1 NPC ground crew and departing belt loader (preview)";
  sceneRoot.position.copy(aircraft.position);
  sceneRoot.rotation.y = aircraft.rotation.y;
  sceneRoot.userData.isA1CrewPreview = true;
  scene.add(sceneRoot);

  const mat = (color,metalness=0.02,roughness=.8) =>
    new THREE.MeshStandardMaterial({color, metalness, roughness});
  const yellow=mat(0xe6b62b,.16), orange=mat(0xf19a32), safety=mat(0xd8ef42),
    dark=mat(0x292c31), grey=mat(0x646b6e,.26), steel=mat(0x9ca5ac,.4),
    skin=mat(0x99745d), navy=mat(0x24374b), visor=mat(0x151a1e),
    wand= new THREE.MeshStandardMaterial({color:0xff941c,emissive:0x7d2700,emissiveIntensity:.5});
  const objects=[];
  function item(parent, shape, material, pos, name) {
    const mesh=new THREE.Mesh(shape,material);
    mesh.position.set(...pos);
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name;parent.add(mesh);
    objects.push(mesh);return mesh;
  }
  function box(parent, dims, material, pos, name) {
    return item(parent,new THREE.BoxGeometry(...dims),material,pos,name);
  }
  function cyl(parent,radius,depth,material,pos,rot,name) {
    const m=item(parent,new THREE.CylinderGeometry(radius,radius,depth,10),material,pos,name);
    m.rotation.set(...rot);return m;
  }
  function person(name,{helmColor=yellow,seated=false}={}) {
    const root=new THREE.Group();root.name=name;
    // A stylized human proxy with separately animated arms and legs.
    box(root,[.50,.64,.24],navy,[0,1.13,0],"uniform torso");
    box(root,[.52,.40,.265],safety,[0,1.21,-.013],"high-visibility vest");
    box(root,[.41,.035,.27],steel,[0,1.24,.133],"vest reflective strip");
    box(root,[.33,.22,.22],skin,[0,1.66,0],"head and face");
    const hat=box(root,[.39,.13,.31],helmColor,[0,1.80,0],"safety helmet");
    box(root,[.42,.08,.15],helmColor,[0,1.74,-.14],"helmet visor");
    const arms=[],legs=[];
    for (const side of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(side*.30,1.46,0);
      box(arm,[.15,.53,.17],navy,[side*.012,-.27,0],"arm sleeve");
      box(arm,[.15,.15,.15],skin,[side*.012,-.59,0],"glove/hand");
      root.add(arm);arms.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.13,.84,0);
      box(leg,[.20,.64,.22],dark,[0,-.31,0],"uniform trouser leg");
      box(leg,[.23,.13,.33],visor,[0,-.65,-.065],"work boot");
      root.add(leg);legs.push(leg);
    }
    if (seated) { legs[0].rotation.x=-.75; legs[1].rotation.x=-.75; }
    return {root,arms,legs,hat};
  }

  const loader=new THREE.Group();
  loader.name="NPC operated belt loader";
  sceneRoot.add(loader);
  box(loader,[3.3,.36,1.3],yellow,[0,.62,0],"belt loader frame");
  box(loader,[2.5,.14,.83],steel,[-.15,1.06,0],"conveyor underframe");
  // Conveyor rotates as the operator lowers the head before departure.
  const boom=new THREE.Group();boom.name="lowering articulated conveyor";
  boom.position.set(-.55,1.22,0);loader.add(boom);
  box(boom,[3.2,.15,.85],dark,[0,.11,0],"conveyor rubber");
  box(boom,[3.28,.08,.06],yellow,[0,.19,.47],"outer safety rail");
  box(boom,[3.28,.08,.06],yellow,[0,.19,-.47],"inner safety rail");
  for(const x of [-1.47,1.47])cyl(boom,.16,.88,grey,[x,.12,0],[Math.PI/2,0,0],"roller");
  box(loader,[.11,.66,.10],steel,[-.80,.92,0],"hydraulic lift strut");
  const wheels=[];
  for(const x of [-1.17,1.17]) for(const z of [-.68,.68]){
    const w=cyl(loader,.35,.18,dark,[x,.35,z],[Math.PI/2,0,0],"rolling rubber tire");
    cyl(loader,.14,.19,grey,[x,.35,z+(z>0?.01:-.01)],[Math.PI/2,0,0],"hub");
    wheels.push(w);
  }
  box(loader,[.86,.13,.78],dark,[1.02,.97,-.06],"operator seat");
  box(loader,[.12,.57,.1],steel,[1.32,1.12,-.20],"operator controls");
  const driver=person("NPC belt loader operator",{seated:true});
  driver.root.position.set(1.05,.65,-.1);driver.root.rotation.y=-Math.PI/2;
  driver.root.scale.setScalar(.8);loader.add(driver.root);
  // Two illuminated beacons make crew/equipment identifiable at distance.
  cyl(loader,.105,.10,orange,[1.38,1.04,.35],[0,0,0],"amber work beacon");

  const marshal=person("NPC A1 LEKTRO approach guide");
  sceneRoot.add(marshal.root);
  const lamps=[];
  for(let i=0;i<2;i++){
    const arm=marshal.arms[i];
    // A short, clearly visible signal baton carried with each hand.
    const m=cyl(arm,.042,.36,wand,[0,-.77,0],[0,0,0],"marshaller wand");
    lamps.push(m);
  }
  const clock=createA1CrewClock();
  let previousPhase="servicing";
  function update(dt,{tugPosition=null,stage=0,inspection=false}={}) {
    sceneRoot.visible = !inspection;
    if(inspection) return clock.snapshot;
    let tugDistance=20;
    if(tugPosition){
      const v=sceneRoot.worldToLocal(tugPosition.clone());
      tugDistance=Math.hypot(v.x,v.z+4.5);
    }
    const result=clock.step(dt,{tugNoseDistance:tugDistance,pushbackStage:stage});
    loader.position.set(result.loaderX,0,result.loaderZ);
    // Counterclockwise pitch lowers the belt end away from the hold.
    boom.rotation.z= -.21*(1-result.lowerProgress);
    for(const wheel of wheels)wheel.rotation.y=result.loaderProgress*18;
    // The driver stays in the seat as the service vehicle departs.
    marshal.root.position.set(result.marshalX,0,result.marshalZ);
    const walking=result.marshalWalkProgress>0&&result.marshalWalkProgress<1;
    const gait=walking?Math.sin(result.elapsed*11)*.26:0;
    marshal.legs[0].rotation.x=gait;
    marshal.legs[1].rotation.x=-gait;
    if(result.signal==="hold"){
      marshal.arms[0].rotation.z=-.95;marshal.arms[1].rotation.z=.95;
    }else if(result.signal==="approach"){
      const bob=Math.sin(result.elapsed*6)*.32;
      marshal.arms[0].rotation.z=-2.15+bob;marshal.arms[1].rotation.z=2.15-bob;
    }else if(result.signal==="stop"){
      marshal.arms[0].rotation.z=2.55;marshal.arms[1].rotation.z=-2.55;
    }else{
      marshal.arms[0].rotation.z=-.08;marshal.arms[1].rotation.z=.08;
    }
    previousPhase=result.phase;
    sceneRoot.userData.crewState=result.phase;
    return result;
  }
  // Initialize visible geometry at the actual time-zero local pose.
  const initial=clock.snapshot;loader.position.set(initial.loaderX,0,initial.loaderZ);
  boom.rotation.z=-.21;marshal.root.position.set(initial.marshalX,0,initial.marshalZ);
  function reset(){
    clock.reset();loader.position.set(initial.loaderX,0,initial.loaderZ);
    boom.rotation.z=-.21;marshal.root.position.set(initial.marshalX,0,initial.marshalZ);
    sceneRoot.visible=true;
  }
  function dispose(){
    sceneRoot.parent?.remove(sceneRoot);
    const geometries=new Set(),materials=new Set();
    for(const mesh of objects){geometries.add(mesh.geometry);materials.add(mesh.material);}
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
  }
  return {root:sceneRoot,update,reset,dispose,isClear:()=>clock.snapshot.ready,
    get status(){return clock.snapshot;}};
}
