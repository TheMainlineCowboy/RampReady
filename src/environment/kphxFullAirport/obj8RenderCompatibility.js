export function reverseIndexedTriangleWinding(geometry, label = "OBJ8 mesh") {
  const index = geometry?.getIndex?.();
  if (!index) throw new Error(`${label} lost its indexed triangle topology`);
  if (index.count % 3 !== 0) throw new Error(`${label} index count is not triangle-aligned`);
  const array = index.array;
  for (let cursor = 0; cursor < index.count; cursor += 3) {
    const tmp = array[cursor + 1];
    array[cursor + 1] = array[cursor + 2];
    array[cursor + 2] = tmp;
  }
  index.needsUpdate = true;
}

function applyLegacyXPlaneTextureVTransform(texture) {
  if (!texture || texture.userData?.xPlaneLegacyTextureVCorrected === true) return;
  texture.matrixAutoUpdate = false;
  texture.matrix.setUvTransform(0, 1, 1, -1, 0, 0, 0);
  texture.userData = {
    ...(texture.userData || {}),
    xPlaneLegacyTextureVCorrected: true,
    xPlaneTextureCoordinateTransform: "offset[0,1]-scale[1,-1]",
  };
  texture.needsUpdate = true;
}

export function applyExactXp11Obj8MaskCompatibility(
  THREE,
  root,
  {
    label = "exact XP11 OBJ8",
    alphaCutoff = 0.5,
    windingAlreadyConverted = false,
    correctLegacyTextureV = false,
  } = {},
) {
  if (!root?.traverse) throw new Error(`${label} scene root is required`);
  if (root.userData?.xPlaneObj8MaskCompatibilityApplied === true) return root;

  root.traverse((node) => {
    if (!node?.isMesh) return;
    if (!windingAlreadyConverted) reverseIndexedTriangleWinding(node.geometry, label);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.side = THREE.FrontSide;
      material.transparent = false;
      material.opacity = 1;
      material.alphaTest = alphaCutoff;
      material.depthTest = true;
      material.depthWrite = true;
      if (correctLegacyTextureV) {
        applyLegacyXPlaneTextureVTransform(material.map);
        applyLegacyXPlaneTextureVTransform(material.emissiveMap);
        applyLegacyXPlaneTextureVTransform(material.normalMap);
      }
      material.needsUpdate = true;
    }
  });

  root.userData = {
    ...(root.userData || {}),
    xPlaneObj8MaskCompatibilityApplied: true,
    xPlaneObj8Winding: windingAlreadyConverted
      ? "converter-counterclockwise"
      : "legacy-runtime-clockwise-to-counterclockwise",
    xPlaneObj8BlendMode: `no-blend alpha-test ${alphaCutoff}`,
    xPlaneObj8CullMode: "one-sided",
    xPlaneObj8LegacyTextureVCorrected: correctLegacyTextureV === true,
  };
  return root;
}
