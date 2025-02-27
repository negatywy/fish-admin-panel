import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Dashboard } from "./components/dashboard";
import './style/App.css';
import { Auth } from "./components/auth";
import { ControlMap } from "./components/ControlMap";
import { StatsCharts } from "./components/StatsCharts";
import { RangerStats } from "./components/RangerStats";
import "leaflet/dist/leaflet.css";

function App() {
  return (
    <Router>
      <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/controlMap" element={<ControlMap />} />
          <Route path="/statsCharts" element={<StatsCharts />} />
          <Route path="/rangerStats" element={<RangerStats />} />
        </Routes>
      </Router>
  );
}

export default App;
