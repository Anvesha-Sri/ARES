
import { useState } from "react";
import {
  Activity,
  BrainCircuit,
  Compass,
  Globe2,
  Layers3,
  Map,
  Mountain,
  Route,
  Satellite,
  Search,
  Settings,
  Telescope,
  Bell,
} from "lucide-react";

import MarsGlobe from "./components/globe/MarsGlobe";
import TerrainExplorer from "./components/terrain/TerrainExplorer";
import "./styles/ares.css";

const navigation = [
  { name: "Mission Control", icon: Globe2 },
  { name: "Mars Explorer", icon: Map },
  { name: "Scientific Layers", icon: Layers3 },
  { name: "Terrain Intelligence", icon: Mountain },
  { name: "Mission Planner", icon: Route },
  { name: "Science Discovery", icon: Telescope },
  { name: "AI Copilot", icon: BrainCircuit },
];

function App() {
  const [active, setActive] = useState("Mission Control");

  return (
    <main className="ares-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <h2>ARES</h2>
            <span>PLANETARY INTELLIGENCE</span>
          </div>
        </div>

        <div className="nav-label">MISSION SYSTEMS</div>

        {navigation.map(({ name, icon: Icon }) => (
          <button
            key={name}
            onClick={() => setActive(name)}
            className={`nav-link ${active === name ? "selected" : ""}`}
          >
            <Icon size={18} />
            <span>{name}</span>
          </button>
        ))}

        <div className="sidebar-bottom">
          <Settings size={17} />
          <span>System settings</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Compass size={17} />
            <span>ARES / {active.toUpperCase()}</span>
          </div>

          <div className="topbar-right">
            <span className="system-indicator">
              <i /> FRONTEND ONLINE
            </span>
            <Search size={18} />
            <Bell size={18} />
            <div className="avatar">EX</div>
          </div>
        </header>

        <div className="dashboard">
  {active === "Mars Explorer" ||
  active === "Terrain Intelligence" ? (
    <TerrainExplorer />
  ) : (
    <>
      <section className="hero-heading">
            <div>
              <div className="overline">ADVANCED RECONNAISSANCE & EXPLORATION</div>
              <h1>Beyond Earth. Into the Unknown.</h1>
              <p>
                A unified intelligence environment for planetary exploration,
                scientific discovery and mission planning.
              </p>
            </div>
            <div className="mission-chip">MISSION 001 · MARS</div>
          </section>

          <section className="metrics">
            <article className="metric-card">
              <Satellite />
              <span>DATA SOURCES</span>
              <strong>Pending</strong>
              <small>NASA integration in progress</small>
            </article>

            <article className="metric-card">
              <Mountain />
              <span>TERRAIN COVERAGE</span>
              <strong>Unverified</strong>
              <small>Awaiting DTM footprint audit</small>
            </article>

            <article className="metric-card">
              <Route />
              <span>GENERATED ROUTES</span>
              <strong>00</strong>
              <small>No route calculations yet</small>
            </article>

            <article className="metric-card">
              <Activity />
              <span>MISSION STATUS</span>
              <strong>INITIALIZED</strong>
              <small>Frontend operational</small>
            </article>
          </section>

          <section className="main-grid">
            <article className="globe-panel">
              <div className="panel-heading">
                <div>
                  <span className="overline">PLANETARY COMMAND</span>
                  <h2>Mars Global View</h2>
                </div>
                <span className="live-label">3D SIMULATION</span>
              </div>

              <div className="globe-container">
                <MarsGlobe />
                <div className="globe-caption">
                  <span>PLANET: MARS</span>
                  <span>INTERACTIVE GLOBE</span>
                </div>
              </div>

              <div className="globe-footer">
                <span>DRAG TO ROTATE</span>
                <span>SCROLL TO ZOOM</span>
              </div>
            </article>

            <aside className="intel-panel">
              <div className="panel-heading">
                <div>
                  <span className="overline">MISSION TARGET</span>
                  <h2>Gale Crater</h2>
                </div>
                <Globe2 size={19} />
              </div>

              <div className="target-visual">
                <div className="target-crosshair">+</div>
                <div className="target-name">GALE CRATER</div>
                <div className="target-description">
                  Curiosity rover exploration region
                </div>
              </div>

              <div className="coordinate-block">
                <span>REFERENCE LOCATION</span>
                <strong>4.59° S · 137.44° E</strong>
                <small>Provisional landing-site reference</small>
              </div>

              <div className="intel-divider" />

              <div className="intel-row">
                <span>Surface data</span>
                <strong>Pending verification</strong>
              </div>
              <div className="intel-row">
                <span>Terrain model</span>
                <strong>Not loaded</strong>
              </div>
              <div className="intel-row">
                <span>Science targets</span>
                <strong>Not assessed</strong>
              </div>
            </aside>
          </section>

          <section className="bottom-panel">
            <div className="panel-heading">
              <div>
                <span className="overline">SYSTEM ACTIVITY</span>
                <h2>Mission Initialization</h2>
              </div>
              <span className="activity-label">PHASE 01</span>
            </div>

            <div className="activity-grid">
              <div>
                <span className="activity-dot complete" />
                <div>
                  <strong>Frontend initialized</strong>
                  <small>React + TypeScript + Vite</small>
                </div>
              </div>
              <div>
                <span className="activity-dot pending" />
                <div>
                  <strong>NASA DTM verification</strong>
                  <small>Awaiting raster metadata</small>
                </div>
              </div>
              <div>
                <span className="activity-dot pending" />
                <div>
                  <strong>Terrain intelligence</strong>
                  <small>Not yet calculated</small>
                </div>
              </div>
              <div>
                <span className="activity-dot pending" />
                <div>
                  <strong>AI mission copilot</strong>
                  <small>Integration pending</small>
                </div>
              </div>
            </div>
          </section>

          <footer className="footer">
            ARES · ADVANCED RECONNAISSANCE & EXPLORATION SYSTEM
            <span>OBSERVED DATA · DERIVED DATA · SIMULATIONS</span>
          </footer>
             <footer className="footer">
        ARES · ADVANCED RECONNAISSANCE & EXPLORATION SYSTEM
        <span>OBSERVED DATA · DERIVED DATA · SIMULATIONS</span>
      </footer>
    </>
  )}
</div>
      </section>
    </main>
  );
}

export default App;
