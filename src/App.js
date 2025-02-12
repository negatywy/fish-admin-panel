import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Dashboard } from "./pages/dashboard";
import './App.css';
import { Auth } from "./components/auth";

function App() {
  return (
    <Router>
      <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Router>
  );
}

export default App;
