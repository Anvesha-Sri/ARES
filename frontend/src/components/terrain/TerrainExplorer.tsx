
import { useEffect, useMemo, useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import { TextureLoader } from "three";
import axios from "axios";
import * as THREE from "three";
import {
  Mountain,
  Layers3,
  RotateCcw,
 // ZoomIn,
} from "lucide-react";

type TerrainLayer = "elevation" | "hillshade" | "slope" | "hazard";

interface TerrainSample {
  product_id: string;
  pixel: {
    row: number;
    column: number;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  elevation_m: number;
  slope_degrees: number;
  terrain_class: string;
  provenance: {
    elevation: string;
    slope: string;
    slope_method: string;
    classification: string;
  };
}

interface HazardAnalysis {
  product_id: string;
  classification_method: string;

  thresholds_degrees: {
    gentle_max: number;
    moderate_max: number;
    steep_max: number;
  };

  total_pixels: number;
  valid_pixels: number;
  invalid_pixels: number;

  class_counts: {
    gentle: number;
    moderate: number;
    steep: number;
    very_steep: number;
  };

  class_percentages: {
    gentle: number;
    moderate: number;
    steep: number;
    very_steep: number;
  };

  warning: string;
}
interface RoverRoutePoint {
  u: number;
  v: number;
  latitude: number;
  longitude: number;
  slope_degrees: number;
}

interface RoverRouteResponse {
  algorithm: string;
  product_id: string;

  route: RoverRoutePoint[];

  statistics: {
    distance_m: number;
    average_slope_degrees: number;
    maximum_slope_degrees: number;
    grid_cells_traversed: number;
    route_points_returned: number;
  };

  terrain_constraints: {
    maximum_allowed_slope_degrees: number;
    excluded_terrain: string[];
    planning_grid: string;
    slope_source: string;
  };

  warning: string;
}



const terrainAssets = {
  height: "/terrain/heightmap.png",
  mask: "/terrain/validity_mask.png",
  elevation: "/terrain/elevation.png",
  hillshade: "/terrain/hillshade.png",
  slope: "/terrain/slope.png",
  hazard: "/terrain/hazard.png",
};

function readPixels(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to read terrain image.");
  }

  context.drawImage(image, 0, 0);

  return {
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(
      0, 0, canvas.width, canvas.height
    ).data,
  };
}

function buildTerrainGeometry(
  heightImage: HTMLImageElement,
  maskImage: HTMLImageElement,
  exaggeration: number
) {
  const heightData = readPixels(heightImage);
  const maskData = readPixels(maskImage);

  const width = heightData.width;
  const height = heightData.height;

  if (
    width !== maskData.width ||
    height !== maskData.height
  ) {
    throw new Error("Heightmap and validity mask dimensions differ.");
  }

  const geometry = new THREE.BufferGeometry();

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const terrainWidth = 7.16;
  const terrainDepth = 15.22;
  const verticalScale = 1.35 * exaggeration;

  const valid: boolean[] = [];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const pixel = (row * width + col) * 4;

      const elevation =
        heightData.data[pixel] / 255;

      const isValid =
        maskData.data[pixel] >= 128;

      valid.push(isValid);

      const x =
        (col / (width - 1) - 0.5) * terrainWidth;

      const z =
        (0.5 - row / (height - 1)) * terrainDepth;

      const y = elevation * verticalScale;

      positions.push(
        x,
        isValid ? y : 0,
        z
      );

      uvs.push(
        col / (width - 1),
        1 - row / (height - 1)
      );
    }
  }

  // Build triangles only where all four
  // surrounding heightmap pixels are valid.

  for (let row = 0; row < height - 1; row++) {
    for (let col = 0; col < width - 1; col++) {
      const a = row * width + col;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;

      if (
        valid[a] &&
        valid[b] &&
        valid[c] &&
        valid[d]
      ) {
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );

  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

function TerrainMesh({
  layer,
  exaggeration,
  onInspect,
  route,
  startPoint,
  endPoint,
}: {
  layer: TerrainLayer;
  exaggeration: number;
  onInspect: (u: number, v: number) => void;
  route: RoverRouteResponse | null;
  startPoint: { u: number; v: number };
  endPoint: { u: number; v: number };
}) {
  const [
  heightTexture,
  maskTexture,
  elevationTexture,
  hillshadeTexture,
  slopeTexture,
  hazardTexture,
] = useLoader(TextureLoader, [
  terrainAssets.height,
  terrainAssets.mask,
  terrainAssets.elevation,
  terrainAssets.hillshade,
  terrainAssets.slope,
  terrainAssets.hazard,
]);

  const geometry = useMemo(
    () =>
      buildTerrainGeometry(
        heightTexture.image as HTMLImageElement,
        maskTexture.image as HTMLImageElement,
        exaggeration
      ),
    [heightTexture, maskTexture, exaggeration]
  );

  useEffect(() => {
  const colorTextures = [
    elevationTexture,
    hillshadeTexture,
    slopeTexture,
    hazardTexture,
  ];

  colorTextures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  });
}, [
  elevationTexture,
  hillshadeTexture,
  slopeTexture,
  hazardTexture,
]);

  const textureMap = {
  elevation: elevationTexture,
  hillshade: hillshadeTexture,
  slope: slopeTexture,
  hazard: hazardTexture,
};

const activeTexture = textureMap[layer];
const markerPositions = useMemo(() => {
  const image = heightTexture.image as HTMLImageElement;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(image, 0, 0);

  const pixels = context.getImageData(
    0,
    0,
    image.width,
    image.height
  ).data;

  function getPosition(point: { u: number; v: number }) {
    const column = Math.max(
      0,
      Math.min(image.width - 1, Math.round(point.u * (image.width - 1)))
    );

    const row = Math.max(
      0,
      Math.min(image.height - 1, Math.round((1 - point.v) * (image.height - 1)))
    );

    const index = (row * image.width + column) * 4;
    const y = (pixels[index] / 255) * (1.35 * exaggeration) + 0.06;

    return [
      (point.u - 0.5) * 7.16,
      y,
      (point.v - 0.5) * 15.22,
    ] as [number, number, number];
  }

  return {
    start: getPosition(startPoint),
    end: getPosition(endPoint),
  };
}, [heightTexture, exaggeration, startPoint, endPoint]);
const routePoints = useMemo(() => {
  
  if (!route || route.route.length === 0) {
    return [];
  }

  const image = heightTexture.image as HTMLImageElement;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");

  if (!context) return [];

  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(
    0,
    0,
    image.width,
    image.height
  );

  const pixels = imageData.data;

  return route.route.map((point) => {
    const column = Math.max(
      0,
      Math.min(image.width - 1, Math.round(point.u * (image.width - 1)))
    );

    const row = Math.max(
      0,
      Math.min(image.height - 1, Math.round((1 - point.v) * (image.height - 1)))
    );

    const pixelIndex = (row * image.width + column) * 4;

    const heightValue = pixels[pixelIndex] / 255;

    const x = (point.u - 0.5) * 7.16;
    const z = (point.v - 0.5) * 15.22;
    const y = heightValue * (1.35 * exaggeration) + 0.035;

    return [x, y, z] as [number, number, number];
  });
}, [route, heightTexture, exaggeration]);


return (
  <>
    <mesh
      geometry={geometry}
      // rotation={[-Math.PI / 2, 0, 0]}
      dispose={null}
      onClick={(event) => {
        event.stopPropagation();

        if (event.uv) {
          onInspect(event.uv.x, event.uv.y);
        }
      }}
    >
      <meshStandardMaterial
        map={activeTexture}
        color="#ffffff"
        roughness={0.95}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
    </mesh>

    {routePoints.length > 1 && (
      <Line
        points={routePoints}
        color="#00e5ff"
        lineWidth={3}
        dashed={false}
      />
    )}

{markerPositions && (
  <>
    {/* Rover starting point */}
    <mesh position={markerPositions.start}>
      <sphereGeometry args={[0.11, 20, 20]} />
      <meshBasicMaterial color="#39ff88" />
    </mesh>

    {/* Rover destination */}
    <mesh position={markerPositions.end}>
      <sphereGeometry args={[0.13, 20, 20]} />
      <meshBasicMaterial color="#ff4545" />
    </mesh>
  </>
)}

    {routePoints.length > 1 && (
  <>
    <mesh position={routePoints[0]}>
      <sphereGeometry args={[0.11, 20, 20]} />
      <meshBasicMaterial color="#39ff88" />
    </mesh>

    <mesh position={routePoints[routePoints.length - 1]}>
      <sphereGeometry args={[0.13, 20, 20]} />
      <meshBasicMaterial color="#ff4545" />
    </mesh>
  </>
)}
  </>
);
}


