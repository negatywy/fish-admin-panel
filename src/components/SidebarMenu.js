import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { useFilters } from "../context/FilterContext";
import { useAuth } from "../context/AuthContext";
import { FaChartBar, FaHistory, FaMap, FaChartLine, FaUsers, FaCog } from "react-icons/fa";
import logo from "../assets/ranger_logo.jpg";

export const SidebarMenu = ({ setActiveComponent }) => {
    const navigate = useNavigate();
    const { setDateFilter } = useFilters();
    const { currentUser } = useAuth();

    const logout = async () => {
        try {
            await signOut(auth);
            navigate("/");
        } catch (err) {
            console.error(err);
        }
    };

    const handleNavigation = (component, defaultFilter = "lastWeek") => {
        setDateFilter(defaultFilter);
        setActiveComponent(component);
    };

    const isOmpzwAdmin = currentUser?.email === "admin.ompzw@naturai.pl";

    return (
        <div className="sidebar">
            <img src={logo} alt="Logo" className="sidebar-logo" />
            <button className="default-btn" onClick={() => handleNavigation("dataTable")}><FaHistory style={{marginRight: '0.5rem'}} />Historia kontroli</button>
            <button className="default-btn" onClick={() => handleNavigation("controlMap")}><FaMap style={{marginRight: '0.5rem'}} />Mapa kontroli</button>
            <button className="default-btn" onClick={() => handleNavigation("rangerStats")}><FaChartLine style={{marginRight: '0.5rem'}} />Statystyki</button>
            <button className="default-btn" onClick={() => handleNavigation("statsCharts")}><FaChartBar style={{marginRight: '0.5rem'}} />Wykresy statystyk</button>
            <button className="default-btn" onClick={() => handleNavigation("userManagement", "currentMonth")}><FaUsers style={{marginRight: '0.5rem'}} />Użytkownicy</button>
            <button className="default-btn" onClick={() => handleNavigation("konfigurator")}><FaCog style={{marginRight: '0.5rem'}} />Konfigurator</button>
            {isOmpzwAdmin && (
                <div style={{marginTop: 'auto', padding: '1rem', textAlign: 'center'}}>
                    <img src="/logo_ompzw.png" alt="OMPZW Logo" style={{width: '100%', height: 'auto'}} />
                </div>
            )}
        </div>
    );
};
