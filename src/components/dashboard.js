import { auth, db } from "../config/firebase";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import "../style/App.css";
import "../style/table.css";

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
                console.log("Łączenie z Firestore...");
                const querySnapshot = await getDocs(collection(db, "kontrole"));
        
                if (querySnapshot.empty) {
                    console.warn("Firestore zwrócił pustą kolekcję.");
                } else {
                    querySnapshot.forEach((doc) => {
                        console.log("Dokument:", doc.id, "Dane:", doc.data());
                    });
                }
        
                const items = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        data: data.data?.toDate()?.toLocaleString() ?? "Brak daty",
                        kod_grupy: data.kod_grupy ?? "Brak",
                        kolo: data.kolo ?? "Brak",
                        okreg: data.okreg ?? "Brak",
                        powod_odrzucenia: data.powod_odrzucenia ?? "Brak",
                        pozycja: data.pozycja ? `${data.pozycja.latitude}, ${data.pozycja.longitude}` : "Brak pozycji",
                        straznik: data.straznik ?? "Brak",
                        uwagi: data.uwagi ?? "Brak",
                        wynik: data.wynik ?? "Brak",
                        zezwolenie: data.zezwolenie ?? "Brak",
                    };
                });
        
                console.log("Przetworzone dane:", items);
                setData(items);
            } catch (error) {
                console.error("Błąd pobierania danych:", error);
            }
        };
       
                
        fetchData();
    }, []);

    return (
        <div>
            <h2>Lista Danych</h2>
            <div className="table-container">
    <table>
        <thead>
            <tr>
                <th>Data</th>
                <th>Kod Grupy</th>
                <th>Koło</th>
                <th>Okręg</th>
                <th>Powód Odrzucenia</th>
                <th>Pozycja</th>
                <th>Strażnik</th>
                <th>Uwagi</th>
                <th>Wynik</th>
                <th>Zezwolenie</th>
            </tr>
        </thead>
        <tbody>
            {data.map(item => (
                <tr key={item.id}>
                    <td>{item.data}</td>
                    <td>{item.kod_grupy}</td>
                    <td>{item.kolo}</td>
                    <td>{item.okreg}</td>
                    <td>{item.powod_odrzucenia}</td>
                    <td>{item.pozycja}</td>
                    <td>{item.straznik}</td>
                    <td>{item.uwagi}</td>
                    <td>{item.wynik}</td>
                    <td>{item.zezwolenie}</td>
                </tr>
            ))}
        </tbody>
    </table>
</div>


        </div>
    );
};

const OtherComponent = () => {
    return <h2>Inny komponent do wyświetlenia</h2>;
};

