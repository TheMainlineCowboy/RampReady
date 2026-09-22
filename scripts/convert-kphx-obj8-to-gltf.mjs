import fs from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputDirectory, ...args] = process.argv;
if (!inputPath || !outputDirectory) {
  throw new Error("Usage: node scripts/convert-kphx-obj8-to-gltf.mjs <input.obj> <output-dir> [--name=AssetName] [--diffuse=texture.png] [--draped-diffuse=shadow.png] [--lit=texture_LIT.png] [--normal=texture_NML.png] [--normal-scale=1] [--draped-normal=shadow_NML.png] [--draped-normal-scale=1] [--weather=weather.png]");
}

const options = Object.fromEntries(args
  .filter((entry) => entry.startsWith("--") && entry.includes("="))
  .map((entry) => {
    const [key, ...value] = entry.slice(2).split("=");
    return [key, value.join("=")];
  }));

const source = await fs.readFile(inputPath, "utf8");
const vertices = [];
const indices = [];
const drawRanges = [];
const commands = new Map();
const parameterizedLights = [];
const vertexLights = [];
const namedLights = [];
let sourceTexture = null;
let sourceDrapedTexture = null;
let sourceLitTexture = null;
let sourceNormalTexture = null;
let sourceNormalScale = null;
let sourceDrapedNormalTexture = null;
let sourceDrapedNormalScale = null;
let sourceWeatherTexture = null;
let globalNoShadow = false;
let globalSpecular = null;
let globalAlphaCutoff = null;
let normalMetalness = false;
let pointCounts = null;
const drawState = {
  alphaMode: "BLEND",
  alphaCutoff: null,
  doubleSided: false,
  shade: "smooth",
  depthTest: true,
  drawEnabled: true,
  draped: false,
  layerGroupDraped: null,
  layerGroup: null,
  lodDraped: null,
  emissionRgb: [0, 0, 0],
  lodRange: null,
  shinyRatio: null,
};

const bump = (key) => commands.set(key, (commands.get(key) || 0) + 1);
let currentAnimationTranslation = [0, 0, 0];
const animationStack = [];
let activeRotation = null;
const snapshotState = () => ({
  ...drawState,
  xPlaneRestTranslation: [...currentAnimationTranslation],
});
const sceneryShadowsEnabled = String(options["scenery-shadows"] ?? "true").toLowerCase() !== "false";
let conditionalSkipDepth = 0;

