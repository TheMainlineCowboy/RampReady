// One real rigged A1 marshaller. Enter during jetway retraction, guide from
// the capture HEAD (not the tug centre), then leave on foot after capture.
// Never use the rejected belt-loader/two-NPC build or marshalling wands.
import {createA1SingleMarshaller} from "./a1SingleMarshaller.js";
import {A1_APPROACH_DISTANCE_METERS,A1_STOP_CAPTURE_METERS} from "./a1GroundGuideMotion.js";

const WALK_METERS_PER_SECOND=1.05;
const EPSILON=.025;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function installA1LiveMarshaller(THREE,{
  scene,aircraft,rig,readStage,readInspection,
  readJetwayRetracting=()=>false,
}){
  let disposed=false,agent=null,status="loading",error="";
  let phase="waiting",approachMeters=A1_APPROACH_DISTANCE_METERS;
  const capture=new THREE.Vector3(),gear=new THREE.Vector3();
  const atGuide=new THREE.Vector3(),atEntry=new THREE.Vector3();
  let guideHeading=0;

  const faceDirection=(target,dt,finishHeading=null)=>{
    const delta=target.clone().sub(agent.person.position);delta.y=0;
    const wanted=finishHeading??Math.atan2(delta.x,delta.z);
    const difference=Math.atan2(Math.sin(wanted-agent.person.rotation.y),Math.cos(wanted-agent.person.rotation.y));
    agent.person.rotation.y+=difference*clamp(dt*7,0,1);
  };
  function walkTo(target,dt,finalHeading=null){
    const travel=target.clone().sub(agent.person.position);
    travel.y=0;
    const distance=travel.length();
    if(distance>EPSILON){
      const step=Math.min(distance,WALK_METERS_PER_SECOND*clamp(dt,0,.05));
      agent.person.position.addScaledVector(travel,step/distance);
      // Natural turn into the operating position, rather than walking
      // sideways or instantly snapping 180 degrees at the destination.
      if(finalHeading!==null && distance<.95)faceDirection(target,dt,finalHeading);
      else faceDirection(target,dt);
    }
    if(distance<=EPSILON+WALK_METERS_PER_SECOND*dt){
      agent.person.position.copy(target);
      if(finalHeading!==null)agent.person.rotation.y=finalHeading;
      return true;
    }
    return false;
  }
  function resetToWaiting(){
    phase="waiting";approachMeters=A1_APPROACH_DISTANCE_METERS;
    if(!agent)return;
    agent.person.visible=false;
    agent.person.position.copy(atEntry);
    agent.person.rotation.y=guideHeading;
    agent.setWalking(false);
    agent.setDistanceMeters(A1_APPROACH_DISTANCE_METERS);
  }

  void createA1SingleMarshaller(THREE,{scene,height:1.80}).then(created=>{
    if(disposed){created.dispose();return;}
    agent=created;
    const yaw=aircraft.rotation.y;
    const sideX=Math.cos(yaw),sideZ=-Math.sin(yaw);
    const approachX=-Math.sin(yaw),approachZ=-Math.cos(yaw);
    atGuide.set(
      aircraft.position.x+approachX*.95+sideX*1.15,0,
      aircraft.position.z+approachZ*.95+sideZ*1.15
    );
    // Entry begins from the safe outer ramp side, not inside the tug path.
    atEntry.copy(atGuide).add(new THREE.Vector3(sideX*4.8,0,sideZ*4.8));
    guideHeading=Math.PI+yaw;
    resetToWaiting();
    status="ready";
  }).catch(e=>{status="error";error=String(e);console.error("A1 marshaller failed",e);});

  return {
    update(dt){
      if(disposed||!agent)return;
      dt=clamp(Number.isFinite(dt)?dt:0,0,.05);
      const stage=readStage();
      if(readInspection()){
        if(phase!=="waiting")resetToWaiting();
        return;
      }
      const retracting=readJetwayRetracting();
      // Step 0 remains invisible until the actual jetway retraction starts.
      // Stay visible at step 1 so slower device loads never cause a teleported guide.
      if(stage===0&&!retracting){
        if(phase!=="waiting")resetToWaiting();
        return;
      }
      if(phase==="waiting"&&(retracting||stage===1||stage===2)){
        phase="entering";agent.person.visible=true;agent.setWalking(true);
      }
      if(phase==="entering"){
        const arrived=walkTo(atGuide,dt,guideHeading);
        agent.update(dt);
        if(arrived){
          phase="guiding";
          agent.setWalking(false);
        }
        return;
      }
      if(stage>=3&&phase==="guiding"){
        phase="leaving";agent.setWalking(true);
      }
      if(phase==="leaving"){
        const departed=walkTo(atEntry,dt);
        agent.update(dt);
        if(departed){
          phase="finished";agent.person.visible=false;agent.setWalking(false);
        }
        return;
      }
      if(phase!=="guiding")return;
      gear.copy(aircraft.position);
      // Same capture anchor and world-space offset used by connectionMetrics
      // and requestCapture (including the vertical difference).
      rig.getCaptureWorld(capture);
      approachMeters=Math.min(A1_APPROACH_DISTANCE_METERS,gear.distanceTo(capture));
      // Keep the fully crossed stop for the capture-and-secure stage.
      if(stage===2)approachMeters=Math.min(approachMeters,A1_STOP_CAPTURE_METERS);
      agent.setDistanceMeters(approachMeters);
      agent.update(dt);
    },
    get status(){return status;},
    get phase(){return phase;},
    get approachMeters(){return approachMeters;},
    get stopPoseReady(){return phase==="guiding"&&approachMeters<=A1_STOP_CAPTURE_METERS;},
    get error(){return error;},
    dispose(){disposed=true;agent?.dispose();agent=null;},
  };
}
