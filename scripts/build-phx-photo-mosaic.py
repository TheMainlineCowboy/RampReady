#!/usr/bin/env python3
"""Build the browser-ready full-airport PHX aerial mosaic from decoded tiles."""

from __future__ import annotations

import csv
import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image

SOURCE_REPOSITORY = "TheMainlineCowboy/SkyHarborPhx"
SOURCE_COMMIT = "2e6642778c9c88eac6a82b21063763cc78be7cfe"
SOURCE_PATH = "scenery/PHXPhoto.bgl"
FLIGHTSIMLIB_REPOSITORY = "seanisom/flightsimlib"
FLIGHTSIMLIB_COMMIT = "fc17bec8e20770da3344eea10f25ecac281ee09f"
A1_LATITUDE = 33.43653056770563
A1_LONGITUDE = -111.99864059686661
GROUND_Z_OFFSET_METERS = 6.2
EARTH_RADIUS_METERS = 6_378_137.0
EXPECTED = {
    "tile_count": 199,
    "min_u": 18_558,
    "max_u": 18_582,
    "min_v": 20_591,
    "max_v": 20_599,
    "width": 6_400,
    "height": 2_304,
    "west": -112.03857421875,
    "south": 33.42041015625,
    "east": -111.947021484375,
    "north": 33.44512939453125,
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def to_scene(longitude: float, latitude: float) -> tuple[float, float]:
    latitude_radians = math.radians(A1_LATITUDE)
    east = math.radians(longitude - A1_LONGITUDE) * EARTH_RADIUS_METERS * math.cos(latitude_radians)
    north = math.radians(latitude - A1_LATITUDE) * EARTH_RADIUS_METERS
    return north, east + GROUND_Z_OFFSET_METERS


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: build-phx-photo-mosaic.py decoded-tiles source-bgl output-directory", file=sys.stderr)
        return 2

    tile_directory = Path(sys.argv[1]).resolve()
    source_bgl = Path(sys.argv[2]).resolve()
    output_directory = Path(sys.argv[3]).resolve()
    output_directory.mkdir(parents=True, exist_ok=True)

    with (tile_directory / "tiles.csv").open(newline="", encoding="utf-8") as source:
        rows = list(csv.DictReader(source))
    if len(rows) != EXPECTED["tile_count"]:
        raise RuntimeError(f"Expected {EXPECTED['tile_count']} level-17 tiles, found {len(rows)}")

    numeric_rows: list[dict[str, object]] = []
    for row in rows:
        numeric_rows.append(
            {
                **row,
                "u": int(row["u"]),
                "v": int(row["v"]),
                "width": int(row["width"]),
                "height": int(row["height"]),
            }
        )

    min_u = min(int(row["u"]) for row in numeric_rows)
    max_u = max(int(row["u"]) for row in numeric_rows)
    min_v = min(int(row["v"]) for row in numeric_rows)
    max_v = max(int(row["v"]) for row in numeric_rows)
    actual_grid = {"min_u": min_u, "max_u": max_u, "min_v": min_v, "max_v": max_v}
    for key, value in actual_grid.items():
        if value != EXPECTED[key]:
            raise RuntimeError(f"PHX photo {key} drifted: {value} != {EXPECTED[key]}")

    width = (max_u - min_u + 1) * 256
    height = (max_v - min_v + 1) * 256
    if width != EXPECTED["width"] or height != EXPECTED["height"]:
        raise RuntimeError(f"Unexpected mosaic dimensions {width}x{height}")

    mosaic = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for row in numeric_rows:
        tile_path = tile_directory / str(row["file"])
        raw = tile_path.read_bytes()
        expected_bytes = int(row["width"]) * int(row["height"]) * 4
        if len(raw) != expected_bytes:
            raise RuntimeError(f"Unexpected tile size for {tile_path.name}: {len(raw)}")
        tile = Image.frombytes("RGBA", (int(row["width"]), int(row["height"])), raw)
        x = (int(row["u"]) - min_u) * 256
        y = (int(row["v"]) - min_v) * 256
        mosaic.alpha_composite(tile, (x, y))

    image_path = output_directory / "phx-airport-photo.webp"
    mosaic.save(image_path, "WEBP", quality=88, method=6, exact=True)

    west = EXPECTED["west"]
    south = EXPECTED["south"]
    east = EXPECTED["east"]
    north = EXPECTED["north"]
    northwest = to_scene(west, north)
    northeast = to_scene(east, north)
    southwest = to_scene(west, south)
    southeast = to_scene(east, south)
    scene_bounds = {
        "north": northwest[0],
        "south": southwest[0],
        "west": northwest[1],
        "east": northeast[1],
        "centerX": (northwest[0] + southwest[0]) / 2,
        "centerZ": (northwest[1] + northeast[1]) / 2,
        "widthMeters": northeast[1] - northwest[1],
        "heightMeters": northwest[0] - southwest[0],
    }

    manifest = {
        "schemaVersion": 1,
        "sourceRepository": SOURCE_REPOSITORY,
        "sourceCommit": SOURCE_COMMIT,
        "sourcePath": SOURCE_PATH,
        "sourceBytes": source_bgl.stat().st_size,
        "sourceSha256": sha256(source_bgl),
        "decoderRepository": FLIGHTSIMLIB_REPOSITORY,
        "decoderCommit": FLIGHTSIMLIB_COMMIT,
        "layer": "TerrainPhotoJan (0x8C; shared daytime source)",
        "qmidLevel": 17,
        "tileCount": len(rows),
        "grid": actual_grid,
        "image": {
            "file": image_path.name,
            "format": "WebP",
            "width": width,
            "height": height,
            "bytes": image_path.stat().st_size,
            "sha256": sha256(image_path),
            "quality": 88,
        },
        "geographicBounds": {"west": west, "south": south, "east": east, "north": north},
        "coordinateFrame": "A1-local; X=north, Y=up, Z=east",
        "anchor": {
            "gate": "A1",
            "latitude": A1_LATITUDE,
            "longitude": A1_LONGITUDE,
            "groundZOffsetMeters": GROUND_Z_OFFSET_METERS,
        },
        "sceneBounds": scene_bounds,
        "corners": {
            "northwest": [northwest[0], northwest[1]],
            "northeast": [northeast[0], northeast[1]],
            "southwest": [southwest[0], southwest[1]],
            "southeast": [southeast[0], southeast[1]],
        },
        "surfaceState": "source-authored 1.2-meter-class aerial airport imagery covering the full PHX field",
    }
    (output_directory / "photo-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(
        f"Built {width}x{height} PHX airport aerial mosaic from {len(rows)} source tiles "
        f"({image_path.stat().st_size} bytes)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
