#!/usr/bin/env python3
"""Reference-matched American Eagle CRJ700 tail correction.

V14 proved that the shared fin/rudder UV mapping is physically stable, but the rendered
pattern still read as shallow alternating zebra bars. This pass compensates for the
actual fin aspect ratio and matches the supplied references: five blue/silver feathers
in the upper fin, four broader red/silver feathers through the lower fin and root, with
one consistent aft-rising sweep and no detached decal geometry.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 3600, 3600
    silver = (214, 219, 224, 255)
    bright = (241, 243, 245, 255)
    red = (194, 30, 48, 255)
    blue = (20, 73, 128, 255)
    navy = (11, 48, 91, 255)

    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # The geometry-derived UV frame compresses texture slope when projected onto the
    # swept CRJ fin. A deliberately strong texture rise yields the moderate diagonal
    # feather angle visible in the supplied side and rear-quarter references.
    rise = 4100
    left = -1600
    right = width + 1600

    def feather(center_y: float, thickness: float, color) -> None:
        y0 = center_y - thickness / 2
        y1 = center_y + thickness / 2
        draw.polygon([
            (left, y0 + rise),
            (right, y0 - rise),
            (right, y1 - rise),
            (left, y1 + rise),
        ], fill=color)

    # Upper fin: five blue feathers with polished-metal gaps.
    for index, center_y in enumerate([430, 790, 1150, 1510, 1870]):
        feather(center_y, 180, navy if index in (0, 4) else blue)
        feather(center_y + 205, 54, bright)

    # Lower fin and root: four broader red feathers, as shown by the reference aircraft.
    for center_y in [2050, 2470, 2890, 3310]:
        feather(center_y, 225, red)
        feather(center_y + 255, 60, bright)

    # Narrow dark cap immediately under the horizontal stabilizer.
    draw.polygon([(0, 0), (width, 0), (width, 82), (0, 155)], fill=(39, 43, 47, 255))

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Keep the embedded fin/rudder paint metallic rather than plastic.
source = source.replace(
    'metallicFactor=0.38,\n            roughnessFactor=0.19,',
    'metallicFactor=0.44,\n            roughnessFactor=0.17,',
)

path.write_text(source, encoding="utf-8")
print("Applied v15 reference tail: blue upper feathers, red lower feathers, corrected sweep")
