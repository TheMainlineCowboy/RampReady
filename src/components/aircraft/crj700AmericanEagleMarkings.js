function createAmericanEagleTitleTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create CRJ700 livery title canvas");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.font = "700 146px Arial, Helvetica, sans-serif";
  context.fillStyle = "#252a31";
  context.fillText("American", 34, 128);

  const americanWidth = context.measureText("American").width;
  context.font = "italic 700 146px Arial, Helvetica, sans-serif";
  context.fillStyle = "#173f73";
  context.fillText("Eagle", 58 + americanWidth, 128);

  const texture = new THREE.CanvasTexture(canvas);
  if ("colorSpace" in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function createAmericanEagleSurfaceMaterial(THREE) {
  const titleTexture = createAmericanEagleTitleTexture(THREE);
  const material = new THREE.MeshStandardMaterial({
    name: "RampReady CRJ700 surface-conforming American Eagle livery",
    color: 0xf2f4f6,
    roughness: 0.36,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  material.userData.liveryState = "american-eagle-surface-shader-no-floating-overlays";
  material.userData.titleTexture = titleTexture;
  material.customProgramCacheKey = () => "rampready-crj700-american-eagle-surface-v3";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.americanEagleTitle = { value: titleTexture };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vRampReadyObjectPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvRampReadyObjectPosition = position;",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D americanEagleTitle;
varying vec3 vRampReadyObjectPosition;

float rrRange(float value, float startValue, float endValue, float feather) {
  return smoothstep(startValue - feather, startValue + feather, value)
    * (1.0 - smoothstep(endValue - feather, endValue + feather, value));
}
`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 rrP = vRampReadyObjectPosition;
float rrAbsX = abs(rrP.x);
vec3 rrBlue = vec3(0.090, 0.247, 0.451);
vec3 rrRed = vec3(0.776, 0.125, 0.196);
vec3 rrSilver = vec3(0.780, 0.800, 0.824);
vec3 rrCharcoal = vec3(0.145, 0.165, 0.192);

// Paint directly in the real GLB's object coordinates. Nothing is placed outside the skin.
float rrFuselage = 1.0 - smoothstep(1.18, 1.72, rrAbsX);
float rrSideSkin = smoothstep(0.56, 0.82, rrAbsX) * rrFuselage;
float rrLongitudinal = rrRange(rrP.z, -2.75, 19.05, 0.24);
float rrStripeDomain = rrFuselage * rrLongitudinal;

float rrUpperBlue = rrRange(rrP.y, 2.75, 2.91, 0.025) * rrStripeDomain;
float rrLowerBlue = rrRange(rrP.y, 2.58, 2.75, 0.025) * rrStripeDomain;
float rrSeparator = rrRange(rrP.y, 2.49, 2.59, 0.018) * rrStripeDomain;
float rrLowerRed = rrRange(rrP.y, 2.35, 2.50, 0.022) * rrStripeDomain;
diffuseColor.rgb = mix(diffuseColor.rgb, rrBlue, max(rrUpperBlue, rrLowerBlue));
diffuseColor.rgb = mix(diffuseColor.rgb, rrSilver, rrSeparator);
diffuseColor.rgb = mix(diffuseColor.rgb, rrRed, rrLowerRed);

// The two physical fuselage sides need opposite object-space U directions so both titles read normally.
float rrTitleDomain = rrSideSkin * rrRange(rrP.z, -0.20, 6.65, 0.12) * rrRange(rrP.y, 2.93, 3.70, 0.05);
float rrTitleU = clamp((rrP.z + 0.20) / 6.85, 0.0, 1.0);
if (rrP.x > 0.0) rrTitleU = 1.0 - rrTitleU;
float rrTitleV = clamp((rrP.y - 2.93) / 0.77, 0.0, 1.0);
vec4 rrTitle = texture2D(americanEagleTitle, vec2(rrTitleU, rrTitleV));
diffuseColor.rgb = mix(diffuseColor.rgb, rrTitle.rgb, rrTitle.a * rrTitleDomain);

// Tail and engine identity are also surface masks, not retained boxes or planes.
float rrTail = rrRange(rrP.z, 20.55, 24.65, 0.18) * rrRange(rrP.y, 2.85, 6.65, 0.12) * (1.0 - smoothstep(0.55, 1.10, rrAbsX));
float rrTailPhase = fract((rrP.y + 0.52 * rrP.z) * 0.72);
vec3 rrTailColor = rrTailPhase < 0.28 ? rrRed : (rrTailPhase < 0.48 ? rrSilver : rrBlue);
diffuseColor.rgb = mix(diffuseColor.rgb, rrTailColor, rrTail);

float rrEngine = rrRange(rrP.z, 18.55, 20.75, 0.12) * rrRange(rrAbsX, 1.02, 1.82, 0.10) * rrRange(rrP.y, 2.25, 3.30, 0.10);
diffuseColor.rgb = mix(diffuseColor.rgb, rrBlue, rrEngine);

// The former floating square above the nose is replaced with paint on the upper nose skin.
float rrAntiGlare = rrRange(rrP.z, -4.90, -2.45, 0.16) * rrRange(rrP.y, 3.02, 3.92, 0.08) * (1.0 - smoothstep(0.56, 0.86, rrAbsX));
diffuseColor.rgb = mix(diffuseColor.rgb, rrCharcoal, rrAntiGlare);
`,
      );
  };

  return material;
}