function TerrainScene({
  layer,
  exaggeration,
  onInspect,
  route,
  startPoint,
  endPoint,
}: {
  layer: TerrainLayer;
  exaggeration: number;
  onInspect: (u: number, v: number) => void;
  route: RoverRouteResponse | null;
  startPoint: { u: number; v: number };
  endPoint: { u: number; v: number };
}) {
  return (
    <>
      <color attach="background" args={["#080c12"]} />

      <ambientLight intensity={1.1} />

      <directionalLight
        position={[5, 10, 5]}
        intensity={2.2}
        color="#fff0dc"
      />

      <directionalLight
        position={[-5, 4, -5]}
        intensity={0.7}
        color="#6c9ebd"
      />

      <Stars
        radius={65}
        depth={40}
        count={1200}
        factor={2}
        fade
        speed={0.15}
      />

      <TerrainMesh
        layer={layer}
        exaggeration={exaggeration}
        onInspect={onInspect}
        route={route}
        startPoint={startPoint}
        endPoint={endPoint}
      />

      <gridHelper
        args={[22, 22, "#273744", "#17232c"]}
        position={[0, -0.06, 0]}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        enablePan
        enableZoom
        minDistance={5}
        maxDistance={28}
        maxPolarAngle={Math.PI * 0.48}
        target={[0, 0.4, 0]}
      />
    </>
  );
}

