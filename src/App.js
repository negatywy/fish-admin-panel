import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Dashboard } from "./components/dashboard";
import { FilterProvider } from "./context/FilterContext";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import './style/App.css';
import { Auth } from "./components/auth";
import { ControlMap } from "./components/ControlMap";
import { StatsCharts } from "./components/StatsCharts";
import { RangerStats } from "./components/RangerStats";
import "leaflet/dist/leaflet.css";

function App() {
  return (
    <AuthProvider>
      <FilterProvider>
        <Router>
        <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/controlMap" element={<ProtectedRoute><ControlMap /></ProtectedRoute>} />
            <Route path="/statsCharts" element={<ProtectedRoute><StatsCharts /></ProtectedRoute>} />
            <Route path="/rangerStats" element={<ProtectedRoute><RangerStats /></ProtectedRoute>} />
          </Routes>
        </Router>
      </FilterProvider>
    </AuthProvider>
  );
}

export default App;
