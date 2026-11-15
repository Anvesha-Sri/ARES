from functools import lru_cache
from .hazards import analyze_slope_raster
from pathlib import Path
import math

import heapq
from rasterio.enums import Resampling
import numpy as np
import rasterio
from rasterio.windows import Window
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="ARES Terrain Intelligence API",
    description="Full-resolution Mars terrain inspection service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed"

ELEVATION_FILE = DATA / "gale_dtm.tif"
SLOPE_FILE = DATA / "gale_slope.tif"

MARS_RADIUS = 3396190.0
CENTRAL_MERIDIAN = 137.4

PRODUCT_ID = "DTEEC_018854_1755_018920_1755_U01"


def classify_slope(slope):
    if slope < 5:
        return "Gentle"
    elif slope < 15:
        return "Moderate"
    elif slope < 25:
        return "Steep"
    return "Very steep"


@app.get("/")
def root():
    return {
        "system": "ARES Terrain Intelligence",
        "status": "online",
        "dataset": PRODUCT_ID
    }


@app.get("/api/terrain/metadata")
def terrain_metadata():
    if not ELEVATION_FILE.exists():
        raise HTTPException(500, "Elevation GeoTIFF not found")

    with rasterio.open(ELEVATION_FILE) as src:
        return {
            "product_id": PRODUCT_ID,
            "width": src.width,
            "height": src.height,
            "crs": str(src.crs),
            "resolution": list(src.res),
            "bounds": {
                "left": src.bounds.left,
                "right": src.bounds.right,
                "top": src.bounds.top,
                "bottom": src.bounds.bottom
            },
            "elevation_unit": "metres",
            "slope_unit": "degrees",
            "measurement_source": "Full-resolution NASA HiRISE DTM"
        }


@app.get("/api/terrain/sample")
def sample_terrain(
    u: float = Query(..., ge=0, le=1),
    v: float = Query(..., ge=0, le=1)
):
    if not ELEVATION_FILE.exists() or not SLOPE_FILE.exists():
        raise HTTPException(
            500,
            "Required terrain rasters are missing"
        )

    with rasterio.open(ELEVATION_FILE) as elevation:
        row = round((1 - v) * (elevation.height - 1))
        col = round(u * (elevation.width - 1))

        row = max(0, min(row, elevation.height - 1))
        col = max(0, min(col, elevation.width - 1))

        value = elevation.read(
            1,
            window=Window(col, row, 1, 1)
        )[0, 0]

        nodata = elevation.nodata

        if not np.isfinite(value):
            raise HTTPException(404, "No valid terrain at this point")

        if nodata is not None and np.isclose(value, nodata):
            raise HTTPException(404, "No valid terrain at this point")

        x, y = rasterio.transform.xy(
            elevation.transform,
            row,
            col,
            offset="center"
        )

        latitude = math.degrees(y / MARS_RADIUS)
        longitude = (
            CENTRAL_MERIDIAN
            + math.degrees(x / MARS_RADIUS)
        )

    with rasterio.open(SLOPE_FILE) as slope_raster:
        slope_value = slope_raster.read(
            1,
            window=Window(col, row, 1, 1)
        )[0, 0]

        slope_nodata = slope_raster.nodata

        if not np.isfinite(slope_value):
            raise HTTPException(404, "Slope unavailable")

        if (
            slope_nodata is not None
            and np.isclose(slope_value, slope_nodata)
        ):
            raise HTTPException(404, "Slope unavailable")

    slope = float(slope_value)

    return {
        "product_id": PRODUCT_ID,
        "pixel": {
            "row": row,
            "column": col
        },
        "coordinates": {
            "latitude": round(latitude, 6),
            "longitude": round(longitude, 6)
        },
        "elevation_m": round(float(value), 3),
        "slope_degrees": round(slope, 3),
        "terrain_class": classify_slope(slope),
        "provenance": {
            "elevation": "NASA HiRISE full-resolution DTM",
            "slope": "ARES-derived slope raster",
            "slope_method": "Central-difference calculation",
            "classification": "Slope-threshold screening"
        }
    }
@app.get("/api/terrain/hazards")
def get_terrain_hazards():
    try:
        return analyze_slope_raster()

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Hazard analysis failed: {str(error)}"
        )


# ==========================================
# ARES AUTONOMOUS ROVER ROUTE PLANNER
# A* slope-aware terrain navigation
# ==========================================

PLANNING_HEIGHT = 544
PLANNING_WIDTH = 256



