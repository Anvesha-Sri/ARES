
import os
import math
import rasterio
from rasterio.enums import Resampling
from affine import Affine

SOURCE = (
    "data/raw/"
    "DTEEC_018854_1755_018920_1755_U01.IMG"
)

OUTPUT_DIR = "data/processed"

FULL_OUTPUT = os.path.join(
    OUTPUT_DIR,
    "gale_dtm.tif"
)

PREVIEW_OUTPUT = os.path.join(
    OUTPUT_DIR,
    "gale_dtm_preview.tif"
)

os.makedirs(OUTPUT_DIR, exist_ok=True)

if not os.path.exists(SOURCE):
    raise FileNotFoundError(SOURCE)

print("ARES | TERRAIN PREPARATION")
print("=" * 45)

with rasterio.open(SOURCE) as src:

    print("Source:", SOURCE)
    print("Dimensions:", src.width, "x", src.height)
    print("CRS:", src.crs)
    print("Resolution:", src.res)

    # ---------------------------------
    # 1. CREATE FULL-RESOLUTION GEOTIFF
    # ---------------------------------

    profile = src.profile.copy()

    profile.update(
        driver="GTiff",
        compress="deflate",
        predictor=3,
        tiled=True,
        blockxsize=256,
        blockysize=256,
        BIGTIFF="IF_SAFER"
    )

    print("\nCreating full-resolution GeoTIFF...")

    with rasterio.open(
        FULL_OUTPUT,
        "w",
        **profile
    ) as dst:

        dst.update_tags(**src.tags())

        for _, window in src.block_windows(1):

            data = src.read(
                1,
                window=window
            )

            dst.write(
                data,
                1,
                window=window
            )

        dst.update_tags(
            PROJECT="ARES",
            DATASET="HiRISE DTM",
            PRODUCT_ID="DTEEC_018854_1755_018920_1755_U01",
            PLANET="Mars",
            DATA_TYPE="Elevation",
            SOURCE="NASA HiRISE / University of Arizona"
        )

    print("Full GeoTIFF created.")

    # ---------------------------------
    # 2. CREATE LOW-RESOLUTION PREVIEW
    # ---------------------------------

    factor = 16

    preview_width = math.ceil(src.width / factor)
    preview_height = math.ceil(src.height / factor)

    preview_data = src.read(
        1,
        out_shape=(preview_height, preview_width),
        masked=True,
        resampling=Resampling.average
    )

    preview_profile = src.profile.copy()

    preview_profile.update(
        driver="GTiff",
        width=preview_width,
        height=preview_height,
        transform=src.transform * Affine.scale(
            src.width / preview_width,
            src.height / preview_height
        ),
        compress="deflate",
        predictor=3,
        tiled=True,
        blockxsize=256,
        blockysize=256,
        BIGTIFF="IF_SAFER"
    )

    print("\nCreating terrain preview...")

    with rasterio.open(
        PREVIEW_OUTPUT,
        "w",
        **preview_profile
    ) as dst:

        dst.write(
            preview_data.filled(src.nodata),
            1
        )

        dst.update_tags(
            PROJECT="ARES",
            PRODUCT="Mars DTM Preview",
            PREVIEW_FACTOR=str(factor)
        )

    print("Preview created.")

# ---------------------------------
# 3. VERIFY OUTPUT FILES
# ---------------------------------

for path in [FULL_OUTPUT, PREVIEW_OUTPUT]:

    with rasterio.open(path) as ds:

        print("\nFILE:", path)
        print("Dimensions:", ds.width, "x", ds.height)
        print("CRS:", ds.crs)
        print("Resolution:", ds.res)
        print("Bounds:", ds.bounds)
        print("Size:", os.path.getsize(path), "bytes")

print("\n" + "=" * 45)
print("ARES TERRAIN PREPARATION COMPLETE")
print("=" * 45)
