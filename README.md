# 🪐 ARES
### ADVANCED RECONNAISSANCE & EXPLORATION SYSTEM

**Explore the Terrain. Predict the Hazards. Plan the Mission.**

An interactive planetary terrain intelligence platform powered by real NASA HiRISE elevation data. ARES transforms the Martian landscape into an immersive 3D exploration environment, combining scientific terrain analysis, hazard intelligence, and experimental autonomous rover route planning.

<p align="center">

**NASA SPACE APPS CHALLENGE 2026**

`PLANETARY SCIENCE` · `3D VISUALIZATION` · `TERRAIN INTELLIGENCE` · `ROVER PATHFINDING`

</p>

---

## 🎬 PROJECT DEMONSTRATION

**See ARES in action.**

Experience the complete workflow — from exploring the Gale Crater terrain to identifying hazards and generating terrain-aware rover routes.

▶ **[WATCH THE ARES PROJECT DEMO](frontend/src/assets/CTRLX.mp4)**
https://github.com/Anvesha-Sri/ARES/blob/1f03c9018b1fc1e057d0529cefd5b19d2c2759c0/frontend/src/assets/CTRLX.mp4


---

## 🌌 THE MISSION

Exploring Mars requires more than reaching a destination. Every elevation change, steep slope, and uncertain terrain region can influence a rover's ability to navigate the planetary surface.

ARES addresses this challenge by bringing real planetary elevation data, interactive 3D visualization, scientific terrain assessment, and computational pathfinding into a unified exploration platform.

Using a NASA HiRISE Digital Terrain Model of the Gale Crater region, ARES enables users to:

- Explore a reconstructed 3D Martian landscape.
- Investigate terrain through scientific visualization layers.
- Inspect individual locations using actual raster measurements.
- Quantify slope-based terrain hazards.
- Generate experimental rover routes using A* pathfinding.
- Evaluate proposed routes through mission statistics and slope profiles.

**One platform. From planetary observation to terrain-aware route planning.**

---

## 🚀 CORE CAPABILITIES

### 01 — Immersive 3D Terrain Explorer

Explore the Martian surface through an interactive three-dimensional terrain reconstruction.

- Rotate and navigate the terrain.
- Zoom into topographic features.
- Examine elevation variations.
- Visualize the landscape using NASA-derived terrain assets.

### 02 — Multi-Layer Scientific Visualization

Switch between four scientific terrain visualization modes.

| Visualization | Scientific purpose |
|:---|:---|
| 🏔️ Elevation | Understand surface height variations |
| 🌄 Hillshade | Reveal terrain morphology and topographic structures |
| 📐 Slope | Examine the steepness of the surface |
| 🚨 Hazard Classification | Identify slope-based terrain risk categories |

### 03 — Terrain Hazard Intelligence

ARES processes slope measurements and classifies valid terrain pixels into four categories.

| Classification | Slope threshold | Visual indicator |
|:---|:---:|:---|
| Gentle | Below 5° | 🟢 |
| Moderate | 5°–15° | 🟡 |
| Steep | 15°–25° | 🟠 |
| Very Steep | 25° or greater | 🔴 |

#### Gale Crater — Terrain Analysis Results

| Terrain class | Pixel count | Percentage |
|:---|---:|---:|
| Gentle | 53,999,912 | 69.35% |
| Moderate | 22,263,032 | 28.59% |
| Steep | 1,321,495 | 1.70% |
| Very Steep | 281,068 | 0.36% |

**Analysis coverage**

- Valid classified pixels: 77,865,507
- Invalid pixels: 28,542,493
- Total slope raster pixels: 106,408,000

These percentages represent the distribution of valid classified slope pixels, not guaranteed rover-accessible land area.

### 04 — Precision Terrain Inspection

Investigate individual locations directly on the 3D surface.

Each inspection retrieves:

- Elevation in metres.
- Slope in degrees.
- Terrain classification.
- Geographic latitude and longitude.
- Raster row and column.
- Scientific data provenance.

The backend retrieves measurements from the full-resolution terrain raster, rather than treating the displayed 3D mesh as the scientific measurement source.

### 05 — A* Intelligent Rover Route Planner

ARES incorporates the A* search algorithm to generate experimental terrain-aware routes between user-selected locations.

**Route planning workflow**

1. Select the rover starting point.
2. Select the destination.
3. Submit the route calculation.
4. Evaluate terrain constraints.
5. Visualize the generated path on the 3D surface.

**Planning characteristics**

- Eight-direction grid movement.
- Physical terrain-cell spacing in distance calculations.
- Slope-dependent movement cost.
- Exclusion of very steep terrain.
- Exclusion of invalid and NoData regions.
- Diagonal corner-cutting prevention.

The route planner uses a downsampled **256 × 544 planning grid** to make pathfinding computationally practical.

### 06 — Mission Assessment & Route Analytics

Each generated route includes:

| Metric | Description |
|:---|:---|
| Route distance | Total calculated path length |
| Average slope | Mean slope along route waypoints |
| Maximum slope | Highest waypoint slope |
| Grid cells traversed | Number of route cells |
| Route slope profile | Visual representation of slope variation |

The mission assessment combines route statistics and terrain information to support interpretation of the proposed path.

---

## 📊 SCIENTIFIC APPROACH

ARES transforms planetary elevation data into actionable terrain intelligence through a multi-stage processing pipeline.

**Data acquisition → Terrain processing → Scientific analysis → Interactive exploration → Route planning**

### Terrain Processing Pipeline

1. Acquire the NASA HiRISE Digital Terrain Model.
2. Verify dimensions, spatial reference, resolution, and valid-data coverage.
3. Prepare elevation and visualization rasters.
4. Generate hillshade and slope products.
5. Classify valid slope pixels into hazard categories.
6. Serve full-resolution terrain measurements through the backend.
7. Generate experimental routes using A* search.

### Slope-Based Classification

ARES uses the following threshold-based classification:

| Slope | Terrain category |
|:---:|:---|
| θ < 5° | Gentle |
| 5° ≤ θ < 15° | Moderate |
| 15° ≤ θ
