// Retimes, but does NOT alter, the approved-for-now marshaller's existing
// seven-metre pose sequence. Physical input comes from the actual 3D capture
// head and nose gear (not the tug centre or a timer).
import {CONNECTION_LIMITS} from "./noseGearConnection.js";
export const A1_CAPTURE_STOP_METERS=CONNECTION_LIMITS.distance;

// At zero animation distance the ORIGINAL crossed stop is fully completed.
// Easing the physical approach before it enters the existing pose function
// gives the original closing-arm gesture room to finish at the real stop.
export function mapA1CaptureDistanceToMotionDistance(
  physicalMeters,entryMeters,animationLengthMeters=7
){
  if(!Number.isFinite(physicalMeters)||!Number.isFinite(entryMeters))
    throw Error("Marshaller distance schedule requires finite metres");
  const start=Math.max(entryMeters,A1_CAPTURE_STOP_METERS+1);
  const available=start-A1_CAPTURE_STOP_METERS;
  const travelled=Math.max(0,Math.min(1,(start-physicalMeters)/available));
  // Eases the animation forward BEFORE the last 1m instead of cramming the
  // crossed-forearm section into the final few centimetres.
  const animationProgress=1-Math.pow(1-travelled,1.5);
  return animationLengthMeters*(1-animationProgress);
}
