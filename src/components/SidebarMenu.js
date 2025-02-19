import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";

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
            <button onClick={() => setActiveComponent("dataTable")}>Historia kontroli</button>
            <button onClick={() => setActiveComponent("statsCharts")}>Wykresy statystyk</button>
            <button onClick={() => setActiveComponent("controlMap")}>Mapa kontroli</button>
        </div>
    );
};
