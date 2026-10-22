// High-vis material with pixel-precise retroreflective band placement.
// The source shirt is still the real skin-weighted mesh. Unlike sparse
// vertex colors, fragment evaluation produces narrow, crisp strips.
export function createA1SafetyVestMaterial(THREE){
  const material=new THREE.MeshStandardMaterial({
    color:0xffffff,roughness:.92,metalness:0,
    side:THREE.DoubleSide,
  });
  material.name="A1 reflective vest fabric with precise woven silver bands";
  material.onBeforeCompile=(shader)=>{
    shader.vertexShader=shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vA1VestPosition;"
    );
    shader.vertexShader=shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvA1VestPosition=position;"
    );
    shader.fragmentShader=shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vA1VestPosition;"
    );
    shader.fragmentShader=shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float band1 = 1.0-smoothstep(.019,.024,abs(vA1VestPosition.y-1.11));
      float band2 = 1.0-smoothstep(.019,.024,abs(vA1VestPosition.y-1.28));
      float front = smoothstep(.045,.078,vA1VestPosition.z);
      float suspender = front*(1.0-smoothstep(.019,.024,
         abs(abs(vA1VestPosition.x)-.137)))*smoothstep(1.23,1.27,vA1VestPosition.y);
      float trim = max(max(band1,band2),suspender);
      vec3 fluorescent = vec3(.68,.82,.11);
      vec3 retro = vec3(.77,.79,.76);
      diffuseColor.rgb=mix(fluorescent,retro,trim);
      float opening=front*(1.0-smoothstep(.016,.023,abs(vA1VestPosition.x)));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.035,.07,.10),opening);
      `
    );
  };
  material.customProgramCacheKey=()=> "a1_skin_fitted_hi_vis_bands_v2";
  return material;
}