for (const rawLine of source.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const parts = line.split(/\s+/);
  const command = parts[0];

  if (command === "IF") {
    const condition = parts.slice(1).join(" ");
    if (condition !== "NOT SCENERY_SHADOWS") {
      throw new Error(`Unsupported OBJ8 conditional: ${line}`);
    }
    bump(command);
    if (sceneryShadowsEnabled) conditionalSkipDepth += 1;
    continue;
  }
  if (command === "ENDIF") {
    bump(command);
    if (conditionalSkipDepth > 0) conditionalSkipDepth -= 1;
    continue;
  }
  if (conditionalSkipDepth > 0) continue;

  if (command === "ANIM_begin") {
    bump(command);
    animationStack.push([...currentAnimationTranslation]);
    continue;
  }
  if (command === "ANIM_end") {
    bump(command);
    if (!animationStack.length) throw new Error("OBJ8 ANIM_end without matching ANIM_begin");
    if (activeRotation) throw new Error("OBJ8 ANIM_end reached before ANIM_rotate_end");
    currentAnimationTranslation = animationStack.pop();
    continue;
  }
  if (command === "ANIM_trans") {
    bump(command);
    if (parts.length < 7) throw new Error(`Malformed ANIM_trans record: ${line}`);
    const start = parts.slice(1, 4).map(Number);
    const end = parts.slice(4, 7).map(Number);
    if ([...start, ...end].some((value) => !Number.isFinite(value))) {
      throw new Error(`Malformed ANIM_trans coordinates: ${line}`);
    }
    const delta = end.map((value, index) => Math.abs(value - start[index]));
    if (delta.some((value) => value > 1e-7)) {
      throw new Error(`Animated OBJ8 translation cannot be reduced to exact rest pose: ${line}`);
    }
    currentAnimationTranslation = currentAnimationTranslation.map((value, index) => value + start[index]);
    continue;
  }
  if (command === "ANIM_rotate_begin") {
    bump(command);
    if (parts.length < 5) throw new Error(`Malformed ANIM_rotate_begin record: ${line}`);
    const axis = parts.slice(1, 4).map(Number);
    const dataref = parts.slice(4).join(" ");
    if (axis.some((value) => !Number.isFinite(value))) throw new Error(`Malformed ANIM rotation axis: ${line}`);
    if (dataref !== "marginal/groundtraffic/distance") {
      throw new Error(`Unsupported OBJ8 animation dataref: ${dataref}`);
    }
    if (activeRotation) throw new Error("Nested ANIM_rotate_begin is unsupported");
    activeRotation = { axis, dataref, keys: [], loop: null };
    continue;
  }
  if (command === "ANIM_rotate_key") {
    bump(command);
    if (!activeRotation || parts.length < 3) throw new Error(`Malformed ANIM_rotate_key record: ${line}`);
    const value = Number(parts[1]);
    const angleDegrees = Number(parts[2]);
    if (!Number.isFinite(value) || !Number.isFinite(angleDegrees)) throw new Error(`Malformed ANIM_rotate_key values: ${line}`);
    activeRotation.keys.push({ value, angleDegrees });
    continue;
  }
  if (command === "ANIM_keyframe_loop") {
    bump(command);
    if (!activeRotation || parts.length < 2) throw new Error(`Malformed ANIM_keyframe_loop record: ${line}`);
    const loop = Number(parts[1]);
    if (!Number.isFinite(loop) || loop <= 0) throw new Error(`Malformed ANIM_keyframe_loop value: ${line}`);
    activeRotation.loop = loop;
    continue;
  }
  if (command === "ANIM_rotate_end") {
    bump(command);
    if (!activeRotation) throw new Error("OBJ8 ANIM_rotate_end without ANIM_rotate_begin");
    const zeroKey = activeRotation.keys.find((key) => Math.abs(key.value) <= 1e-7);
    if (!zeroKey || Math.abs(zeroKey.angleDegrees) > 1e-7) {
      throw new Error("GroundTraffic animation does not have an exact zero-distance 0-degree rest pose");
    }
    activeRotation = null;
    continue;
  }

  bump(command);

  if (command === "TEXTURE") sourceTexture = parts.slice(1).join(" ");
  else if (command === "TEXTURE_DRAPED") sourceDrapedTexture = parts.slice(1).join(" ");
  else if (command === "TEXTURE_LIT") sourceLitTexture = parts.slice(1).join(" ");
  else if (command === "TEXTURE_NORMAL" || command === "TEXTURE_DRAPED_NORMAL") {
    if (parts.length < 2) throw new Error(`Malformed ${command} record: ${line}`);
    const maybeScale = Number(parts[1]);
    const scale = Number.isFinite(maybeScale) && parts.length >= 3 ? maybeScale : 1;
    const texture = Number.isFinite(maybeScale) && parts.length >= 3
      ? parts.slice(2).join(" ")
      : parts.slice(1).join(" ");
    if (command === "TEXTURE_DRAPED_NORMAL") {
      sourceDrapedNormalScale = scale;
      sourceDrapedNormalTexture = texture;
    } else {
      sourceNormalScale = scale;
      sourceNormalTexture = texture;
    }
  } else if (command === "WEATHER") {
    if (parts.length < 2) throw new Error(`Malformed WEATHER record: ${line}`);
    sourceWeatherTexture = parts.slice(1).join(" ");
  } else if (command === "GLOBAL_no_shadow") globalNoShadow = true;
  else if (command === "SPECULAR") {
    const value = Number(parts[1]);
    globalSpecular = Number.isFinite(value) ? value : parts.slice(1).join(" ");
  }
  else if (command === "POINT_COUNTS") pointCounts = parts.slice(1).map(Number);
  else if (command === "VT") {
    if (parts.length < 9) throw new Error(`Malformed VT record: ${line}`);
    vertices.push(parts.slice(1, 9).map(Number));
  } else if (command === "IDX" || command === "IDX10") {
    indices.push(...parts.slice(1).map(Number));
  } else if (command === "LIGHT_PARAM") {
    if (parts.length < 5) throw new Error(`Malformed LIGHT_PARAM record: ${line}`);
    parameterizedLights.push({
      name: parts[1],
      position: parts.slice(2, 5).map(Number),
      params: parts.slice(5).map(Number),
      raw: line,
    });
  } else if (command === "VLIGHT") {
    if (parts.length < 7) throw new Error(`Malformed VLIGHT record: ${line}`);
    vertexLights.push({
      position: parts.slice(1, 4).map(Number),
      rgb: parts.slice(4, 7).map(Number),
      raw: line,
    });
  } else if (command === "LIGHT_NAMED") {
    if (parts.length < 5) throw new Error(`Malformed LIGHT_NAMED record: ${line}`);
    namedLights.push({
      position: parts.slice(1, 4).map(Number),
      name: parts[4],
      params: parts.slice(5).map(Number),
      raw: line,
    });
  } else if (command === "ATTR_draped") drawState.draped = true;
  else if (command === "ATTR_no_draped") drawState.draped = false;
  else if (command === "ATTR_layer_group_draped") {
    if (parts.length < 3) throw new Error(`Malformed ATTR_layer_group_draped record: ${line}`);
    drawState.layerGroupDraped = { group: parts[1], offset: Number(parts[2]) };
  } else if (command === "ATTR_LOD_draped") {
    drawState.lodDraped = Number(parts[1]);
  } else if (command === "ATTR_LOD") {
    if (parts.length < 3) throw new Error(`Malformed ATTR_LOD record: ${line}`);
    drawState.lodRange = [Number(parts[1]), Number(parts[2])];
  } else if (command === "ATTR_emission_rgb") {
    drawState.emissionRgb = parts.slice(1, 4).map(Number);
  } else if (command === "TRIS") {
    if (parts.length !== 3) throw new Error(`Malformed TRIS record: ${line}`);
    if (drawState.drawEnabled) {
      drawRanges.push({
        start: Number(parts[1]),
        count: Number(parts[2]),
        state: snapshotState(),
      });
    }
  } else if (command === "GLOBAL_no_blend") {
    const cutoff = Number(parts[1]);
    globalAlphaCutoff = Number.isFinite(cutoff) ? cutoff : 0.5;
    drawState.alphaMode = "MASK";
    drawState.alphaCutoff = globalAlphaCutoff;
  } else if (command === "GLOBAL_specular") {
    const value = Number(parts[1]);
    globalSpecular = Number.isFinite(value) ? value : parts.slice(1).join(" ");
  } else if (command === "ATTR_poly_os") {
    const value = Number(parts[1]);
    if (!Number.isFinite(value)) throw new Error(`Malformed ATTR_poly_os record: ${line}`);
    if (value !== 0) {
      throw new Error(`Active OBJ8 ATTR_poly_os ${value} is unsupported because glTF has no core polygon-offset material state`);
    }
  } else if (command === "ATTR_blend") drawState.alphaMode = "BLEND";
  else if (command === "ATTR_no_blend") drawState.alphaMode = "OPAQUE";
  else if (command === "ATTR_cull") drawState.doubleSided = false;
  else if (command === "ATTR_no_cull") drawState.doubleSided = true;
  else if (command === "ATTR_shade_smooth") drawState.shade = "smooth";
  else if (command === "ATTR_shade_flat") drawState.shade = "flat";
  else if (command === "ATTR_depth") drawState.depthTest = true;
  else if (command === "ATTR_no_depth") drawState.depthTest = false;
  else if (command === "ATTR_draw_enable") drawState.drawEnabled = true;
  else if (command === "ATTR_draw_disable") drawState.drawEnabled = false;
}

