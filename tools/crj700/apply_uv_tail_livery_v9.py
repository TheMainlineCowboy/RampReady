#!/usr/bin/env python3
"""Map the American tail treatment directly onto the real fin and rudder geometry.

This pass keeps all paint physically constrained to the aircraft, uses one shared
position-derived UV frame across the fin and rudder seam, and replaces the broad
horizontal bars with tapered diagonal feather elements matching the modern
American Airlines tail rhythm.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def apply_embedded_tail_livery(")
end = source.index("\ndef add_livery(", start)
replacement = r'''def apply_embedded_tail_livery(scene: trimesh.Scene, texture: Image.Image) -> None:
    """Texture the actual fin and rudder in a shared longitudinal/vertical UV frame."""
    selected = []
    for name, mesh in scene.geometry.items():
        lower = name.lower()
        if ("vstab" in lower or "rudder_default" in lower) and "wire" not in lower:
            selected.append((name, mesh))
    if len(selected) < 2:
        raise RuntimeError(f"Expected fin and rudder geometry, found {len(selected)}")

    all_vertices = np.vstack([mesh.vertices for _, mesh in selected])
    z_min, z_max = float(all_vertices[:, 2].min()), float(all_vertices[:, 2].max())
    y_min, y_max = float(all_vertices[:, 1].min()), float(all_vertices[:, 1].max())
    z_span = max(z_max - z_min, 1e-6)
    y_span = max(y_max - y_min, 1e-6)

    for name, mesh in selected:
        # Longitudinal position drives texture X; height drives texture Y.  Both
        # meshes use the same frame so feathers cross the rudder seam cleanly.
        u = np.clip((mesh.vertices[:, 2] - z_min) / z_span, 0.0, 1.0)
        v = np.clip((mesh.vertices[:, 1] - y_min) / y_span, 0.0, 1.0)
        uv = np.column_stack([u, v])
        material = PBRMaterial(
            name=f"Embedded_American_Tail_{name}",
            baseColorTexture=texture,
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            metallicFactor=0.34,
            roughnessFactor=0.23,
            alphaMode="OPAQUE",
            doubleSided=True,
        )
        mesh.visual = TextureVisuals(uv=uv, material=material)
'''
source = source[:start] + replacement + source[end:]
source = source.replace("    apply_embedded_tail_livery(scene)\n", "    apply_embedded_tail_livery(scene, tail)\n")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2400, 2800
    silver = (205, 209, 213, 255)
    bright = (236, 238, 240, 255)
    red = (191, 28, 46, 255)
    blue = (20, 66, 116, 255)
    dark_cap = (52, 55, 59, 255)
    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # Modern American tail: narrow, tapered diagonal feathers.  Each feather
    # rises toward the aft/top of the fin and leaves metallic separators.
    feather_count = 9
    base_y = -360
    step_y = 350
    thickness = 185
    rise = 760
    split = int(width * 0.53)
    separator = 34
    taper = 145
    for index in range(feather_count):
        y0 = base_y + index * step_y
        y1 = y0 + thickness
        # Red forward/lower feather half.
        draw.polygon([
            (-220, y0 + rise),
            (split - separator, y0 + 80),
            (split - separator - taper, y1 + 30),
            (-220, y1 + rise + 60),
        ], fill=red)
        # Blue aft/upper feather half.
        draw.polygon([
            (split + separator + taper, y0 + 10),
            (width + 220, y0 - rise),
            (width + 220, y1 - rise + 60),
            (split + separator, y1 + 90),
        ], fill=blue)
        # Bright metallic highlight below each feather to preserve separation.
        draw.line([
            (-160, y1 + rise + 84),
            (width + 160, y1 - rise + 84),
        ], fill=bright, width=30)

    # Dark graphite cap at the very top, matching the polished reference target.
    draw.polygon([(0, 0), (width, 0), (width, 150), (0, 285)], fill=dark_cap)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Strengthen the polished metallic fuselage finish.  Keep paint light enough for
# ramp visibility while avoiding the flat white/primer appearance of prior runs.
source = source.replace(
    'silver = make_material("American Eagle metallic silver", (0.78, 0.80, 0.82, 1.0), 0.46, 0.29)',
    'silver = make_material("American Eagle metallic silver", (0.72, 0.75, 0.79, 1.0), 0.72, 0.20)'
)
source = source.replace(
    'silver_light = make_material("Painted silver", (0.88, 0.89, 0.90, 1.0), 0.32, 0.34)',
    'silver_light = make_material("Painted silver", (0.80, 0.82, 0.85, 1.0), 0.54, 0.25)'
)

path.write_text(source, encoding="utf-8")
print("Applied corrected diagonal tail feathers and polished metallic finish")
