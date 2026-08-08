#!/usr/bin/env python3
"""Reference correction v22: tapered American Eagle feather geometry.

Replaces the broad repeating diagonal bands with a finite set of separated,
tapered red and blue feather shapes. The transparent background leaves the
metallic fin visible between feathers and avoids an opaque rectangular panel.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")
start = source.index("def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:\n")
end = source.index("\n\ndef curved_decal_mesh", start)
replacement = '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 1600, 2000
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Fin silhouette in UV space. Keep all color inside this mask so the
    # underlying polished metallic fin remains visible between feather shapes.
    fin_mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(fin_mask).polygon(
        [(120, 1940), (1460, 1940), (1115, 80), (610, 80)], fill=255
    )

    feather_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    fd = ImageDraw.Draw(feather_layer)
    navy = (21, 55, 103, 255)
    blue = (32, 105, 168, 255)
    red = (190, 30, 45, 255)

    # Each polygon is a discrete swept feather, broad at the trailing edge and
    # narrowing toward the forward/lower root. Their staggered tips reproduce
    # the modern American flight-symbol rhythm rather than barcode-like bands.
    feathers = [
        (navy, [(1040, 110), (1250, 520), (1435, 705), (1370, 285)]),
        (blue, [(905, 160), (1115, 650), (1395, 910), (1310, 520)]),
        (red,  [(760, 250), (985, 780), (1350, 1110), (1250, 710)]),
        (navy, [(610, 390), (835, 930), (1295, 1315), (1165, 900)]),
        (blue, [(470, 565), (690, 1085), (1215, 1510), (1045, 1090)]),
        (red,  [(330, 790), (535, 1265), (1110, 1695), (910, 1290)]),
        (navy, [(205, 1060), (385, 1450), (960, 1880), (760, 1530)]),
        (blue, [(120, 1360), (255, 1650), (690, 1940), (545, 1660)]),
        (red,  [(95, 1645), (175, 1850), (395, 1940), (325, 1765)]),
    ]
    for color, polygon in feathers:
        fd.polygon(polygon, fill=color)

    # Clip feather geometry to the fin silhouette while preserving transparent
    # gaps as polished-metal separators.
    clipped_alpha = Image.composite(feather_layer.getchannel("A"), Image.new("L", (width, height), 0), fin_mask)
    feather_layer.putalpha(clipped_alpha)
    image.alpha_composite(feather_layer)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
'''
source = source[:start] + replacement + source[end:]
path.write_text(source, encoding="utf-8")
print("Applied v22 tapered American Eagle tail feather geometry")
