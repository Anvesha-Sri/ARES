
from app.hazards import analyze_slope_raster


if __name__ == "__main__":
    result = analyze_slope_raster()

    print("\nARES TERRAIN HAZARD ANALYSIS")
    print("=" * 40)

    print("Product:", result["product_id"])
    print("Valid pixels:", result["valid_pixels"])
    print("Invalid pixels:", result["invalid_pixels"])

    print("\nCLASS COUNTS")

    for name, count in result["class_counts"].items():
        print(f"{name}: {count:,}")

    print("\nCLASS PERCENTAGES")

    for name, percentage in result["class_percentages"].items():
        print(f"{name}: {percentage}%")

    print("\n", result["warning"])
