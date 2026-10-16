#!/usr/bin/env python3
"""Reference-driven visual refinement for the American Eagle CRJ700.

Runs after apply_livery_patch.py. Corrects the actual Three.js artifact rather than
producing a substitute render: accurate forward symbol proportions, reference-spaced
fin feathers, transparent metallic gaps, and a compact fuselage-hugging tail sweep.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def _draw_flight_symbol(")
end = source.index("\n\ndef create_wordmark_texture", start)
source = source[:start] + '''def _draw_flight_symbol(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float = 1.0) -> None:
    blue = (18, 105, 169, 255)
    red = (196, 30, 48, 255)

    # Slender upper feather reconstructed from the supplied fuselage close-ups.
    draw.polygon([
        (x + 34*scale, y + 16*scale), (x + 238*scale, y + 16*scale),
        (x + 205*scale, y + 48*scale), (x + 170*scale, y + 82*scale),
        (x + 132*scale, y + 120*scale), (x + 86*scale, y + 156*scale),
        (x + 12*scale, y + 156*scale), (x + 46*scale, y + 112*scale),
        (x + 77*scale, y + 79*scale), (x + 105*scale, y + 48*scale),
    ], fill=blue)

    # Lower red feather. The open diagonal gap between the two polygons is the
    # negative-space eagle channel; no white block is painted onto the silver body.
    draw.polygon([
        (x + 72*scale, y + 194*scale), (x + 136*scale, y + 194*scale),
        (x + 166*scale, y + 222*scale), (x + 242*scale, y + 222*scale),
        (x + 208*scale, y + 258*scale), (x + 177*scale, y + 300*scale),
        (x + 141*scale, y + 348*scale), (x + 14*scale, y + 348*scale),
        (x + 55*scale, y + 300*scale), (x + 88*scale, y + 256*scale),
        (x + 113*scale, y + 222*scale),
    ], fill=red)
''' + source[end:]

start = source.index("def create_wordmark_texture(")
end = source.index("\n\ndef _draw_us_flag", start)
source = source[:start] + '''def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (2920, 620), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    title_font = _italic_title_font(264)
    title_color = (69, 72, 75, 255)
    if mirrored:
        draw.text((38, 130), "American Eagle", font=title_font,
                  fill=title_color, stroke_width=1)
        _draw_flight_symbol(draw, 2588, 92, 1.04)
    else:
        _draw_flight_symbol(draw, 20, 92, 1.04)
        draw.text((320, 130), "American Eagle", font=title_font,
                  fill=title_color, stroke_width=1)
    image.save(path)
    return image
''' + source[end:]

# Six broad feather rows with a continuous swept center division. The alpha mask is
# deliberately conservative: the previous pass still showed red/blue blades beyond
# the physical leading and trailing edges in side and tail-close views.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2600, 3000
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    red = (194, 31, 47, 255)
    blue = (18, 68, 120, 255)
    dark_cap = (49, 51, 54, 255)

    draw.polygon([(720, 120), (1785, 120), (1710, 250), (790, 315)], fill=dark_cap)

    centers = [430, 875, 1320, 1765, 2210, 2655]
    thickness = 180
    total_slant = 190
    gap = 30
    center_top = width * 0.48
    center_bottom = width * 0.57

    def band_y(base: float, x: float) -> float:
        return base - total_slant * (x / width - 0.5)

    for cy in centers:
        top = cy - thickness / 2
        bottom = cy + thickness / 2
        fraction = cy / height
        split = center_top + (center_bottom - center_top) * fraction
        left = -100.0
        right = width + 100.0
        red_edge = split - gap
        blue_edge = split + gap
        draw.polygon([
            (left, band_y(top, left)), (red_edge, band_y(top, red_edge)),
            (red_edge, band_y(bottom, red_edge)), (left, band_y(bottom, left)),
        ], fill=red)
        draw.polygon([
            (blue_edge, band_y(top, blue_edge)), (right, band_y(top, right)),
            (right, band_y(bottom, right)), (blue_edge, band_y(bottom, blue_edge)),
        ], fill=blue)

    # Tight UV silhouette measured from the actual rendered fin. It is narrower than
    # the previous mask at every station so no livery pixels can project as floating
    # horizontal blades beyond either edge of the vertical stabilizer.
    fin_mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(fin_mask).polygon([
        (690, 2910), (1920, 2910),
        (1840, 2600), (1760, 2280), (1680, 1960),
        (1600, 1640), (1520, 1320), (1450, 1010),
        (1390, 720), (1350, 430), (1325, 150),
        (1015, 150), (970, 430), (925, 720),
        (880, 1010), (835, 1320), (790, 1640),
        (750, 1960), (720, 2280), (700, 2600),
    ], fill=255)
    clipped = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    clipped.paste(image, (0, 0), fin_mask)
    image = clipped

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

source = source.replace(
    'metallicFactor=0.12,\n                           roughnessFactor=0.25, alphaMode="OPAQUE", doubleSided=False',
    'metallicFactor=0.08,\n                           roughnessFactor=0.28, alphaMode="MASK", alphaCutoff=0.04, doubleSided=False',
)

start = source.index("def create_aft_sweep_texture(")
end = source.index("\n\ndef create_tail_texture", start)
source = source[:start] + '''def create_aft_sweep_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2200, 820
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    red = (197, 30, 46, 255)
    draw.polygon([
        (760, 270), (1160, 220), (width, 58),
        (width, 292), (1480, 390), (680, 376)
    ], fill=red)
    draw.polygon([
        (120, 612), (width, 442), (width, 622), (80, 718)
    ], fill=red)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

source = source.replace(
    "minimum[2] + 5.85, minimum[2] + 0.88,",
    "minimum[2] + 4.65, minimum[2] + 1.48,",
)
source = source.replace(
    "center_y + 0.02, radius_x*0.80, 0.34, 0.92,",
    "center_y + 0.18, radius_x*0.72, 0.16, 1.18,",
)
source = source.replace(
    "offset: float = 0.014, mirror_uv: bool = False",
    "offset: float = 0.006, mirror_uv: bool = False",
)

path.write_text(source, encoding="utf-8")
print("Applied v6 refinement: conservative fin mask and contained tail bands")