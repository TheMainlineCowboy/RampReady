// Shared authoritative transition requirement for the A1 pushback approach.
// Only enter the nose-gear alignment step once BOTH the rendered jetway is
// fully parked and the real one-person marshaller has walked into place.
export const A1_JETWAY_PARKED_TOLERANCE=0.0005;
export function evaluateA1ApproachGate(jetway,marshaller) {
  if(!jetway?.retractionRequested)
    return {ready:false,reason:"Jetway retraction has not started"};
  if(jetway.target!==0 || !Number.isFinite(jetway.deployment) ||
      jetway.deployment>A1_JETWAY_PARKED_TOLERANCE ||
      jetway.controller?.getState?.()!=="parked")
    return {ready:false,reason:"Waiting for the jetway to retract completely and park"};
  if(marshaller?.status==="error")
    return {ready:false,reason:"Marshaller model failed to load: approach locked"};
  if(marshaller?.status!=="ready")
    return {ready:false,reason:"Waiting for the marshaller character to load"};
  if(marshaller.readyToGuide!==true)
    return {ready:false,reason:"Waiting for the marshaller to finish walking into guiding position"};
  return {ready:true,reason:"Jetway parked clear and marshaller ready to guide"};
}
