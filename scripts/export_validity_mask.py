
import os
import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling

SOURCE = "data/processed/gale_dtm.tif"
OUTPUT = "frontend/public/terrain/validity_mask.png"

WIDTH = 256
HEIGHT = 544

with rasterio.open(SOURCE) as src:

    elevation = src.read(
        1,
        out_shape=(HEIGHT, WIDTH),
        masked=True,
        resampling=Resampling.average
    )

    mask = np.ma.getmaskarray(elevation)

    # White = valid terrain
    # Black = NoData
    validity = np.where(mask, 0, 255).astype(np.uint8)

    Image.fromarray(validity, mode="L").save(OUTPUT)

print("ARES | VALIDITY MASK")
print("Dimensions:", WIDTH, "x", HEIGHT)
print("Valid cells:", int(np.count_nonzero(validity)))
print("NoData cells:", int(np.count_nonzero(validity == 0)))
print("Saved:", OUTPUT)
print("COMPLETE")