if (animationStack.length || activeRotation) throw new Error("OBJ8 animation block is unterminated");
if (!pointCounts) throw new Error("OBJ8 POINT_COUNTS record is missing");
if (pointCounts[0] !== vertices.length) {
  throw new Error(`OBJ8 vertex count mismatch: header=${pointCounts[0]} parsed=${vertices.length}`);
}
if (pointCounts[3] !== indices.length) {
  throw new Error(`OBJ8 index count mismatch: header=${pointCounts[3]} parsed=${indices.length}`);
}
if (!vertices.length || !indices.length || !drawRanges.length) throw new Error("OBJ8 geometry is incomplete");
if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= vertices.length)) {
  throw new Error("OBJ8 contains an out-of-range vertex index");
}
for (const range of drawRanges) {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.count) || range.start < 0 || range.count <= 0 || range.start + range.count > indices.length) {
    throw new Error(`Invalid TRIS draw range: ${JSON.stringify(range)}`);
  }
  if (range.count % 3 !== 0) throw new Error(`TRIS range is not triangle-aligned: ${JSON.stringify(range)}`);
  if (!range.state.depthTest) {
    throw new Error("OBJ8 ATTR_no_depth is not yet supported because glTF has no core per-material depth-test control");
  }
  if (range.state.shade === "flat") {
    throw new Error("OBJ8 ATTR_shade_flat is not yet supported without changing source normals");
  }
}

