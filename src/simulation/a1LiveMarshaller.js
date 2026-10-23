// Accepted-for-now A1 crew guide. ONE rigged human, NO wands.
// Runtime geometry comes from the established WED/ACF nose-gear and tug poses;
// it is non-collidable visual guidance, not a safety-authority replacement.
import {createA1SingleMarshaller} from "./a1SingleMarshaller.js";
import {A1_APPROACH_DISTANCE_METERS} from "./a1GroundGuideMotion.js";

export function installA1LiveMarshaller(THREE,{scene,aircraft,rig,readStage,readInspection}){
  let disposed=false,agent=null,status="loading",error="";
  const gear=new THREE.Vector3(),tug=new THREE.Vector3();
  void createA1SingleMarshaller(THREE,{scene,height:1.80}).then(created=>{
    if(disposed){created.dispose();return;}
    agent=created;
    // Aircraft user coordinates are authoritative for the A1 nose-gear stop,
    // and its heading gives the tug approach direction.
    const yaw=aircraft.rotation.y;
    const sideX=Math.cos(yaw),sideZ=-Math.sin(yaw);
    const approachX=-Math.sin(yaw),approachZ=-Math.cos(yaw);
    created.person.position.set(
      aircraft.position.x + approachX*0.95+sideX*1.15,
      0,
      aircraft.position.z + approachZ*0.95+sideZ*1.15
    );
    created.person.rotation.y=Math.PI+yaw;
    created.person.visible=false;
    status="ready";
  }).catch(e=>{status="error";error=String(e);console.error("A1 accepted marshaller failed",e);});
  return {
    update(dt){
      if(disposed||!agent)return;
      const stage=readStage(),inspection=readInspection();
      const visible=!inspection&&(stage===1||stage===2);
      agent.person.visible=visible;
      if(!visible)return;
      gear.set(aircraft.position.x,0,aircraft.position.z);
      tug.set(rig.root.position.x,0,rig.root.position.z);
      // 7m -> arms spread, closing distance -> arms rise, gear stop -> crossed.
      const distance=Math.min(A1_APPROACH_DISTANCE_METERS,gear.distanceTo(tug));
      agent.setDistanceMeters(distance);
      agent.update(dt);
    },
    dispose(){disposed=true;agent?.dispose();agent=null;},
    get status(){return status;},
    get error(){return error;},
  };
}
