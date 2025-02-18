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
            <button onClick={() => setActiveComponent("dataTable")}>Tabela Danych</button>
            <button onClick={() => setActiveComponent("otherComponent")}>Inny Widok</button>
            <button onClick={logout}>Wyloguj się</button>
        </div>
    );
};
