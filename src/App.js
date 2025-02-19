import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Dashboard } from "./components/dashboard";
import './style/App.css';
import { Auth } from "./components/auth";
import { ControlMap } from "./components/ControlMap";
import { StatsCharts } from "./components/StatsCharts";

function App() {
  return (
    <Router>
      <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/controlMap" element={<ControlMap />} />
          <Route path="/statsCharts" element={<StatsCharts />} />
        </Routes>
      </Router>
  );
}

export default App;
