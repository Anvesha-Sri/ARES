
import os
import json
import math
import numpy as np
import rasterio

from PIL import Image
from rasterio.enums import Resampling

BASE = "data/processed"
OUTPUT = "frontend/public/terrain"

os.makedirs(OUTPUT, exist_ok=True)

FILES = {
    "elevation": os.path.join(BASE, "gale_dtm.tif"),
    "hillshade": os.path.join(BASE, "gale_hillshade.tif"),
    "slope": os.path.join(BASE, "gale_slope.tif")
}

# Browser texture dimensions
TEXTURE_WIDTH = 1024
TEXTURE_HEIGHT = 2177

# Lightweight 3D mesh heightmap dimensions
MESH_WIDTH = 256
MESH_HEIGHT = 544

# Mars DTM valid elevation range, verified previously
ELEVATION_MIN = -4509.42724609375
ELEVATION_MAX = -4116.3349609375

def resize_raster(path, width, height):
    with rasterio.open(path) as src:
        data = src.read(
            1,
            out_shape=(height, width),
            masked=True,
            resampling=Resampling.average
        )
        return data

def colorize(values, mask, stops):
    """
    Interpolate RGB colours between normalized
    positions and return an RGB image.
    """
    values = np.clip(values, 0, 1)

    result = np.zeros(
        (*values.shape, 3),
        dtype=np.uint8
    )

    for channel in range(3):
        positions = [stop[0] for stop in stops]
        colours = [stop[channel + 1] for stop in stops]

        result[:, :, channel] = np.interp(
            values,
            positions,
            colours
        ).astype(np.uint8)

    result[mask] = (0, 0, 0)

    return result

print("=" * 55)
print("ARES | BROWSER TERRAIN ASSET EXPORT")
print("=" * 55)

# -----------------------------------------
# 1. ELEVATION TEXTURE
# -----------------------------------------

print("\nExporting elevation texture...")

elevation = resize_raster(
    FILES["elevation"],
    TEXTURE_WIDTH,
    TEXTURE_HEIGHT
)

elev_values = elevation.filled(ELEVATION_MIN)
elev_mask = np.ma.getmaskarray(elevation)

elev_norm = (
    (elev_values - ELEVATION_MIN)
    / (ELEVATION_MAX - ELEVATION_MIN)
)

elevation_stops = [
    (0.00, 42, 28, 36),
    (0.20, 102, 48, 38),
    (0.40, 158, 75, 43),
    (0.60, 202, 119, 62),
    (0.80, 226, 164, 101),
    (1.00, 245, 216, 164)
]

elevation_rgb = colorize(
    elev_norm,
    elev_mask,
    elevation_stops
)

Image.fromarray(
    elevation_rgb
).save(os.path.join(OUTPUT, "elevation.png"))

# -----------------------------------------
# 2. HEIGHTMAP FOR 3D MESH
# -----------------------------------------

print("Exporting 3D heightmap...")

height = resize_raster(
    FILES["elevation"],
    MESH_WIDTH,
    MESH_HEIGHT
)

height_values = height.filled(ELEVATION_MIN)

height_norm = (
    (height_values - ELEVATION_MIN)
    / (ELEVATION_MAX - ELEVATION_MIN)
)

height_pixels = np.round(
    np.clip(height_norm, 0, 1) * 255
).astype(np.uint8)

height_mask = np.ma.getmaskarray(height)
height_pixels[height_mask] = 0

Image.fromarray(
    height_pixels,
    mode="L"
).save(os.path.join(OUTPUT, "heightmap.png"))

# -----------------------------------------
# 3. HILLSHADE TEXTURE
# -----------------------------------------

print("Exporting hillshade...")

hillshade = resize_raster(
    FILES["hillshade"],
    TEXTURE_WIDTH,
    TEXTURE_HEIGHT
)

shade_values = hillshade.filled(0)

shade_pixels = np.clip(
    shade_values, 0, 255
).astype(np.uint8)

Image.fromarray(
    shade_pixels,
    mode="L"
).save(os.path.join(OUTPUT, "hillshade.png"))

# -----------------------------------------
# 4. SLOPE TEXTURE
# -----------------------------------------

print("Exporting slope...")

slope = resize_raster(
    FILES["slope"],
    TEXTURE_WIDTH,
    TEXTURE_HEIGHT
)

slope_values = slope.filled(0)
slope_mask = np.ma.getmaskarray(slope)

# 35 degrees is the upper display range,
# not a safety threshold.
slope_norm = np.clip(
    slope_values / 35.0,
    0,
    1
)

slope_stops = [
    (0.00, 35, 155, 116),
    (0.25, 126, 187, 111),
    (0.50, 222, 194, 89),
    (0.75, 226, 126, 65),
    (1.00, 181, 55, 53)
]

slope_rgb = colorize(
    slope_norm,
    slope_mask,
    slope_stops
)

Image.fromarray(
    slope_rgb
).save(os.path.join(OUTPUT, "slope.png"))

# -----------------------------------------
# 5. EXPORT METADATA
# -----------------------------------------

with rasterio.open(FILES["elevation"]) as src:

    transform = src.transform

    metadata = {
        "project": "ARES",
        "planet": "Mars",
        "study_area": "Gale Crater",
        "source_product": (
            "DTEEC_018854_1755_018920_1755_U01"
        ),
        "source": "NASA HiRISE",
        "crs": src.crs.to_wkt(),
        "width": src.width,
        "height": src.height,
        "pixel_spacing_m": list(src.res),
        "bounds_projected_m": [
            float(v) for v in src.bounds
        ],
        "elevation_min_m": ELEVATION_MIN,
        "elevation_max_m": ELEVATION_MAX,
        "texture_dimensions": [
            TEXTURE_WIDTH,
            TEXTURE_HEIGHT
        ],
        "mesh_dimensions": [
            MESH_WIDTH,
            MESH_HEIGHT
        ],
        "heightmap_encoding": (
            "8-bit normalized elevation; "
            "black pixels represent NoData"
        ),
        "heightmap_validity": (
            "Use elevation.png or source DTM mask "
            "to distinguish NoData from minimum elevation"
        )
    }

with open(
    os.path.join(OUTPUT, "terrain_metadata.json"),
    "w",
    encoding="utf-8"
) as f:
    json.dump(metadata, f, indent=4)

print("\nEXPORTED ASSETS")
print("-" * 45)

for filename in os.listdir(OUTPUT):

    path = os.path.join(OUTPUT, filename)

    print(
        filename,
        "|",
        os.path.getsize(path),
        "bytes"
    )

print("\n" + "=" * 55)
print("BROWSER TERRAIN ASSETS READY")
print("=" * 55)
