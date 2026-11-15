
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject
from affine import Affine
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

SOURCE = ROOT / "data" / "processed" / "gale_slope.tif"
OUTPUT = ROOT / "frontend" / "public" / "terrain" / "hazard.png"

# Match the dimensions of the existing terrain textures.
OUTPUT_WIDTH = 1024
OUTPUT_HEIGHT = 2177

# Hazard classes:
# 0 = Gentle
# 1 = Moderate
# 2 = Steep
# 3 = Very steep
# 255 = NoData

with rasterio.open(SOURCE) as src:
    slope = src.read(1)
    valid_mask = src.read_masks(1) > 0

    # Classify original full-resolution slope values.
    classes = np.full(slope.shape, 255, dtype=np.uint8)

    classes[valid_mask & (slope < 5)] = 0
    classes[valid_mask & (slope >= 5) & (slope < 15)] = 1
    classes[valid_mask & (slope >= 15) & (slope < 25)] = 2
    classes[valid_mask & (slope >= 25)] = 3

    # Create a georeferenced destination transform.
    destination_transform = (
        src.transform
        * Affine.scale(
            src.width / OUTPUT_WIDTH,
            src.height / OUTPUT_HEIGHT
        )
    )

    preview = np.full(
        (OUTPUT_HEIGHT, OUTPUT_WIDTH),
        255,
        dtype=np.uint8
    )

    # Downsample categorical classes without blending categories.
    reproject(
        source=classes,
        destination=preview,
        src_transform=src.transform,
        src_crs=src.crs,
        src_nodata=255,
        dst_transform=destination_transform,
        dst_crs=src.crs,
        dst_nodata=255,
        resampling=Resampling.nearest
    )

# Colour palette: RGB
palette = {
    0: (39, 209, 127),    # Green - Gentle
    1: (246, 196, 69),    # Yellow - Moderate
    2: (242, 140, 56),    # Orange - Steep
    3: (239, 68, 68),     # Red - Very steep
    255: (17, 24, 39)     # Dark - NoData
}

rgb = np.zeros(
    (OUTPUT_HEIGHT, OUTPUT_WIDTH, 3),
    dtype=np.uint8
)

for class_id, color in palette.items():
    rgb[preview == class_id] = color

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(rgb, mode="RGB").save(OUTPUT, optimize=True)

print("ARES HAZARD TEXTURE GENERATED")
print("=" * 40)
print("Source:", SOURCE)
print("Output:", OUTPUT)
print("Dimensions:", OUTPUT_WIDTH, "x", OUTPUT_HEIGHT)
print()
print("CLASS PIXEL COUNTS IN PREVIEW")

for class_id, name in [
    (0, "Gentle"),
    (1, "Moderate"),
    (2, "Steep"),
    (3, "Very steep"),
    (255, "NoData")
]:
    print(f"{name}: {int(np.count_nonzero(preview == class_id))}")

print()
print("Texture generation completed.")