const harmless = new Set([
  "A", "I", "800", "OBJ", "TEXTURE", "TEXTURE_DRAPED", "TEXTURE_LIT", "TEXTURE_DRAPED_NORMAL", "TEXTURE_NORMAL", "WEATHER", "POINT_COUNTS",
  "VT", "IDX", "IDX10", "TRIS", "LIGHT_PARAM", "VLIGHT", "LIGHT_NAMED", "#",
  "ATTR_shade_smooth", "ATTR_shade_flat",
  "ATTR_no_hard", "ATTR_hard",
  "ATTR_cull", "ATTR_no_cull",
  "ATTR_depth", "ATTR_no_depth",
  "ATTR_blend", "ATTR_no_blend",
  "ATTR_draw_enable", "ATTR_draw_disable",
  "ATTR_draped", "ATTR_no_draped",
  "ATTR_emission_rgb",
  "ATTR_LOD_draped",
  "ATTR_LOD",
  "ATTR_layer_group_draped",
  "ATTR_layer_group",
  "ATTR_shiny_rat",
  "GLOBAL_no_shadow",
  "GLOBAL_no_blend",
  "GLOBAL_specular",
  "NORMAL_METALNESS",
  "SPECULAR",
  "ATTR_no_solid_camera", "ATTR_solid_camera",
  "IF", "ENDIF", "ATTR_poly_os",
  "ANIM_begin", "ANIM_trans", "ANIM_rotate_begin", "ANIM_rotate_key",
  "ANIM_keyframe_loop", "ANIM_rotate_end", "ANIM_end",
]);
const unsupported = [...commands.keys()].filter((command) => !harmless.has(command));
if (unsupported.length) {
  throw new Error(`Unsupported OBJ8 commands would affect source fidelity: ${unsupported.join(", ")}`);
}

const name = options.name || path.basename(inputPath).replace(/\.[^.]+$/, "");
const diffuseUri = options.diffuse || sourceTexture;
const drapedDiffuseUri = options["draped-diffuse"] || sourceDrapedTexture;
const litUri = options.lit || sourceLitTexture;
const normalUri = options.normal || sourceNormalTexture;
const normalScale = Number(options["normal-scale"] ?? sourceNormalScale ?? 1);
const drapedNormalUri = options["draped-normal"] || sourceDrapedNormalTexture;
const drapedNormalScale = Number(options["draped-normal-scale"] ?? sourceDrapedNormalScale ?? 1);
const weatherUri = options.weather || sourceWeatherTexture;
if (!diffuseUri || /^none$/i.test(diffuseUri)) throw new Error("OBJ8 source has no usable diffuse texture reference");

const positions = vertices.map((row) => row.slice(0, 3));
const normals = vertices.map((row) => row.slice(3, 6));
const uvs = vertices.map((row) => row.slice(6, 8));
const chunks = [];
let binaryByteLength = 0;
const bufferViews = [];
const accessors = [];

function appendPadding() {
  const padding = (4 - (binaryByteLength % 4)) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    binaryByteLength += padding;
  }
}

