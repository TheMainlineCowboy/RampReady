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
      // Dress the underlying, continuously skinned workwear surface. Never
      // select/discard triangles at an armhole (which creates sharp spikes).
      float px=abs(vA1VestPosition.x);
      float py=vA1VestPosition.y;
      // Tailored vest outline: narrow toward shoulder openings, wide at
      // the lower chest. Crisp hem/armhole boundaries, not airbrushed dye.
      float shoulderTaper=smoothstep(1.28,1.465,py);
      float halfVestWidth=mix(.225,.152,shoulderTaper);
      float torsoX=1.0-smoothstep(halfVestWidth-.004,halfVestWidth+.004,px);
      float hem=smoothstep(1.033,1.043,py);
      float neckline=1.0-smoothstep(1.460,1.475,py);
      float vestRegion=clamp(torsoX*hem*neckline,0.0,1.0);
      float band1=1.0-smoothstep(.017,.024,abs(py-1.11));
      float band2=1.0-smoothstep(.017,.024,abs(py-1.28));
      float front=smoothstep(.045,.080,vA1VestPosition.z);
      float shoulderTape=front*(1.0-smoothstep(.018,.026,
           abs(px-.137)))*smoothstep(1.215,1.27,py);
      float reflective=max(max(band1,band2),shoulderTape);
      vec3 navy=vec3(.085,.128,.205);
      vec3 fluorescent=vec3(.65,.82,.10);
      vec3 retro=vec3(.78,.80,.77);
      vec3 cloth=mix(fluorescent,retro,reflective);
      float zip=front*(1.0-smoothstep(.014,.022,px));
      cloth=mix(cloth,navy,zip);
      diffuseColor.rgb=mix(navy,cloth,vestRegion);
      `
    );
  };
  material.customProgramCacheKey=()=> "a1_original_suit_surface_vest_tailored_edges_v4";
  return material;
}
