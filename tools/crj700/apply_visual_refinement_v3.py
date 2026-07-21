#!/usr/bin/env python3
"""Reference-driven visual refinement for the American Eagle CRJ700.

Runs after apply_livery_patch.py. It corrects the three defects still visible in the
actual Three.js artifact: the tiny/blocky flight symbol, the over-dense tail bands,
and the long floating aft-fuselage red rails.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

# Make the forward American flight symbol larger, slimmer, and closer to the supplied
# reference silhouette while preserving the italic American Eagle title.
start = source.index("def _draw_flight_symbol(")
end = source.index("\n\ndef create_wordmark_texture", start)
source = source[:start] + '''def _draw_flight_symbol(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float = 1.0) -> None:
    blue = (18, 105, 169, 255)
    red = (196, 30, 48, 255)

    # Blue upper feather: long swept top, narrow root and pointed lower tip.
    draw.polygon([
        (x + 44*scale, y + 14*scale),
        (x + 250*scale, y + 14*scale),
        (x + 214*scale, y + 48*scale),
        (x + 178*scale, y + 82*scale),
        (x + 138*scale, y + 118*scale),
        (x + 90*scale, y + 154*scale),
        (x + 12*scale, y + 154*scale),
        (x + 48*scale, y + 112*scale),
        (x + 80*scale, y + 78*scale),
        (x + 110*scale, y + 46*scale),
    ], fill=blue)

    # Red lower feather. Transparent separation between polygons creates the white
    # negative-space eagle channel rather than a painted rectangular notch.
    draw.polygon([
        (x + 76*scale, y + 194*scale),
        (x + 142*scale, y + 194*scale),
        (x + 174*scale, y + 222*scale),
        (x + 250*scale, y + 222*scale),
        (x + 214*scale, y + 258*scale),
        (x + 182*scale, y + 300*scale),
        (x + 144*scale, y + 348*scale),
        (x + 14*scale, y + 348*scale),
        (x + 56*scale, y + 300*scale),
        (x + 90*scale, y + 256*scale),
        (x + 116*scale, y + 222*scale),
    ], fill=red)
''' + source[end:]

start = source.index("def create_wordmark_texture(")
end = source.index("\n\ndef _draw_us_flag", start)
source = source[:start] + '''def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (3000, 620), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    title_font = _italic_title_font(258)
    title_color = (69, 72, 75, 255)
    if mirrored:
        draw.text((42, 132), "American Eagle", font=title_font,
                  fill=title_color, stroke_width=1)
        _draw_flight_symbol(draw, 2660, 92, 1.05)
    else:
        _draw_flight_symbol(draw, 22, 92, 1.05)
        draw.text((328, 132), "American Eagle", font=title_font,
                  fill=title_color, stroke_width=1)
    image.save(path)
    return image
''' + source[end:]

# Tail texture: six broad red/blue feather rows separated by exposed metallic silver.
# The center boundary sweeps aft as it descends, matching the rear-quarter references.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2600, 3000
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    blue = (18, 68, 120, 255)
    red = (194, 31, 47, 255)
    dark_cap = (50, 52, 55, 255)

    # Dark cap under the horizontal stabilizer, visible in the supplied side views.
    draw.polygon([(180, 70), (2410, 70), (2320, 250), (250, 360)], fill=dark_cap)

    band_centers = [330, 760, 1190, 1620, 2050, 2480, 2860]
    band_thickness = 178
    slant = 125
    for center_y in band_centers:
        y0 = center_y - band_thickness/2
        y1 = center_y + band_thickness/2
        # Diagonal red/blue division: roughly 46% at the cap and 60% at the root.
        fraction = 0.46 + 0.14*(center_y/height)
        split = width*fraction
        gap = 32
        draw.polygon([
            (-220, y0 + slant),
            (split - gap, y0 - 12),
            (split - gap - 54, y1 + 18),
            (-220, y1 + slant),
        ], fill=red)
        draw.polygon([
            (split + gap + 54, y0 - 18),
            (width + 220, y0 - slant),
            (width + 220, y1 - slant),
            (split + gap, y1 + 12),
        ], fill=blue)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Let the real metallic fin remain visible in the silver gaps; only colored bands and
# the cap are decal pixels. This eliminates the flat opaque fin-shaped billboard.
source = source.replace(
    'metallicFactor=0.12,\n                           roughnessFactor=0.25, alphaMode="OPAQUE", doubleSided=False',
    'metallicFactor=0.08,\n                           roughnessFactor=0.28, alphaMode="MASK", alphaCutoff=0.04, doubleSided=False',
)

# Short, reference-sized tailcone treatment: one upper root wedge and one lower stripe.
start = source.index("def create_aft_sweep_texture(")
end = source.index("\n\ndef create_tail_texture", start)
source = source[:start] + '''def create_aft_sweep_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2200, 720
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    red = (197, 30, 46, 255)

    # Broad but short upper wedge immediately forward of the fin root.
    draw.polygon([
        (900, 240), (width, 52), (width, 248), (1350, 350), (760, 330)
    ], fill=red)
    # Single lower stripe, terminating cleanly before the engine nacelle area.
    draw.polygon([
        (180, 500), (width, 360), (width, 535), (120, 612)
    ], fill=red)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Tighten tailcone placement and radius so the decal hugs the fuselage instead of
# extending as detached rails beyond the physical tailcone.
source = source.replace(
    "minimum[2] + 5.85, minimum[2] + 0.88,",
    "minimum[2] + 4.35, minimum[2] + 1.30,",
)
source = source.replace(
    "center_y + 0.02, radius_x*0.80, 0.34, 0.92,",
    "center_y + 0.10, radius_x*0.70, 0.10, 0.70,",
)
source = source.replace(
    "offset: float = 0.014, mirror_uv: bool = False",
    "offset: float = 0.008, mirror_uv: bool = False",
)

path.write_text(source, encoding="utf-8")
print("Applied v3 reference refinement: larger symbol, six-row tail, compact aft sweep")