function componentBounds(rows, componentCount) {
  const min = Array(componentCount).fill(Infinity);
  const max = Array(componentCount).fill(-Infinity);
  for (const row of rows) {
    for (let index = 0; index < componentCount; index += 1) {
      min[index] = Math.min(min[index], row[index]);
      max[index] = Math.max(max[index], row[index]);
    }
  }
  return { min, max };
}

function appendFloatAccessor(rows, componentCount, target) {
  appendPadding();
  const byteOffset = binaryByteLength;
  const chunk = Buffer.alloc(rows.length * componentCount * 4);
  let cursor = 0;
  for (const row of rows) {
    for (let index = 0; index < componentCount; index += 1) {
      chunk.writeFloatLE(row[index], cursor);
      cursor += 4;
    }
  }
  chunks.push(chunk);
  binaryByteLength += chunk.length;
  const bufferView = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset, byteLength: chunk.length, target });
  const bounds = componentBounds(rows, componentCount);
  const accessor = accessors.length;
  accessors.push({
    bufferView,
    componentType: 5126,
    count: rows.length,
    type: componentCount === 2 ? "VEC2" : "VEC3",
    min: bounds.min,
    max: bounds.max,
  });
  return accessor;
}

function indexBounds(start, count) {
  let min = Infinity;
  let max = -Infinity;
  for (let cursor = start; cursor < start + count; cursor += 1) {
    min = Math.min(min, indices[cursor]);
    max = Math.max(max, indices[cursor]);
  }
  return { min, max };
}

const positionAccessor = appendFloatAccessor(positions, 3, 34962);
const normalAccessor = appendFloatAccessor(normals, 3, 34962);
const uvAccessor = appendFloatAccessor(uvs, 2, 34962);
const restPositionAccessorByTranslation = new Map([["0,0,0", positionAccessor]]);

function positionAccessorForRange(range) {
  const translation = range.state.xPlaneRestTranslation || [0, 0, 0];
  const normalized = translation.map((value) => Math.abs(value) <= 1e-12 ? 0 : value);
  const key = normalized.join(",");
  if (restPositionAccessorByTranslation.has(key)) return restPositionAccessorByTranslation.get(key);
  const translated = positions.map((row) => [
    row[0] + normalized[0],
    row[1] + normalized[1],
    row[2] + normalized[2],
  ]);
  const accessor = appendFloatAccessor(translated, 3, 34962);
  restPositionAccessorByTranslation.set(key, accessor);
  return accessor;
}

let maxIndex = -Infinity;
for (const index of indices) maxIndex = Math.max(maxIndex, index);
const indexComponentType = maxIndex <= 65535 ? 5123 : 5125;
const indexBytes = indexComponentType === 5123 ? 2 : 4;
appendPadding();
const indexByteOffset = binaryByteLength;
const convertedIndices = indices.slice();
for (const range of drawRanges) {
  for (let cursor = range.start; cursor < range.start + range.count; cursor += 3) {
    [convertedIndices[cursor + 1], convertedIndices[cursor + 2]] = [
      convertedIndices[cursor + 2],
      convertedIndices[cursor + 1],
    ];
  }
}
const indexChunk = Buffer.alloc(convertedIndices.length * indexBytes);
convertedIndices.forEach((value, index) => {
  if (indexComponentType === 5123) indexChunk.writeUInt16LE(value, index * indexBytes);
  else indexChunk.writeUInt32LE(value, index * indexBytes);
});
chunks.push(indexChunk);
binaryByteLength += indexChunk.length;
const indexBufferView = bufferViews.length;
bufferViews.push({ buffer: 0, byteOffset: indexByteOffset, byteLength: indexChunk.length, target: 34963 });

const xPlaneTextureInfo = (index) => ({
  index,
  extensions: {
    KHR_texture_transform: {
      offset: [0, 1],
      scale: [1, -1],
    },
  },
});

