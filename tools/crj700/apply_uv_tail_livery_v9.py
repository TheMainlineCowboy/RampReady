#!/usr/bin/env python3
"""Map the tail artwork onto the real fin/rudder UVs instead of face-color triangles.

V8 eliminated detached decal blades but exposed coarse triangular face coloring. This pass
keeps the paint on the actual geometry while assigning a continuous texture and shared
position-derived UV coordinates across both the stabilizer and rudder.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def apply_embedded_tail_livery(")
end = source.index("\ndef add_livery(", start)
replacement = r'''def apply_embedded_tail_livery(scene: trimesh.Scene, texture: Image.Image) -> None:
    """Texture the actual fin and rudder using one shared geometry-derived UV frame."""
    selected = []
    for name, mesh in scene.geometry.items():
        lower = name.lower()
        if ("vstab" in lower or "rudder_default" in lower) and "wire" not in lower:
            selected.append((name, mesh))
    if len(selected) < 2:
        raise RuntimeError(f"Expected fin and rudder geometry, found {len(selected)}")

    all_vertices = np.vstack([mesh.vertices for _, mesh in selected])
    y_min, y_max = float(all_vertices[:, 1].min()), float(all_vertices[:, 1].max())
    z_min, z_max = float(all_vertices[:, 2].min()), float(all_vertices[:, 2].max())
    y_span = max(y_max - y_min, 1e-6)
    z_span = max(z_max - z_min, 1e-6)

    for name, mesh in selected:
        # Shared UV frame keeps stripe spacing continuous across the rudder seam.
        u = np.clip((mesh.vertices[:, 2] - z_min) / z_span, 0.0, 1.0)
        v = np.clip((mesh.vertices[:, 1] - y_min) / y_span, 0.0, 1.0)
        uv = np.column_stack([u, v])
        material = PBRMaterial(
            name=f"Embedded_American_Tail_{name}",
            baseColorTexture=texture,
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            metallicFactor=0.10,
            roughnessFactor=0.27,
            alphaMode="OPAQUE",
            doubleSided=False,
        )
        mesh.visual = TextureVisuals(uv=uv, material=material)
'''
source = source[:start] + replacement + source[end:]
source = source.replace("    apply_embedded_tail_livery(scene)\n", "    apply_embedded_tail_livery(scene, tail)\n")

# Replace the alpha-masked source with a continuous full-fin texture. The actual mesh
# boundary now provides the silhouette, so no transparent mask or support surface exists.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2400, 2800
    silver = (222, 225, 228, 255)
    bright = (240, 241, 242, 255)
    red = (194, 31, 47, 255)
    blue = (18, 68, 120, 255)
    dark_cap = (48, 50, 53, 255)
    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # Seven diagonal feather rows. Red occupies the aft portion, blue the forward
    # portion, and exposed metallic separators preserve the reference rhythm.
    centers = [250, 610, 970, 1330, 1690, 2050, 2410]
    thickness = 150
    slant = 110
    for center_y in centers:
        y0 = center_y - thickness / 2
        y1 = center_y + thickness / 2
        split = width * (0.48 + 0.10 * (center_y / height))
        gap = 30
        draw.polygon([
            (-180, y0 + slant), (split - gap, y0 - 8),
            (split - gap - 34, y1 + 10), (-180, y1 + slant)
        ], fill=red)
        draw.polygon([
            (split + gap + 34, y0 - 10), (width + 180, y0 - slant),
            (width + 180, y1 - slant), (split + gap, y1 + 8)
        ], fill=blue)
        # Narrow bright-metal highlight immediately below each feather row.
        draw.line([(-100, y1 + 30 + slant), (width + 100, y1 + 30 - slant)],
                  fill=bright, width=34)

    draw.polygon([(0, 0), (width, 0), (width, 180), (0, 300)], fill=dark_cap)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

path.write_text(source, encoding="utf-8")
print("Applied v9 continuous UV tail livery on actual fin and rudder geometry")
