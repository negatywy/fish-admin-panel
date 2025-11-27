import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { useFilters } from "../context/FilterContext";
import { useAuth } from "../context/AuthContext";
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
            <button className="default-btn" onClick={() => handleNavigation("dataTable")}>Historia kontroli</button>
            {/* <button className="default-btn" onClick={() => handleNavigation("statsCharts")}>Wykresy statystyk</button> */}
            <button className="default-btn" onClick={() => handleNavigation("controlMap")}>Mapa kontroli</button>
            <button className="default-btn" onClick={() => handleNavigation("rangerStats")}>Statystyki strażników</button>
            <button disabled={true}>Wykresy statystyk</button>
            <button className="default-btn" onClick={() => handleNavigation("userManagement", "currentMonth")}>Użytkownicy</button>
            <button className="default-btn" onClick={() => handleNavigation("konfigurator")}>Konfigurator</button>
            {isOmpzwAdmin && (
                <div style={{marginTop: 'auto', padding: '16px', textAlign: 'center'}}>
                    <img src="/logo_ompzw.png" alt="OMPZW Logo" style={{maxWidth: '100%', height: 'auto'}} />
                </div>
            )}
        </div>
    );
};
