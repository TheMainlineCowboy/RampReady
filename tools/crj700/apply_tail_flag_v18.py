#!/usr/bin/env python3
"""V18: continuous reference-driven American tail flag on the real fin/rudder.

V17 still rendered as two disconnected red/blue fields with an oversized metallic void
and shallow horizontal bars. This pass replaces that texture with one uninterrupted,
steeply swept red/silver/blue sequence mapped by the existing shared fin/rudder UV frame.
No decal support geometry is introduced.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2800, 3200
    silver = (210, 214, 218, 255)
    bright_silver = (239, 240, 241, 255)
    red = (194, 31, 47, 255)
    blue = (22, 75, 130, 255)
    navy = (13, 47, 91, 255)

    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # The real fin UV projection compresses texture slope heavily in side view. Use a
    # deliberately steep texture-space rise so the exported GLB shows the strongly
    # diagonal American flag rhythm seen in the supplied side and rear references.
    rise = 1900
    pitch = 310
    thickness = 150
    colors = [navy, red, blue, red, navy, red, blue, red, navy, red, blue, red]
    start_y = -1050

    for index, color in enumerate(colors):
        y0 = start_y + index * pitch
        y1 = y0 + thickness
        draw.polygon([
            (-700, y0 + rise),
            (width + 700, y0 - rise),
            (width + 700, y1 - rise),
            (-700, y1 + rise),
        ], fill=color)

        # Bright polished separator under each colored feather. The metallic base remains
        # visible between separators, avoiding flat painted-white blocks.
        sy0 = y1 + 42
        sy1 = sy0 + 42
        draw.polygon([
            (-700, sy0 + rise),
            (width + 700, sy0 - rise),
            (width + 700, sy1 - rise),
            (-700, sy1 + rise),
        ], fill=bright_silver)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Make the embedded tail read as polished painted metal rather than matte plastic.
source = source.replace(
    'metallicFactor=0.42,\n            roughnessFactor=0.20,',
    'metallicFactor=0.58,\n            roughnessFactor=0.16,',
)
source = source.replace(
    'metallicFactor=0.50,\n            roughnessFactor=0.18,',
    'metallicFactor=0.58,\n            roughnessFactor=0.16,',
)

path.write_text(source, encoding="utf-8")
print("Applied v18 continuous steep diagonal American tail flag")
