import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import logo from "../assets/the-fish-green.png";

export const SidebarMenu = ({ setActiveComponent }) => {
    const navigate = useNavigate();

    const logout = async () => {
        try {
            await signOut(auth);
            navigate("/");
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="sidebar">
            <img src={logo} alt="Logo" className="sidebar-logo" />
            <button className="default-btn" onClick={() => setActiveComponent("dataTable")}>Historia kontroli</button>
            {/* <button className="default-btn" onClick={() => setActiveComponent("statsCharts")}>Wykresy statystyk</button> */}
            <button className="default-btn" onClick={() => setActiveComponent("controlMap")}>Mapa kontroli</button>
            <button className="default-btn" onClick={() => setActiveComponent("rangerStats")}>Statystyki strażników</button>
            <button disabled={true}>Wykresy statystyk</button>
            <button disabled={true}>Użytkownicy</button>
        </div>
    );
};