export default function TerrainExplorer() {

const [inspection, setInspection] = useState<TerrainSample | null>(null);
const [inspectionLoading, setInspectionLoading] = useState(false);
const [inspectionError, setInspectionError] = useState("");
const [hazards, setHazards] = useState<HazardAnalysis | null>(null);
const [hazardLoading, setHazardLoading] = useState(true);
const [hazardError, setHazardError] = useState("");

const [route, setRoute] = useState<RoverRouteResponse | null>(null);
const [routeLoading, setRouteLoading] = useState(false);
const [routeError, setRouteError] = useState("");

const [hazardAnalysis, setHazardAnalysis] =
  useState<HazardAnalysis | null>(null);

const [startPoint, setStartPoint] = useState({
  u: 0.45,
  v: 0.5,
});

const [endPoint, setEndPoint] = useState({
  u: 0.55,
  v: 0.5,
});

const [selectionMode, setSelectionMode] = useState<
  "inspect" | "start" | "end"
>("inspect");

useEffect(() => {
  let cancelled = false;

  async function fetchHazards() {
    try {
      setHazardLoading(true);
      setHazardError("");

      const response = await axios.get<HazardAnalysis>(
  "http://127.0.0.1:8000/api/terrain/hazards"
);

setHazardAnalysis(response.data);

      if (!cancelled) {
        setHazards(response.data);
      }
    } catch (error) {
      console.error("ARES hazard analysis failed:", error);

      if (!cancelled) {
        setHazardError(
          "Unable to retrieve terrain hazard statistics."
        );
      }
    } finally {
      if (!cancelled) {
        setHazardLoading(false);
      }
    }
  }

  fetchHazards();

  return () => {
    cancelled = true;
  };
}, []);


async function inspectTerrain(u: number, v: number) {
  // Select rover starting point
  if (selectionMode === "start") {
    setStartPoint({ u, v });
    setRoute(null);
    setSelectionMode("inspect");
    console.log("ARES rover start selected:", { u, v });
    return;
  }

  // Select rover destination
  if (selectionMode === "end") {
    setEndPoint({ u, v });
    setRoute(null);
    setSelectionMode("inspect");
    console.log("ARES rover destination selected:", { u, v });
    return;
  }

  // Normal terrain inspection
  try {
    setInspectionLoading(true);
    setInspectionError("");

    console.log("ARES inspection request:", { u, v });

    const response = await axios.get<TerrainSample>(
      "http://127.0.0.1:8000/api/terrain/sample",
      { params: { u, v } }
    );

    console.log("ARES inspection response:", response.data);

    setInspection(response.data);
  } catch (error: unknown) {
    console.error("ARES terrain inspection failed:", error);

    if (axios.isAxiosError(error)) {
      const details = error.response
        ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
        : error.message;

      setInspectionError(`Terrain inspection failed: ${details}`);
    } else {
      setInspectionError("Unexpected terrain inspection error.");
    }

    setInspection(null);
  } finally {
    setInspectionLoading(false);
  }
}


  const [layer, setLayer] =
    useState<TerrainLayer>("elevation");

  const [exaggeration, setExaggeration] =
    useState(2);

  const layers: {
    id: TerrainLayer;
    label: string;
  }[] = [
    { id: "elevation", label: "Elevation" },
    { id: "hillshade", label: "Hillshade" },
    { id: "slope", label: "Slope" },
    { id: "hazard", label: "Hazard Classification" },
  ];

  return (
    <section className="terrain-explorer">

      <div className="terrain-page-heading">
        <div>
          <span className="overline">
            PLANETARY SURFACE INTELLIGENCE
          </span>

          <h1>Gale Crater Explorer</h1>

          <p>
            High-resolution terrain reconstructed from
            NASA HiRISE elevation data.
          </p>
        </div>

        <div className="terrain-source-badge">
          <i />
          NASA HiRISE · DTM VERIFIED
        </div>
      </div>

      <div className="terrain-stats">
        <div>
          <span>STUDY AREA WIDTH</span>
          <strong>7.16 km</strong>
        </div>

        <div>
          <span>STUDY AREA LENGTH</span>
          <strong>15.22 km</strong>
        </div>

        <div>
          <span>POST SPACING</span>
          <strong>1.012 m</strong>
        </div>

        <div>
          <span>ELEVATION RANGE</span>
          <strong>393.09 m</strong>
        </div>
      </div>

      <section className="hazard-dashboard">
  <div className="hazard-heading">
    <div>
      <span className="overline">TERRAIN RISK ASSESSMENT</span>
      <h2>Hazard Intelligence</h2>
      <p>
        Full-resolution slope classification across the NASA HiRISE study area.
      </p>
    </div>

    <span className="hazard-status">
      {hazardLoading
        ? "ANALYSING"
        : hazards
        ? "ANALYSIS VERIFIED"
        : "DATA UNAVAILABLE"}
    </span>
  </div>

  {hazardLoading && (
    <p className="hazard-message">
      Loading terrain classification statistics...
    </p>
  )}

  {hazardError && (
    <p className="hazard-error">{hazardError}</p>
  )}

  {hazards && (
    <>
      <div className="hazard-cards">
        {(
          [
            {
              key: "gentle",
              label: "Gentle",
              description: "< 5°",
              color: "#49d6a0",
            },
            {
              key: "moderate",
              label: "Moderate",
              description: "5° – 15°",
              color: "#e9c46a",
            },
            {
              key: "steep",
              label: "Steep",
              description: "15° – 25°",
              color: "#f08b52",
            },
            {
              key: "very_steep",
              label: "Very Steep",
              description: "≥ 25°",
              color: "#ef5d67",
            },
          ] as const
        ).map((item) => (
          <article className="hazard-card" key={item.key}>
            <span
              className="hazard-indicator"
              style={{ backgroundColor: item.color }}
            />

            <span className="hazard-category">
              {item.label}
            </span>

            <strong>
              {hazards.class_percentages[item.key].toFixed(2)}%
            </strong>

            <small>{item.description}</small>

            <div className="hazard-bar">
              <div
                style={{
                  width: `${hazards.class_percentages[item.key]}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>

            <span className="hazard-count">
              {hazards.class_counts[item.key].toLocaleString()} pixels
            </span>
          </article>
        ))}
      </div>

      <div className="hazard-coverage">
        <div>
          <span>VALID PIXELS</span>
          <strong>{hazards.valid_pixels.toLocaleString()}</strong>
        </div>

        <div>
          <span>INVALID PIXELS</span>
          <strong>{hazards.invalid_pixels.toLocaleString()}</strong>
        </div>

        <div>
          <span>TOTAL PIXELS</span>
          <strong>{hazards.total_pixels.toLocaleString()}</strong>
        </div>
      </div>

      <div className="hazard-provenance">
        <span>CLASSIFICATION METHOD</span>
        <strong>{hazards.classification_method}</strong>
        <small>{hazards.product_id}</small>
      </div>

      <div className="hazard-warning">
        <strong>SCIENTIFIC CAUTION</strong>
        <p>{hazards.warning}</p>
      </div>
    </>
  )}
</section>


      <div className="terrain-viewport">

        <div className="terrain-toolbar">
          <div className="terrain-toolbar-title">
            <Mountain size={18} />
            <span>3D TERRAIN RECONSTRUCTION</span>
          </div>

          <div className="terrain-mode-label">
            INTERACTIVE MODE
          </div>
        </div>

        <div className="terrain-canvas">
          <Canvas
            camera={{
              position: [10, 10, 13],
              fov: 42,
              near: 0.1,
              far: 100,
            }}
            dpr={[1, 1.5]}
          >
            <TerrainScene
              layer={layer}
              exaggeration={exaggeration}
              onInspect={inspectTerrain}
              route={route}
              startPoint={startPoint}
              endPoint={endPoint}
            />
          </Canvas>

          <div className="terrain-overlay-top">
            <span>GALE CRATER · MARS</span>
            <span>HIRES TERRAIN MODEL</span>
          </div>

          <div className="terrain-overlay-bottom">
            DRAG TO ORBIT · SCROLL TO ZOOM
          </div>
        </div>

        <section className="inspection-panel">
  <div className="inspection-header">
  <div>
    <span className="overline">SCIENTIFIC ANALYSIS</span>
    <h2>Terrain Point Inspector</h2>
    <p className="inspection-hint">
      Click the 3D terrain or inspect its centre.
    </p>
  </div>

  <div className="inspection-actions">
    <span className="live-label">
      {inspectionLoading
        ? "ANALYSING..."
        : inspection
        ? "POINT SELECTED"
        : "RASTER CONNECTED"}
    </span>

    <button
      type="button"
      className="inspect-center-button"
      onClick={() => inspectTerrain(0.5, 0.5)}
      disabled={inspectionLoading}
    >
      <Mountain size={15} />
      Inspect Centre
    </button>
  </div>
</div>

  {!inspection && !inspectionLoading && !inspectionError && (
    <p className="inspection-empty">
      Select any point on the 3D terrain to retrieve its scientific data.
    </p>
  )}

  {inspectionLoading && (
    <p className="inspection-empty">Sampling NASA terrain data...</p>
  )}

  {inspectionError && (
    <p className="inspection-error">{inspectionError}</p>
  )}

  {inspection && (
    <>
      <div className="inspection-metrics">
        <article>
          <span>ELEVATION</span>
          <strong>{inspection.elevation_m.toFixed(2)} m</strong>
        </article>

        <article>
          <span>SLOPE</span>
          <strong>{inspection.slope_degrees.toFixed(2)}°</strong>
        </article>

        <article>
          <span>TERRAIN CLASS</span>
          <strong>{inspection.terrain_class}</strong>
        </article>
      </div>

      <div className="inspection-coordinates">
        <div>
          <span>MARTIAN LATITUDE</span>
          <strong>{inspection.coordinates.latitude.toFixed(6)}°</strong>
        </div>

        <div>
          <span>MARTIAN LONGITUDE</span>
          <strong>{inspection.coordinates.longitude.toFixed(6)}°</strong>
        </div>

        <div>
          <span>RASTER ROW</span>
          <strong>{inspection.pixel.row}</strong>
        </div>

        <div>
          <span>RASTER COLUMN</span>
          <strong>{inspection.pixel.column}</strong>
        </div>
      </div>

      <div className="inspection-provenance">
        <span>DATA PROVENANCE</span>
        <p>{inspection.product_id}</p>
        <small>{inspection.provenance.elevation}</small>
        <small>{inspection.provenance.slope_method}</small>
      </div>
    </>
  )}
</section>

        <div className="terrain-controls">

          <div className="terrain-layer-control">
            <div className="terrain-control-label">
              <Layers3 size={16} />
              SCIENTIFIC LAYER
            </div>

<div className="rover-route-panel">
  <div className="rover-route-header">
    <h3>ROVER NAVIGATION</h3>
    <span>ARES PATHFINDER</span>
  </div>

  <p>
    Calculate a terrain-aware route between the selected coordinates.
  </p>

<div className="route-selection-controls">
  <button
    className={`route-select-button ${selectionMode === "start" ? "selected" : ""}`}
    onClick={() => setSelectionMode("start")}
  >
    <span className="route-marker start-marker" />
    {selectionMode === "start"
      ? "CLICK TERRAIN TO SET START"
      : "SELECT START POINT"}
  </button>

  <button
    className={`route-select-button ${selectionMode === "end" ? "selected" : ""}`}
    onClick={() => setSelectionMode("end")}
  >
    <span className="route-marker end-marker" />
    {selectionMode === "end"
      ? "CLICK TERRAIN TO SET DESTINATION"
      : "SELECT DESTINATION"}
  </button>
</div>

<div className="route-coordinate-display">
  <span>
    START: {startPoint.u.toFixed(4)}, {startPoint.v.toFixed(4)}
  </span>

  <span>
    DESTINATION: {endPoint.u.toFixed(4)}, {endPoint.v.toFixed(4)}
  </span>
</div>


  <button
    className="route-calculate-button"
    onClick={calculateRoute}
    disabled={routeLoading}
  >
    {routeLoading ? "CALCULATING ROUTE..." : "CALCULATE ROVER ROUTE"}
  </button>
  <button
  className="route-clear-button"
  onClick={() => {
    setRoute(null);
    setRouteError("");
    setSelectionMode("inspect");
  }}
  disabled={!route && !routeError}
>
  CLEAR ROUTE
</button>

  {routeError && (
    <p className="route-error">{routeError}</p>
  )}


{route && (
  <>
    <div className="route-statistics">
      <div>
        <span>ROUTE DISTANCE</span>
        <strong>{route.statistics.distance_m.toFixed(2)} m</strong>
      </div>

      <div>
        <span>AVERAGE SLOPE</span>
        <strong>{route.statistics.average_slope_degrees.toFixed(2)}°</strong>
      </div>

      <div>
        <span>MAXIMUM SLOPE</span>
        <strong>{route.statistics.maximum_slope_degrees.toFixed(2)}°</strong>
      </div>

      <div>
        <span>GRID CELLS</span>
        <strong>{route.statistics.grid_cells_traversed}</strong>
      </div>
    </div>

    {route.route.length > 1 && (
      <div className="route-profile">
        <h4>ROVER TERRAIN PROFILE</h4>

        <p>
          Slope variation across calculated route waypoints
        </p>

        <div className="route-profile-chart">
          {route.route.map((point, index) => {
            const maxSlope = Math.max(
              ...route.route.map((item) => item.slope_degrees),
              1
            );

            const barHeight = Math.max(
              5,
              (point.slope_degrees / maxSlope) * 100
            );

            const barColor =
              point.slope_degrees < 5
                ? "#27d17f"
                : point.slope_degrees < 15
                ? "#f6c445"
                : "#f28c38";

            return (
              <div
                key={index}
                className="route-profile-bar"
                style={{
                  height: `${barHeight}%`,
                  background: barColor,
                }}
                title={`Waypoint ${index + 1}: ${point.slope_degrees.toFixed(2)}°`}
              />
            );
          })}
        </div>

        <div className="route-profile-labels">
          <span>ROUTE START</span>
          <span>ROUTE DESTINATION</span>
        </div>

        <div className="route-profile-legend">
          <span>🟢 Gentle (&lt;5°)</span>
          <span>🟡 Moderate (5°–15°)</span>
          <span>🟠 Steep (15°–25°)</span>
        </div>
      </div>
    )}

    <p className="route-warning">{route.warning}</p>
    <div className="mission-assessment">
  <div className="mission-assessment-header">
    <span>ARES MISSION INTELLIGENCE</span>
    <span className="mission-live">ANALYSIS COMPLETE</span>
  </div>

  <h4>
    {route.statistics.maximum_slope_degrees < 5
      ? "LOW SLOPE ROUTE"
      : route.statistics.maximum_slope_degrees < 15
      ? "MODERATE TERRAIN CHALLENGE"
      : "HIGH TERRAIN CHALLENGE"}
  </h4>

  <p>
    The calculated rover path covers{" "}
    <strong>{route.statistics.distance_m.toFixed(2)} metres</strong>,
    with an average slope of{" "}
    <strong>
      {route.statistics.average_slope_degrees.toFixed(2)}°
    </strong>.
    Maximum observed route slope is{" "}
    <strong>
      {route.statistics.maximum_slope_degrees.toFixed(2)}°
    </strong>.
  </p>

  <p>
    {route.statistics.maximum_slope_degrees < 5
      ? "The sampled route has consistently gentle slopes. Other mobility hazards and mission constraints still require evaluation."
      : route.statistics.maximum_slope_degrees < 15
      ? "The route includes moderate gradients. Review individual waypoints and terrain conditions before mission selection."
      : "The route contains challenging gradients. Consider alternative endpoints or a revised path."}
  </p>

  <small>
    Experimental slope-based assessment · Not a certified rover safety decision
  </small>
</div>
  </>
)}

<div className="route-legend">
  <span><i className="legend-dot start-dot" /> START</span>
  <span><i className="legend-dot end-dot" /> DESTINATION</span>
  <span><i className="legend-line" /> ROVER PATH</span>
</div>


<div className="route-status">
  <span className="route-status-indicator" />
  {route
    ? "ROUTE CALCULATED"
    : "AWAITING ROUTE CALCULATION"}
</div>


            <div className="terrain-layer-buttons">
              {layers.map((item) => (
                <button
                  key={item.id}
                  className={
                    layer === item.id ? "active" : ""
                  }
                  onClick={() => setLayer(item.id)}
                >
                  {item.label}
                </button>
              ))}
              {layer === "hazard" && (
  <div className="hazard-legend">
    <div className="hazard-legend-title">
      TERRAIN HAZARD CLASSIFICATION
    </div>

    <div className="hazard-legend-items">
      <span><i className="hazard-dot gentle" /> Gentle &lt; 5°</span>
      <span><i className="hazard-dot moderate" /> Moderate 5°–15°</span>
      <span><i className="hazard-dot steep" /> Steep 15°–25°</span>
      <span><i className="hazard-dot very-steep" /> Very steep ≥ 25°</span>
    </div>
  </div>
)}
            </div>
          {hazards && (
  <div className="scientific-insights">
    <div className="scientific-insights-header">
      <span>SCIENTIFIC DISCOVERY</span>
      <span>NASA HiRISE DTM</span>
    </div>

    <h4>GALE CRATER TERRAIN INTELLIGENCE</h4>

    <div className="insight-metrics">
      <div>
        <span>GENTLE TERRAIN</span>
        <strong>{hazards.class_percentages.gentle.toFixed(2)}%</strong>
      </div>

      <div>
        <span>MODERATE TERRAIN</span>
        <strong>{hazards.class_percentages.moderate.toFixed(2)}%</strong>
      </div>

      <div>
        <span>STEEP TERRAIN</span>
        <strong>{hazards.class_percentages.steep.toFixed(2)}%</strong>
      </div>

      <div>
        <span>VERY STEEP</span>
        <strong>{hazards.class_percentages.very_steep.toFixed(2)}%</strong>
      </div>
    </div>

    <div className="insight-bar">
      <div style={{
        width: `${hazards.class_percentages.gentle}%`,
      }} />
    </div>

    <p>
      Gentle terrain represents{" "}
      <strong>{hazards.class_percentages.gentle.toFixed(2)}%</strong>
      {" "}of valid classified raster pixels. Steep and very steep terrain
      together represent{" "}
      <strong>
        {(hazards.class_percentages.steep +
          hazards.class_percentages.very_steep).toFixed(2)}%
      </strong>.
    </p>

    <small>
      {hazards.valid_pixels.toLocaleString()} valid pixels ·
      {" "}{hazards.invalid_pixels.toLocaleString()} invalid pixels
    </small>
  </div>
)}
</div>
          </div>

          <div className="terrain-exaggeration">
            <div className="terrain-control-label">
              <Mountain size={16} />
              VERTICAL EXAGGERATION

              <strong>{exaggeration.toFixed(1)}×</strong>
            </div>

            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={exaggeration}
              onChange={(event) =>
                setExaggeration(Number(event.target.value))
              }
            />
          </div>

          <button
            className="terrain-reset"
            onClick={() => {
              setLayer("elevation");
              setExaggeration(2);
            }}
          >
            <RotateCcw size={15} />
            Reset
          </button>

        </div>
      </div>

      <div className="terrain-information">
        <div>
          <span className="overline">DATA PROVENANCE</span>
          <strong>NASA HiRISE DTM</strong>
          <small>
            DTEEC_018854_1755_018920_1755_U01
          </small>
        </div>

        <div>
          <span className="overline">ELEVATION MINIMUM</span>
          <strong>−4,509.43 m</strong>
        </div>

        <div>
          <span className="overline">ELEVATION MAXIMUM</span>
          <strong>−4,116.33 m</strong>
        </div>

        <div>
          <span className="overline">RENDERING</span>
          <strong>256 × 544 mesh grid</strong>
        </div>
      </div>

      <p className="terrain-disclaimer">
        Visualization uses a reduced-resolution representation
        of the verified HiRISE DTM. Vertical exaggeration is
        adjustable and does not represent true terrain scale.
        NoData regions are excluded from mesh generation.
      </p>

    </section>
  );
async function calculateRoute() {
    // Validate selected coordinates
  const points = [startPoint, endPoint];

  const invalidPoint = points.some(
    (point) =>
      !Number.isFinite(point.u) ||
      !Number.isFinite(point.v) ||
      point.u < 0 ||
      point.u > 1 ||
      point.v < 0 ||
      point.v > 1
  );

  if (invalidPoint) {
    setRouteError("Invalid coordinates. Select both points again.");
    return;
  }

  // Prevent identical start and destination
  const samePoint =
    Math.abs(startPoint.u - endPoint.u) < 0.001 &&
    Math.abs(startPoint.v - endPoint.v) < 0.001;

  if (samePoint) {
    setRouteError("Start and destination must be different locations.");
    setRoute(null);
    return;
  }
  try {
    setRouteLoading(true);
    setRouteError("");

    const response = await axios.get<RoverRouteResponse>(
      "http://127.0.0.1:8000/api/terrain/route",
      {
        params: {
          start_u: startPoint.u,
          start_v: startPoint.v,
          end_u: endPoint.u,
          end_v: endPoint.v,
        },
      }
    );

    setRoute(response.data);

    console.log("ARES rover route:", response.data);
  } catch (error: unknown) {
    console.error("ARES route planning failed:", error);

    setRoute(null);

    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail ?? error.message;
      setRouteError(String(detail));
    } else {
      setRouteError("Unexpected route planning error.");
    }
  } finally {
    setRouteLoading(false);
  }
}
}
