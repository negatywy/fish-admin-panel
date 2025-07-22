import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";

const CreateUser = () => (
    <div>
        <h2>Tworzenie nowego użytkownika</h2>
        <p>Formularz do tworzenia użytkownika...</p>
    </div>
);

const DeleteUser = () => (
    <div>
        <h2>Usuwanie użytkownika</h2>
        <p>Formularz do usuwania użytkownika...</p>
    </div>
);

const UserLogs = () => {
    const [logs, setLogs] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLogs = async () => {
            setError(null);
            try {
                const querySnapshot = await getDocs(collection(db, "user_mngmnt_logs"));
                const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort by timestamp descending if available
                items.sort((a, b) => (b.date?.toDate?.() || 0) - (a.date?.toDate?.() || 0));
                setLogs(items);
            } catch (err) {
                setError("Błąd pobierania logów użytkowników");
            }
            setLoading(false);
        };
        fetchLogs();
    }, []);

    useEffect(() => {
        const updateRowsPerPage = () => {
            const tableHeight = window.innerHeight - 300;
            const rowHeight = 40;
            setRowsPerPage(Math.max(1, Math.floor(tableHeight / rowHeight)));
        };
        updateRowsPerPage();
        window.addEventListener("resize", updateRowsPerPage);
        return () => window.removeEventListener("resize", updateRowsPerPage);
    }, []);

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = logs.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(logs.length / rowsPerPage);

    if (loading) return <p>Ładowanie logów...</p>;
    if (error) return <p style={{color: 'red'}}>{error}</p>;

    return (
        <div>
            <h2>Logi użytkowników</h2>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Akcja</th>
                            <th>Admin</th>
                            <th>Użytkownik</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map(log => (
                            <tr key={log.id}>
                                <td>{log.date?.toDate ? log.date.toDate().toLocaleString() : "Brak"}</td>
                                <td>{log.action || "-"}</td>
                                <td>{log.admin || "-"}</td>
                                <td>{log.user || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="pagination" style={{ marginTop: "5px" }}>
                    <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Poprzednia</button>
                    <span>Strona {currentPage} z {totalPages}</span>
                    <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Następna</button>
                </div>
            </div>
        </div>
    );
};

const UserManagement = () => {
    const [view, setView] = useState("none");
    return (
        <div className="user-management">
            <h1>Zarządzanie użytkownikami</h1>
            <div style={{ marginBottom: 20 }}>
                <button className="default-btn" onClick={() => setView("create")}>Utwórz nowego użytkownika</button>{" "}
                <button className="default-btn" onClick={() => setView("delete")}>Usuń użytkownika</button>{" "}
                <button className="default-btn" onClick={() => setView("logs")}>Zobacz logi</button>
            </div>
            {view === "create" && <CreateUser />}
            {view === "delete" && <DeleteUser />}
            {view === "logs" && <UserLogs />}
        </div>
    );
};

export default UserManagement;
