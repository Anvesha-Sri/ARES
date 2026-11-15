from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio


# ARES prototype screening thresholds.
# These are not certified rover mobility limits.
GENTLE_MAX = 5.0
MODERATE_MAX = 15.0
STEEP_MAX = 25.0


def classify_slope(slope: np.ndarray, valid_mask: np.ndarray) -> np.ndarray:
    """
    Classify valid slope pixels.

    0 = Gentle       (< 5 degrees)
    1 = Moderate     (5 to < 15 degrees)
    2 = Steep        (15 to < 25 degrees)
    3 = Very steep   (>= 25 degrees)
    255 = Invalid / NoData
    """

    result = np.full(slope.shape, 255, dtype=np.uint8)

    valid = (
        valid_mask
        & np.isfinite(slope)
        & (slope >= 0)
        & (slope <= 90)
    )

    result[valid & (slope < GENTLE_MAX)] = 0

    result[
        valid
        & (slope >= GENTLE_MAX)
        & (slope < MODERATE_MAX)
    ] = 1

    result[
        valid
        & (slope >= MODERATE_MAX)
        & (slope < STEEP_MAX)
    ] = 2

    result[valid & (slope >= STEEP_MAX)] = 3

    return result


@lru_cache(maxsize=1)
def analyze_slope_raster() -> dict:
    """
    Analyze the existing full-resolution ARES slope raster
    using windowed processing to limit memory usage.
    """

    project_root = Path(__file__).resolve().parents[2]

    slope_path = (
        project_root
        / "data"
        / "processed"
        / "gale_slope.tif"
    )

    if not slope_path.exists():
        raise FileNotFoundError(
            f"Slope raster not found: {slope_path}"
        )

    counts = {
        "gentle": 0,
        "moderate": 0,
        "steep": 0,
        "very_steep": 0,
    }

    valid_pixel_count = 0
    total_pixel_count = 0

    with rasterio.open(slope_path) as dataset:

        total_pixel_count = dataset.width * dataset.height

        for _, window in dataset.block_windows(1):

            slope = dataset.read(1, window=window)

            valid_mask = dataset.read_masks(
                1,
                window=window
            ) > 0

            classes = classify_slope(
                slope,
                valid_mask
            )

            valid = classes != 255

            valid_pixel_count += int(
                np.count_nonzero(valid)
            )

            counts["gentle"] += int(
                np.count_nonzero(classes == 0)
            )

            counts["moderate"] += int(
                np.count_nonzero(classes == 1)
            )

            counts["steep"] += int(
                np.count_nonzero(classes == 2)
            )

            counts["very_steep"] += int(
                np.count_nonzero(classes == 3)
            )

    percentages = {
        name: round(
            count / valid_pixel_count * 100,
            2
        )
        if valid_pixel_count
        else 0
        for name, count in counts.items()
    }

    return {
        "product_id": (
            "DTEEC_018854_1755_018920_1755_U01"
        ),
        "classification_method": (
            "Slope-threshold screening"
        ),
        "thresholds_degrees": {
            "gentle_max": GENTLE_MAX,
            "moderate_max": MODERATE_MAX,
            "steep_max": STEEP_MAX,
        },
        "total_pixels": total_pixel_count,
        "valid_pixels": valid_pixel_count,
        "invalid_pixels": (
            total_pixel_count - valid_pixel_count
        ),
        "class_counts": counts,
        "class_percentages": percentages,
        "warning": (
            "Preliminary terrain screening only. "
            "Not a certified rover mobility or safety assessment."
        ),
    }
