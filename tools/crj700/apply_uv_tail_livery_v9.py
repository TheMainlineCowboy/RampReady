#!/usr/bin/env python3
"""Map the American tail treatment directly onto the real fin and rudder geometry.

This pass keeps all paint physically constrained to the aircraft, uses one shared
position-derived UV frame across the fin and rudder seam, applies the actual modern
American red/silver/blue diagonal stripe sequence across the full fin, strengthens
the polished-metal finish, and removes incorrectly positioned procedural light spheres.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def apply_embedded_tail_livery(")
end = source.index("\ndef add_livery(", start)
replacement = r'''def apply_embedded_tail_livery(scene: trimesh.Scene, texture: Image.Image) -> None:
    """Texture the actual fin and rudder in one shared longitudinal/vertical UV frame."""
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
        # Shared UV coordinates keep every diagonal stripe continuous over the rudder seam.
        u = np.clip((mesh.vertices[:, 2] - z_min) / z_span, 0.0, 1.0)
        v = np.clip((mesh.vertices[:, 1] - y_min) / y_span, 0.0, 1.0)
        uv = np.column_stack([u, v])
        material = PBRMaterial(
            name=f"Embedded_American_Tail_{name}",
            baseColorTexture=texture,
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            metallicFactor=0.42,
            roughnessFactor=0.20,
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
    silver = (207, 211, 215, 255)
    bright = (239, 241, 243, 255)
    red = (191, 28, 46, 255)
    blue = (18, 66, 118, 255)
    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # Modern American tail: full-width diagonal red, bright-metal, and blue feathers.
    # The actual fin mesh supplies the silhouette, so nothing can float beyond its edges.
    sequence = [red, bright, blue, bright, red, bright, blue, bright,
                red, bright, blue, bright, red, bright, blue]
    pitch = 205
    thickness = 118
    slant = 300
    start_y = -120
    for index, color in enumerate(sequence):
        y0 = start_y + index * pitch
        y1 = y0 + thickness
        draw.polygon([
            (-420, y0 + slant),
            (width + 420, y0 - slant),
            (width + 420, y1 - slant),
            (-420, y1 + slant),
        ], fill=color)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Strengthen the polished metallic fuselage finish without washing it to white.
source = source.replace(
    'silver = make_material("American Eagle metallic silver", (0.78, 0.80, 0.82, 1.0), 0.46, 0.29)',
    'silver = make_material("American Eagle metallic silver", (0.70, 0.73, 0.77, 1.0), 0.78, 0.18)'
)
source = source.replace(
    'silver_light = make_material("Painted silver", (0.88, 0.89, 0.90, 1.0), 0.32, 0.34)',
    'silver_light = make_material("Painted silver", (0.79, 0.81, 0.84, 1.0), 0.58, 0.23)'
)

# The prior procedural navigation/beacon spheres were visibly floating because their
# coordinates did not match the transformed aircraft. Remove them until exact fixture
# locations are derived from the final integrated model.
source = source.replace("    add_lights(assembled)\n", "    # Procedural lights disabled: prior coordinates produced floating color markers.\n")

path.write_text(source, encoding="utf-8")
print("Applied full-width American tail stripes, polished metal, and removed floating lights")