const images = [{ uri: diffuseUri }];
const textures = [{ sampler: 0, source: 0 }];
let drapedDiffuseTextureIndex = null;
let litTextureIndex = null;
let normalTextureIndex = null;
let drapedNormalTextureIndex = null;
if (drapedDiffuseUri && !/^none$/i.test(drapedDiffuseUri)) {
  images.push({ uri: drapedDiffuseUri });
  textures.push({ sampler: 0, source: images.length - 1 });
  drapedDiffuseTextureIndex = textures.length - 1;
}
if (litUri && !/^none$/i.test(litUri)) {
  images.push({ uri: litUri });
  textures.push({ sampler: 0, source: images.length - 1 });
  litTextureIndex = textures.length - 1;
}
if (normalUri && !/^none$/i.test(normalUri)) {
  images.push({ uri: normalUri });
  textures.push({ sampler: 0, source: images.length - 1 });
  normalTextureIndex = textures.length - 1;
}
if (drapedNormalUri && !/^none$/i.test(drapedNormalUri)) {
  images.push({ uri: drapedNormalUri });
  textures.push({ sampler: 0, source: images.length - 1 });
  drapedNormalTextureIndex = textures.length - 1;
}
let weatherImageIndex = null;
if (weatherUri && !/^none$/i.test(weatherUri)) {
  images.push({ uri: weatherUri });
  weatherImageIndex = images.length - 1;
}

const materialByState = new Map();
const materials = [];
function materialIndexForState(state) {
  const key = JSON.stringify({
    alphaMode: state.alphaMode,
    alphaCutoff: state.alphaCutoff,
    doubleSided: state.doubleSided,
    draped: state.draped,
    layerGroupDraped: state.layerGroupDraped,
    layerGroup: state.layerGroup,
    emissionRgb: state.emissionRgb,
    lodRange: state.lodRange,
    shinyRatio: state.shinyRatio,
  });
  if (materialByState.has(key)) return materialByState.get(key);
  const material = {
    name: `${name} source material ${materials.length}`,
    pbrMetallicRoughness: {
      baseColorTexture: xPlaneTextureInfo(
        state.draped && drapedDiffuseTextureIndex !== null
          ? drapedDiffuseTextureIndex
          : 0
      ),
      metallicFactor: 0,
      roughnessFactor: 1,
    },
    doubleSided: state.doubleSided,
    alphaMode: state.alphaMode,
    ...(state.alphaMode === "MASK"
      ? { alphaCutoff: state.alphaCutoff ?? 0.5 }
      : {}),
    emissiveFactor: state.emissionRgb,
    extras: {
      xPlaneDraped: state.draped === true,
      xPlaneLayerGroupDraped: state.layerGroupDraped,
      xPlaneLayerGroup: state.layerGroup,
      xPlaneLodDraped: state.lodDraped,
      xPlaneEmissionRgb: state.emissionRgb,
      xPlaneLodRange: state.lodRange,
      xPlaneShinyRatio: state.shinyRatio,
      xPlaneGlobalSpecular: globalSpecular,
      xPlaneGlobalAlphaCutoff: globalAlphaCutoff,
      xPlaneNormalMetalness: normalMetalness,
    },
  };
  if (!state.draped && litTextureIndex !== null) {
    material.emissiveTexture = xPlaneTextureInfo(litTextureIndex);
    material.emissiveFactor = [1, 1, 1];
  }
  const selectedNormalTextureIndex = state.draped && drapedNormalTextureIndex !== null
    ? drapedNormalTextureIndex
    : normalTextureIndex;
  const selectedNormalScale = state.draped && drapedNormalTextureIndex !== null
    ? drapedNormalScale
    : normalScale;
  if (selectedNormalTextureIndex !== null) {
    material.normalTexture = {
      ...xPlaneTextureInfo(selectedNormalTextureIndex),
      scale: Number.isFinite(selectedNormalScale) ? selectedNormalScale : 1,
    };
  }
  const index = materials.length;
  materials.push(material);
  materialByState.set(key, index);
  return index;
}

const primitives = drawRanges.map((range) => {
  const bounds = indexBounds(range.start, range.count);
  const accessor = accessors.length;
  accessors.push({
    bufferView: indexBufferView,
    byteOffset: range.start * indexBytes,
    componentType: indexComponentType,
    count: range.count,
    type: "SCALAR",
    min: [bounds.min],
    max: [bounds.max],
  });
  return {
    attributes: { POSITION: positionAccessorForRange(range), NORMAL: normalAccessor, TEXCOORD_0: uvAccessor },
    indices: accessor,
    material: materialIndexForState(range.state),
    mode: 4,
    extras: {
      xPlaneDrawState: range.state,
    },
  };
});

