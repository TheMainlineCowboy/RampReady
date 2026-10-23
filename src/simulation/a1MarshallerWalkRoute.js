// Animate the existing CC0 Sam walk.relaxed clip along a smooth, physical
// world-space path with its forward axis tangent to travel at every point.
// The last metre bends naturally into the tug-facing guide orientation;
// no end-of-walk sideways shuffle or translating while turning.
export function createA1MarshallerWalkRoute(THREE,start,finish,arrivalHeading){
  const direction=finish.clone().sub(start);direction.y=0;
  const chord=direction.length();
  if(!(chord>0.1))throw Error("A1 walking route needs a real starting distance");
  const initial=direction.clone().normalize();
  const final=new THREE.Vector3(Math.sin(arrivalHeading),0,Math.cos(arrivalHeading));
  const control1=start.clone().addScaledVector(initial,chord*0.36);
  const control2=finish.clone().addScaledVector(final,-Math.min(0.85,chord*0.22));
  const curve=new THREE.CubicBezierCurve3(start.clone(),control1,control2,finish.clone());
  const meters=curve.getLength();
  return {
    meters,
    position(t){return curve.getPointAt(Math.min(1,Math.max(0,t)));},
    heading(t){
      const tangent=curve.getTangentAt(Math.min(1,Math.max(0,t)));
      return Math.atan2(tangent.x,tangent.z);
    },
    // On departure, traverse the same safe ramp route in reverse.
    reversePosition(t){return curve.getPointAt(1-Math.min(1,Math.max(0,t)));},
    reverseHeading(t){
      const tangent=curve.getTangentAt(1-Math.min(1,Math.max(0,t)));
      return Math.atan2(-tangent.x,-tangent.z);
    }
  };
}
