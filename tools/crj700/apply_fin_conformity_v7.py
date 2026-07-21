#!/usr/bin/env python3
"""Constrain American Eagle tail paint to the actual CRJ700 fin silhouette.

The prior direct Three.js artifact still showed colored feather rows projecting beyond
both fin edges. This pass replaces the texture mask and support surface with a much
narrower swept trapezoid and explicitly enforces alpha-masked rendering.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2600, 3000
    paint = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(paint)
    blue = (18, 68, 120, 255)
    red = (194, 31, 47, 255)
    dark_cap = (50, 52, 55, 255)

    # Seven broad feather rows, matching the reference rhythm while leaving metal gaps.
    centers = [390, 760, 1130, 1500, 1870, 2240, 2610]
    thickness = 128
    slant = 74
    for center_y in centers:
        y0, y1 = center_y - thickness / 2, center_y + thickness / 2
        split = width * (0.49 + 0.07 * (center_y / height))
        gap = 34
        draw.polygon([
            (-120, y0 + slant), (split - gap, y0 - 5),
            (split - gap - 28, y1 + 7), (-120, y1 + slant)
        ], fill=red)
        draw.polygon([
            (split + gap + 28, y0 - 7), (width + 120, y0 - slant),
            (width + 120, y1 - slant), (split + gap, y1 + 5)
        ], fill=blue)

    draw.polygon([(900, 145), (1680, 125), (1625, 245), (940, 285)], fill=dark_cap)

    # Deliberately conservative fin silhouette. The prior mask was wider than the real
    # vertical stabilizer and produced floating blades in side and tail-close views.
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).polygon([
        (930, 300),   # cap leading edge
        (1660, 260),  # cap trailing edge
        (1970, 2820), # root trailing edge
        (610, 2820),  # root leading edge
    ], fill=255)
    paint.putalpha(Image.composite(paint.getchannel("A"), Image.new("L", (width, height), 0), mask))

    if mirrored:
        paint = paint.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    paint.save(path)
    return paint
''' + source[end:]

# Replace the broad rectangular support with a fin-following swept trapezoid.
start = source.index("def flat_tail_decal(")
end = source.index("\n\ndef tapered_curved_decal_mesh", start)
source = source[:start] + '''def flat_tail_decal(texture: Image.Image, name: str, side: int, z_front: float, z_rear: float,
                         y_bottom: float, y_top: float, x_offset: float, mirror_uv: bool) -> trimesh.Trimesh:
    nz, ny = 40, 54
    vertices, uv = [], []
    for row in range(ny + 1):
        v = row / ny
        y = y_bottom + (y_top - y_bottom) * v
        # The real fin narrows rapidly toward the cap and sweeps aft. Keep the decal
        # surface inside that envelope rather than spanning a rectangular billboard.
        row_front = z_front - 2.48 * v
        row_rear = z_rear - 0.94 * v
        inset = 0.13 + 0.20 * v
        front = row_front - inset
        rear = row_rear + inset
        x = side * (x_offset * (1.0 - 0.22 * v) + 0.010)
        for column in range(nz + 1):
            u = column / nz
            vertices.append((x, y, front + (rear - front) * u))
            uv.append((1.0 - u if mirror_uv else u, v))
    faces = []
    columns = nz + 1
    for row in range(ny):
        for column in range(nz):
            a = row * columns + column
            b, c, d = a + 1, (row + 1) * columns + column, (row + 1) * columns + column + 1
            faces.extend([(a, d, c), (a, b, d)] if side > 0 else [(a, c, d), (a, d, b)])
    material = PBRMaterial(
        name=name, baseColorTexture=texture,
        baseColorFactor=[1.0, 1.0, 1.0, 1.0], metallicFactor=0.08,
        roughnessFactor=0.28, alphaMode="MASK", alphaCutoff=0.10,
        doubleSided=False,
    )
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh
''' + source[end:]

path.write_text(source, encoding="utf-8")
print("Applied v7 fin conformity: conservative mask and fin-following support geometry")
