// One real rigged A1 marshaller. Enter during jetway retraction, guide from
// the capture HEAD (not the tug centre), then leave on foot after capture.
// Never use the rejected belt-loader/two-NPC build or marshalling wands.
import {createA1SingleMarshaller} from "./a1SingleMarshaller.js";
import {A1_APPROACH_DISTANCE_METERS} from "./a1GroundGuideMotion.js";
import {A1_CAPTURE_STOP_METERS,mapA1CaptureDistanceToMotionDistance} from "./a1GuideDistanceSchedule.js";

// Keep Sam's authored walk.relaxed animation; the earlier 11.5m route
// artificially delayed Stage 2 and made the character wander beside the jet.
export const A1_WALK_ENTRY_DISTANCE_METERS=4.8;
export const A1_WALK_SPEED_METERS_PER_SECOND=1.30;
const TURN_DURATION_MS=320;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function installA1LiveMarshaller(THREE,{
  scene,aircraft,rig,readStage,readInspection,
  readJetwayRetracting=()=>false,
}){
  let disposed=false,agent=null,status="loading",error="";
  let phase="waiting",approachMeters=A1_APPROACH_DISTANCE_METERS;
  let physicalDistanceMeters=Number.NaN,approachEntryMeters=Number.NaN;
  const capture=new THREE.Vector3(),gear=new THREE.Vector3();
  const atGuide=new THREE.Vector3(),atEntry=new THREE.Vector3();
  let guideHeading=0;

  // The authored GLB's walk cycle moves the legs; world translation is
  // separate. Only turn while STATIONARY so she cannot crab-walk sideways.
  let walkInHeading=0,walkOutHeading=0;
  const headingFromTo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
  let phaseStartedAt=0,turnFrom=0,lastRealUpdateAt=performance.now();
  function startPhase(name,now){
    phase=name;phaseStartedAt=now;turnFrom=agent.person.rotation.y;
  }
  function rotateStandingTo(target,now){
    const arc=Math.atan2(Math.sin(target-turnFrom),Math.cos(target-turnFrom));
    const t=clamp((now-phaseStartedAt)/TURN_DURATION_MS,0,1);
    const eased=t*t*(3-2*t);
    agent.person.rotation.y=turnFrom+arc*eased;
    if(t>=1){agent.person.rotation.y=target;return true;}
    return false;
  }
  function walkTo(from,to,now){
    // Authoritative 1.3 m/s "walk.relaxed" GLB gait moves IN PLACE.
    // World motion is elapsed-time based, never based on the 40ms frame cap.
    const meters=from.distanceTo(to);
    const fraction=clamp((now-phaseStartedAt)*A1_WALK_SPEED_METERS_PER_SECOND/
      Math.max(.001,1000*meters),0,1);
    agent.person.position.lerpVectors(from,to,fraction);
    return fraction>=1;
  }
  function resetToWaiting(){
    phase="waiting";phaseStartedAt=0;approachMeters=A1_APPROACH_DISTANCE_METERS;
    physicalDistanceMeters=Number.NaN;approachEntryMeters=Number.NaN;
    if(!agent)return;
    // Park visibly at a remote ramp-side staging point. Never pop into the
    // guide position when the deployment sequence reaches Step 2.
    agent.person.visible=!readInspection();
    agent.person.position.copy(atEntry);
    agent.person.rotation.y=walkInHeading;
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
    // Start alongside the aircraft, clear of the tug path. A 4.8m walk at
    // 1.30 m/s completes in ~3.7 seconds (jetway departure ~4.2s).
    atEntry.copy(atGuide).add(new THREE.Vector3(
      sideX*A1_WALK_ENTRY_DISTANCE_METERS,0,sideZ*A1_WALK_ENTRY_DISTANCE_METERS
    ));
    guideHeading=Math.PI+yaw;
    walkInHeading=headingFromTo(atEntry,atGuide);
    walkOutHeading=headingFromTo(atGuide,atEntry);
    resetToWaiting();
    status="ready";
  }).catch(e=>{status="error";error=String(e);console.error("A1 marshaller failed",e);});

  return {
    update(dt){
      if(disposed||!agent)return;
      const now=performance.now();
      const realDelta=clamp((now-lastRealUpdateAt)/1000,0,1);
      lastRealUpdateAt=now;
      // Real elapsed time also advances Sam's walk cycle at the correct speed.
      dt=Math.max(realDelta,clamp(Number.isFinite(dt)?dt:0,0,.05));
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
        startPhase("entering",now);agent.person.visible=true;agent.setWalking(true);
      }
      if(phase==="entering"){
        const arrived=walkTo(atEntry,atGuide,now);
        agent.update(dt);
        if(arrived){
          startPhase("turning-to-guide",now);
          agent.setWalking(false);
        }
        return;
      }
      if(phase==="turning-to-guide"){
        const facing=rotateStandingTo(guideHeading,now);
        agent.update(dt);
        if(facing)phase="guiding";
        return;
      }
      if(stage>=3&&phase==="guiding"){
        startPhase("turning-to-exit",now);
        agent.setWalking(false);
      }
      if(phase==="turning-to-exit"){
        const facing=rotateStandingTo(walkOutHeading,now);
        agent.update(dt);
        if(facing){startPhase("leaving",now);agent.setWalking(true);}
        return;
      }
      if(phase==="leaving"){
        const departed=walkTo(atGuide,atEntry,now);
        agent.update(dt);
        if(departed){
          // Stop at the apron edge, then remain present rather than vanishing.
          phase="finished";agent.setWalking(false);
        }
        return;
      }
      if(phase==="finished"){agent.update(dt);return;}
      if(phase!=="guiding")return;
      gear.copy(aircraft.position);
      // This is exactly the distance used to authorize nose-gear capture.
      rig.getCaptureWorld(capture);
      physicalDistanceMeters=gear.distanceTo(capture);
      if(!Number.isFinite(approachEntryMeters)){
        approachEntryMeters=Math.max(physicalDistanceMeters,A1_CAPTURE_STOP_METERS+1);
      }
      // Do not change any shoulder, wrist, elbow, or palm animation keys:
      // remap physical travel onto the existing 7m gesture sequence instead.
      approachMeters=mapA1CaptureDistanceToMotionDistance(
        physicalDistanceMeters,approachEntryMeters,A1_APPROACH_DISTANCE_METERS
      );
      const atStop=physicalDistanceMeters<=A1_CAPTURE_STOP_METERS||stage===2;
      if(atStop)approachMeters=0;
      // Catch up only when the tug is physically in its capture envelope.
      // The leading eased schedule normally finishes without this override.
      agent.setDistanceMeters(approachMeters,atStop);
      agent.update(dt);
    },
    get status(){return status;},
    get phase(){return phase;},
    get readyToGuide(){return status==="ready"&&phase==="guiding"&&agent?.person.visible===true;},
    get metersToGuide(){return agent?Math.hypot(agent.person.position.x-atGuide.x,agent.person.position.z-atGuide.z):Number.NaN;},
    get entryDurationSeconds(){return A1_WALK_ENTRY_DISTANCE_METERS/A1_WALK_SPEED_METERS_PER_SECOND;},
    get approachMeters(){return approachMeters;},
    get physicalDistanceMeters(){return physicalDistanceMeters;},
    get stopPoseReady(){return phase==="guiding"&&approachMeters<=0;},
    get error(){return error;},
    dispose(){disposed=true;agent?.dispose();agent=null;},
  };
}