const outputBinary = Buffer.concat(chunks, binaryByteLength);
const gltf = {
  asset: { version: "2.0", generator: "RampReady exact X-Plane OBJ8 converter v2" },
  extensionsUsed: ["KHR_texture_transform"],
  buffers: [{ uri: `${name}.bin`, byteLength: outputBinary.length }],
  bufferViews,
  accessors,
  images,
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  textures,
  materials,
  meshes: [{ name, primitives }],
  nodes: [{
    name,
    mesh: 0,
    extras: {
      xPlaneParameterizedLights: parameterizedLights,
      xPlaneVertexLights: vertexLights,
      xPlaneNamedLights: namedLights,
      xPlaneGlobalNoShadow: globalNoShadow,
      xPlaneGlobalSpecular: globalSpecular,
      xPlaneWeatherTexture: weatherImageIndex !== null ? weatherUri : null,
    },
  }],
  scenes: [{ nodes: [0] }],
  scene: 0,
  extras: {
    sourceFormat: "X-Plane OBJ8",
    sourceFile: path.basename(inputPath),
    sourceTexture,
    sourceDrapedTexture,
    sourceLitTexture,
    sourceNormalTexture,
    sourceNormalScale,
    sourceDrapedNormalTexture,
    sourceDrapedNormalScale,
    sourceWeatherTexture,
    globalNoShadow,
    globalSpecular,
    globalAlphaCutoff,
    normalMetalness,
    pointCounts,
    vertexCount: vertices.length,
    indexCount: indices.length,
    triangleCount: drawRanges.reduce((sum, range) => sum + range.count, 0) / 3,
    drawRanges,
    parameterizedLightCount: parameterizedLights.length,
    parameterizedLights,
    vertexLightCount: vertexLights.length,
    vertexLights,
    namedLightCount: namedLights.length,
    namedLights,
    sourceBounds: { min: accessors[positionAccessor].min, max: accessors[positionAccessor].max },
    geometryPolicy: "preserve-source-positions-normals-uvs-topology-no-remesh-no-decimation;convert-X-Plane-clockwise-TRIS-to-glTF-counterclockwise-winding",
    drawStatePolicy: "preserve-supported-per-TRIS-blend-and-cull-state;honor-IF-NOT-SCENERY_SHADOWS;bake-exact-zero-distance-GroundTraffic-rest-translation;reject-unsupported-render-state",
    sceneryShadowsEnabled,
    textureCoordinatePolicy: "preserve-source-uv-buffer-and-flip-v-at-material-level-for-gltf-upper-left-image-origin",
  },
};

await fs.mkdir(outputDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(outputDirectory, `${name}.bin`), outputBinary),
  fs.writeFile(path.join(outputDirectory, `${name}.gltf`), `${JSON.stringify(gltf, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  name,
  source: inputPath,
  vertexCount: vertices.length,
  indexCount: indices.length,
  triangleCount: gltf.extras.triangleCount,
  drawRangeCount: drawRanges.length,
  materialCount: materials.length,
  sourceBounds: gltf.extras.sourceBounds,
  diffuseUri,
  drapedDiffuseUri: drapedDiffuseTextureIndex !== null ? drapedDiffuseUri : null,
  litUri: litTextureIndex !== null ? litUri : null,
  normalUri: normalTextureIndex !== null ? normalUri : null,
  normalScale: normalTextureIndex !== null ? normalScale : null,
  drapedNormalUri: drapedNormalTextureIndex !== null ? drapedNormalUri : null,
  drapedNormalScale: drapedNormalTextureIndex !== null ? drapedNormalScale : null,
  weatherUri: weatherImageIndex !== null ? weatherUri : null,
  globalNoShadow,
  globalSpecular,
  globalAlphaCutoff,
  normalMetalness,
  geometryPolicy: gltf.extras.geometryPolicy,
  drawStatePolicy: gltf.extras.drawStatePolicy,
  textureCoordinatePolicy: gltf.extras.textureCoordinatePolicy,
}, null, 2));
