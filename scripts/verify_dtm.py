
import json
import os
import numpy as np
import rasterio

DTM_PATH = (
    "data/raw/"
    "DTEEC_018854_1755_018920_1755_U01.IMG"
)

if not os.path.exists(DTM_PATH):
    raise FileNotFoundError(
        f"DTM not found: {DTM_PATH}\n"
        "Download the official IMG file first."
    )

print("\n====================================")
print("ARES | HIRISE DTM VERIFICATION")
print("====================================\n")

with rasterio.open(DTM_PATH) as src:

    print("1. RASTER INFORMATION")

    print("Driver:", src.driver)
    print("Width:", src.width, "pixels")
    print("Height:", src.height, "pixels")
    print("Band count:", src.count)
    print("Data types:", src.dtypes)
    print("NoData:", src.nodata)
    print("Resolution:", src.res)
    print("Bounds:", src.bounds)
    print("CRS:", src.crs)
    print("Transform:", src.transform)

    print("\n2. CRS DETAILS")

    crs_wkt = (
        src.crs.to_wkt()
        if src.crs
        else None
    )

    print("WKT:")
    print(crs_wkt)

    print("\n3. DATASET METADATA")

    tags = src.tags()

    for key, value in tags.items():
        print(f"{key}: {value}")

    print("\n4. BAND METADATA")

    band_tags = src.tags(1)

    for key, value in band_tags.items():
        print(f"{key}: {value}")

    print("\n5. RASTER FOOTPRINT")
    print("Coordinates below are in raster CRS.")

    transform = src.transform

    corners = {
        "upper_left": (0, 0),
        "upper_right": (src.width, 0),
        "lower_left": (0, src.height),
        "lower_right": (src.width, src.height),
        "center": (src.width / 2, src.height / 2),
    }

    corner_results = {}

    for name, (col, row) in corners.items():
        x, y = transform * (col, row)

        corner_results[name] = {
            "x": float(x),
            "y": float(y)
        }

        print(
            f"{name}: "
            f"x={x:.6f}, y={y:.6f}"
        )

    print("\n6. ELEVATION STATISTICS")

    valid_min = float("inf")
    valid_max = float("-inf")
    valid_count = 0
    invalid_count = 0

    for _, window in src.block_windows(1):

        array = src.read(
            1,
            window=window,
            masked=True
        )

        values = array.compressed()

        if values.size == 0:
            invalid_count += array.size
            continue

        values = values[np.isfinite(values)]

        if values.size:
            valid_min = min(
                valid_min,
                float(values.min())
            )

            valid_max = max(
                valid_max,
                float(values.max())
            )

            valid_count += values.size

        invalid_count += array.size - values.size

    print("Valid pixels:", valid_count)
    print("Invalid pixels:", invalid_count)
    print("Raster minimum:", valid_min)
    print("Raster maximum:", valid_max)

    print("\n7. VERIFICATION SUMMARY")

    report = {
        "file": DTM_PATH,
        "driver": src.driver,
        "width": src.width,
        "height": src.height,
        "bands": src.count,
        "dtype": list(src.dtypes),
        "nodata": src.nodata,
        "resolution": list(src.res),
        "bounds_in_raster_crs": [
            float(v) for v in src.bounds
        ],
        "crs": str(src.crs),
        "crs_wkt": crs_wkt,
        "transform": list(src.transform),
        "corners_in_raster_crs": corner_results,
        "valid_pixel_count": valid_count,
        "invalid_pixel_count": invalid_count,
        "raster_minimum": valid_min,
        "raster_maximum": valid_max,
        "dataset_tags": tags,
        "band_tags": band_tags
    }

    os.makedirs("data/metadata", exist_ok=True)

    with open(
        "data/metadata/dtm_verification.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            report,
            f,
            indent=4,
            default=str
        )

print("\n====================================")
print("VERIFICATION FINISHED")
print("Report: data/metadata/dtm_verification.json")
print("====================================")