def calculate_rover_route(start_u, start_v, end_u, end_v):

    if not SLOPE_FILE.exists():
        raise FileNotFoundError("Slope raster not found")

    with rasterio.open(SLOPE_FILE) as src:

        # Create a reduced planning grid from the real slope raster.
        slope_grid = src.read(
            1,
            out_shape=(PLANNING_HEIGHT, PLANNING_WIDTH),
            masked=True,
            resampling=Resampling.average
        ).filled(np.nan).astype(np.float32)

        rows, cols = slope_grid.shape

        # Physical dimensions of each planning-grid cell.
        x_spacing = abs(src.res[0]) * src.width / cols
        y_spacing = abs(src.res[1]) * src.height / rows

        # Convert normalized terrain coordinates to grid cells.
        start = (
            round((1 - start_v) * (rows - 1)),
            round(start_u * (cols - 1))
        )

        goal = (
            round((1 - end_v) * (rows - 1)),
            round(end_u * (cols - 1))
        )

        # Validate start and destination.
        for name, point in [("Start", start), ("Destination", goal)]:
            r, c = point

            if not (0 <= r < rows and 0 <= c < cols):
                raise ValueError(f"{name} is outside the planning grid")

            value = slope_grid[r, c]

            if not np.isfinite(value):
                raise ValueError(f"{name} is on invalid terrain")

            if value >= 25:
                raise ValueError(
                    f"{name} is on very steep terrain (>=25 degrees)"
                )

        # Eight-direction movement.
        directions = [
            (-1, 0),
            (1, 0),
            (0, -1),
            (0, 1),
            (-1, -1),
            (-1, 1),
            (1, -1),
            (1, 1),
        ]

        # Physical-distance heuristic.
        def heuristic(point):
            dr = (point[0] - goal[0]) * y_spacing
            dc = (point[1] - goal[1]) * x_spacing
            return math.hypot(dr, dc)

        open_set = []
        heapq.heappush(
            open_set,
            (heuristic(start), 0.0, start)
        )

        came_from = {}
        g_score = {start: 0.0}
        closed = set()

        # A* pathfinding.
        while open_set:

            _, current_cost, current = heapq.heappop(open_set)

            if current in closed:
                continue

            if current == goal:
                break

            closed.add(current)

            current_slope = float(slope_grid[current])

            for dr, dc in directions:

                nr = current[0] + dr
                nc = current[1] + dc

                # Check grid boundaries.
                if not (0 <= nr < rows and 0 <= nc < cols):
                    continue

                neighbor = (nr, nc)
                neighbor_slope = float(slope_grid[nr, nc])

                # Exclude NoData and very steep terrain.
                if not np.isfinite(neighbor_slope) or neighbor_slope >= 25:
                    continue

                # Prevent diagonal movement through blocked corners.
                if dr != 0 and dc != 0:
                    side_a = slope_grid[current[0] + dr, current[1]]
                    side_b = slope_grid[current[0], current[1] + dc]

                    if (
                        not np.isfinite(side_a)
                        or not np.isfinite(side_b)
                        or side_a >= 25
                        or side_b >= 25
                    ):
                        continue

                # Calculate slope-weighted physical movement cost.
                average_slope = (
                    current_slope + neighbor_slope
                ) / 2.0

                slope_penalty = 1 + (average_slope / 10) ** 2

                physical_distance = math.hypot(
                    dr * y_spacing,
                    dc * x_spacing
                )

                new_cost = (
                    current_cost + physical_distance * slope_penalty
                )

                if new_cost < g_score.get(neighbor, float("inf")):

                    came_from[neighbor] = current
                    g_score[neighbor] = new_cost

                    priority = new_cost + heuristic(neighbor)

                    heapq.heappush(
                        open_set,
                        (priority, new_cost, neighbor)
                    )

        # Check whether a route was found.
        if goal not in g_score:
            raise ValueError(
                "No traversable route found between these locations"
            )

        # Reconstruct the path.
        path = [goal]
        current = goal

        while current != start:
            current = came_from[current]
            path.append(current)

        path.reverse()

        # Calculate physical distance.
        distance_m = 0.0

        for a, b in zip(path, path[1:]):
            dr = b[0] - a[0]
            dc = b[1] - a[1]

            distance_m += math.hypot(
                dr * y_spacing,
                dc * x_spacing
            )

        # Calculate terrain statistics.
        path_slopes = [
            float(slope_grid[r, c])
            for r, c in path
        ]

        average_slope = float(np.mean(path_slopes))
        maximum_slope = float(np.max(path_slopes))

        # Convert planning-grid cells into normalized UV coordinates.
        # Return a manageable number of points for the frontend.
        stride = max(1, math.ceil(len(path) / 150))

        selected_indices = list(range(0, len(path), stride))

        if selected_indices[-1] != len(path) - 1:
            selected_indices.append(len(path) - 1)

        route_points = []

        for index in selected_indices:

            r, c = path[index]

            u = c / (cols - 1)
            v = 1 - r / (rows - 1)

            original_row = round((1 - v) * (src.height - 1))
            original_col = round(u * (src.width - 1))

            x, y = rasterio.transform.xy(
                src.transform,
                original_row,
                original_col,
                offset="center"
            )

            latitude = math.degrees(y / MARS_RADIUS)

            longitude = (
                CENTRAL_MERIDIAN
                + math.degrees(x / MARS_RADIUS)
            )

            route_points.append({
                "u": round(u, 6),
                "v": round(v, 6),
                "latitude": round(latitude, 6),
                "longitude": round(longitude, 6),
                "slope_degrees": round(
                    float(slope_grid[r, c]), 2
                )
            })

        return {
            "algorithm": "A* slope-weighted pathfinding",
            "product_id": PRODUCT_ID,
            "route": route_points,
            "statistics": {
                "distance_m": round(distance_m, 2),
                "average_slope_degrees": round(average_slope, 2),
                "maximum_slope_degrees": round(maximum_slope, 2),
                "grid_cells_traversed": len(path),
                "route_points_returned": len(route_points)
            },
            "terrain_constraints": {
                "maximum_allowed_slope_degrees": 25,
                "excluded_terrain": [
                    "Very steep terrain",
                    "NoData"
                ],
                "planning_grid": f"{cols} x {rows}",
                "slope_source": "ARES-derived NASA HiRISE DTM slope raster"
            },
            "warning": (
                "Experimental terrain-based route planning. "
                "Not validated for actual rover mobility or mission safety."
            )
        }


@app.get("/api/terrain/route")
def plan_rover_route(
    start_u: float = Query(..., ge=0, le=1),
    start_v: float = Query(..., ge=0, le=1),
    end_u: float = Query(..., ge=0, le=1),
    end_v: float = Query(..., ge=0, le=1)
):
    try:
        return calculate_rover_route(
            start_u,
            start_v,
            end_u,
            end_v
        )

    except (ValueError, FileNotFoundError) as error:
        raise HTTPException(status_code=400, detail=str(error))

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Route planning failed: {str(error)}"
        )

