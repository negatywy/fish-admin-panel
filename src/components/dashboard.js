import { auth, db } from "../config/firebase";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import "../App.css";

export const Dashboard = () => {
    const navigate = useNavigate();
    const [activeComponent, setActiveComponent] = useState("dataTable");

    const logout = async () => {
        try {
            await signOut(auth);
            navigate("/");
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (!auth.currentUser) {
            navigate("/");
        }
    }, [navigate]);

    return (
        <div className="dashboard-container">
            {/* Sidebar Menu */}
            <div className="sidebar">
                <button onClick={() => setActiveComponent("dataTable")}>Tabela Danych</button>
                <button onClick={() => setActiveComponent("otherComponent")}>Inny Widok</button>
                <button onClick={logout}>Wyloguj się</button>
            </div>
            
            {/* Main Content */}
            <div className="main-content">
                <h1>Dashboard</h1>
                <p>Użytkownik: {auth?.currentUser?.email}</p>
                {activeComponent === "dataTable" && <DataTable />}
                {activeComponent === "otherComponent" && <OtherComponent />}
            </div>
        </div>
    );
};

const DataTable = () => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "kontrole"));
                const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setData(items);
            } catch (error) {
                console.error("Error fetching data: ", error);
            }
        };
        fetchData();
    }, []);

    return (
        <div>
            <h2>Lista Danych</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nazwa</th>
                        <th>Wartość</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(item => (
                        <tr key={item.id}>
                            <td>{item.id}</td>
                            <td>{item.name}</td>
                            <td>{item.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const OtherComponent = () => {
    return <h2>Inny komponent do wyświetlenia</h2>;
};

