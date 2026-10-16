#!/usr/bin/env python3
"""Reference-matched American Eagle CRJ700 tail treatment.

The supplied multi-angle references consistently show blue/silver feathers in the
upper fin and red/silver feathers in the lower fin, not alternating red/blue bars.
This pass keeps the texture on the actual fin/rudder geometry and replaces only the
final tail texture generator after v12.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 3000, 3200
    silver = (206, 211, 216, 255)
    bright = (239, 240, 241, 255)
    blue = (15, 61, 111, 255)
    blue_mid = (23, 82, 137, 255)
    red = (194, 31, 47, 255)
    red_dark = (170, 25, 41, 255)
    dark_cap = (42, 45, 49, 255)

    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # Strong diagonal sweep seen in the side and rear-quarter references.
    # Positive slant places each band higher toward the trailing edge in UV space.
    slant = 980

    def band(y_center: float, thickness: float, color) -> None:
        y0 = y_center - thickness / 2
        y1 = y_center + thickness / 2
        draw.polygon([
            (-700, y0 + slant),
            (width + 700, y0 - slant),
            (width + 700, y1 - slant),
            (-700, y1 + slant),
        ], fill=color)

    # Upper fin: compact blue feather group separated by exposed polished silver.
    for center, color in [
        (250, blue), (585, blue_mid), (920, blue), (1255, blue_mid), (1590, blue)
    ]:
        band(center, 150, color)
        band(center + 190, 42, bright)

    # Lower fin/root: broader red feather group, matching the references where the
    # lower half and tailcone transition are predominantly red/silver.
    for center, color in [
        (1870, red_dark), (2245, red), (2620, red_dark), (2995, red)
    ]:
        band(center, 190, color)
        band(center + 228, 46, bright)

    # Narrow dark cap under the horizontal stabilizer.
    draw.polygon([(0, 0), (width, 0), (width, 115), (0, 230)], fill=dark_cap)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# The paint is directly on the real fin/rudder; make it read as painted metallic skin.
source = source.replace(
    'metallicFactor=0.20,\n            roughnessFactor=0.24,',
    'metallicFactor=0.30,\n            roughnessFactor=0.21,',
)

path.write_text(source, encoding="utf-8")
print("Applied v13 reference tail: blue upper feathers, red lower feathers, strong sweep")
