
import os
import math
import numpy as np
import rasterio

from rasterio.windows import Window

SOURCE = "data/processed/gale_dtm.tif"
OUTPUT_DIR = "data/processed"

SLOPE_OUTPUT = os.path.join(
    OUTPUT_DIR, "gale_slope.tif"
)

HILLSHADE_OUTPUT = os.path.join(
    OUTPUT_DIR, "gale_hillshade.tif"
)

NODATA_FLOAT = -9999.0
NODATA_BYTE = 255

# Illumination settings for a reproducible
# analytical hillshade, not actual Mars sunlight.
AZIMUTH_DEGREES = 315
ALTITUDE_DEGREES = 45

os.makedirs(OUTPUT_DIR, exist_ok=True)

if not os.path.exists(SOURCE):
    raise FileNotFoundError(SOURCE)

print("=" * 55)
print("ARES | TERRAIN INTELLIGENCE GENERATION")
print("=" * 55)

with rasterio.open(SOURCE) as src:

    width = src.width
    height = src.height

    dx = abs(src.transform.a)
    dy = abs(src.transform.e)

    source_nodata = src.nodata

    print("Input:", SOURCE)
    print("Dimensions:", width, "x", height)
    print("Pixel spacing:", dx, dy, "metres")
    print("CRS:", src.crs)

    base_profile = src.profile.copy()

    # ------------------------------------
    # OUTPUT 1: SLOPE IN DEGREES
    # ------------------------------------

    slope_profile = base_profile.copy()

    slope_profile.update(
        driver="GTiff",
        dtype="float32",
        count=1,
        nodata=NODATA_FLOAT,
        compress="deflate",
        predictor=3,
        tiled=True,
        blockxsize=256,
        blockysize=256,
        BIGTIFF="IF_SAFER"
    )

    # ------------------------------------
    # OUTPUT 2: HILLSHADE
    # ------------------------------------

    shade_profile = base_profile.copy()

    shade_profile.update(
        driver="GTiff",
        dtype="uint8",
        count=1,
        nodata=NODATA_BYTE,
        compress="deflate",
        tiled=True,
        blockxsize=256,
        blockysize=256,
        BIGTIFF="IF_SAFER"
    )

    azimuth = math.radians(AZIMUTH_DEGREES)
    altitude = math.radians(ALTITUDE_DEGREES)

    # Light vector: azimuth clockwise from north.
    lx = math.sin(azimuth) * math.cos(altitude)
    ly = math.cos(azimuth) * math.cos(altitude)
    lz = math.sin(altitude)

    valid_slope_count = 0
    valid_shade_count = 0

    print("\nGenerating slope and hillshade...")

    with rasterio.open(
        SLOPE_OUTPUT, "w", **slope_profile
    ) as slope_dst, rasterio.open(
        HILLSHADE_OUTPUT, "w", **shade_profile
    ) as shade_dst:

        for index, (_, window) in enumerate(
            src.block_windows(1), start=1
        ):

            # Add one pixel of surrounding terrain.
            row_start = int(window.row_off)
            col_start = int(window.col_off)
            row_end = row_start + int(window.height)
            col_end = col_start + int(window.width)

            r0 = max(0, row_start - 1)
            c0 = max(0, col_start - 1)
            r1 = min(height, row_end + 1)
            c1 = min(width, col_end + 1)

            expanded = Window(
                c0,
                r0,
                c1 - c0,
                r1 - r0
            )

            elevation = src.read(
                1,
                window=expanded
            ).astype(np.float32)

            valid = np.isfinite(elevation)

            if source_nodata is not None:
                valid &= elevation != source_nodata

            # Avoid nodata values contaminating calculations.
            z = np.where(valid, elevation, 0.0)

            rows, cols = z.shape

            # Central differences, using neighbouring cells.
            gx = np.zeros_like(z)
            gy = np.zeros_like(z)

            neighbour_valid = np.zeros_like(
                valid, dtype=bool
            )

            if cols >= 3 and rows >= 3:

                gx[:, 1:-1] = (
                    z[:, 2:] - z[:, :-2]
                ) / (2.0 * dx)

                gy[1:-1, :] = (
                    z[:-2, :] - z[2:, :]
                ) / (2.0 * dy)

                neighbour_valid[1:-1, 1:-1] = (
                    valid[1:-1, 1:-1]
                    & valid[1:-1, 2:]
                    & valid[1:-1, :-2]
                    & valid[:-2, 1:-1]
                    & valid[2:, 1:-1]
                )

            # Slope in degrees.
            gradient = np.sqrt(gx ** 2 + gy ** 2)

            slope = np.degrees(
                np.arctan(gradient)
            )

            # Surface normal dotted with illumination vector.
            intensity = (
                -gx * lx
                -gy * ly
                + lz
            ) / np.sqrt(1.0 + gx ** 2 + gy ** 2)

            intensity = np.clip(intensity, 0.0, 1.0)

            hillshade = np.round(
                intensity * 255
            ).astype(np.uint8)

            # Extract only the original, non-halo window.
            local_row = row_start - r0
            local_col = col_start - c0

            rs = slice(
                local_row,
                local_row + int(window.height)
            )

            cs = slice(
                local_col,
                local_col + int(window.width)
            )

            output_valid = neighbour_valid[rs, cs]

            slope_block = slope[rs, cs].copy()
            shade_block = hillshade[rs, cs].copy()

            slope_block[~output_valid] = NODATA_FLOAT
            shade_block[~output_valid] = NODATA_BYTE

            slope_dst.write(
                slope_block.astype(np.float32),
                1,
                window=window
            )

            shade_dst.write(
                shade_block.astype(np.uint8),
                1,
                window=window
            )

            valid_slope_count += int(
                np.count_nonzero(output_valid)
            )

            valid_shade_count += int(
                np.count_nonzero(output_valid)
            )

            if index % 50 == 0:
                print(
                    f"Processed {index} raster blocks..."
                )

        slope_dst.update_tags(
            PROJECT="ARES",
            PRODUCT="Terrain Slope",
            UNITS="degrees",
            METHOD="Central difference",
            SOURCE="NASA HiRISE DTM"
        )

        shade_dst.update_tags(
            PROJECT="ARES",
            PRODUCT="Analytical Hillshade",
            AZIMUTH=str(AZIMUTH_DEGREES),
            ALTITUDE=str(ALTITUDE_DEGREES),
            SOURCE="NASA HiRISE DTM"
        )

print("\nGENERATED PRODUCTS")
print("-" * 45)

for path in [SLOPE_OUTPUT, HILLSHADE_OUTPUT]:

    with rasterio.open(path) as ds:

        print("\n", path)
        print("Dimensions:", ds.width, "x", ds.height)
        print("CRS:", ds.crs)
        print("Resolution:", ds.res)
        print("Size:", os.path.getsize(path), "bytes")

print("\nValid slope pixels:", valid_slope_count)
print("Valid hillshade pixels:", valid_shade_count)

print("\n" + "=" * 55)
print("ARES TERRAIN INTELLIGENCE COMPLETE")
print("=" * 55)
