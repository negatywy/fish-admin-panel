import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { CreateUser, associationOptions } from "./CreateUsers";
import { DeleteUser } from "./DeleteUser";

const UserLogs = () => {
    const [logs, setLogs] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [error, setError] = useState(null);
    const [dateFilter, setDateFilter] = useState("all");
    const [actionFilter, setActionFilter] = useState("");
    const [adminFilter, setAdminFilter] = useState("");
    const [userFilter, setUserFilter] = useState("");

    useEffect(() => {
        const fetchLogs = async () => {
            setError(null);
            try {
                const querySnapshot = await getDocs(collection(db, "user_mngmnt_logs"));
                const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                items.sort((a, b) => (b.date?.toDate?.() || 0) - (a.date?.toDate?.() || 0));
                setLogs(items);
            } catch (err) {
                setError("Błąd pobierania logów użytkowników");
            }
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

    // Filtrowanie logów
    const filteredLogs = logs.filter(log => {
        let match = true;
        if (dateFilter !== "all") {
            const logDate = log.date?.toDate ? log.date.toDate() : null;
            if (!logDate) return false;
            const now = new Date();
            let cutoffDate = new Date();
            if (dateFilter === "lastWeek") {
                cutoffDate.setDate(now.getDate() - 7);
            } else if (dateFilter === "lastMonth") {
                cutoffDate.setMonth(now.getMonth() - 1);
            }
            match = match && logDate >= cutoffDate;
        }
        if (actionFilter) {
            match = match && (log.action || "").toLowerCase() === actionFilter.toLowerCase();
        }
        if (adminFilter) {
            if (adminFilter === "ompzw") {
                match = match && (log.admin || "").includes("ompzw");
            } else if (adminFilter === "tbga") {
                match = match && (log.admin || "").includes("tbga");
            }
        }
        if (userFilter) {
            match = match && (log.user || "").toLowerCase().includes(userFilter.toLowerCase());
        }
        return match;
    });

    const downloadCSV = () => {
        if (filteredLogs.length === 0) {
            alert("Brak logów do pobrania.");
            return;
        }
        const csvData = filteredLogs.map(log => ({
            "Data": log.date?.toDate ? log.date.toDate().toLocaleString() : "Brak",
            "Akcja": log.action || "-",
            "Admin": log.admin || "-",
            "Użytkownik": log.user || "-"
        }));
        import("papaparse").then(Papa => {
            const csv = Papa.unparse(csvData);
            const utf8BOM = "\uFEFF" + csv;
            const blob = new Blob([utf8BOM], { type: "text/csv;charset=utf-8;" });
            import("file-saver").then(module => {
                const saveAs = module.saveAs || module.default;
                saveAs(blob, `user_logs.csv`);
            });
        });
    };

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredLogs.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);

    if (error) return <p style={{color: 'red'}}>{error}</p>;

    return (
        <div>
            <h2>Logi użytkowników</h2>
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label>Według daty: </label>
                    <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ minWidth: 140 }}>
                        <option value="all">Wszystkie</option>
                        <option value="lastWeek">Ostatni tydzień</option>
                        <option value="lastMonth">Ostatni miesiąc</option>
                    </select>
                    <label>Typ akcji: </label>
                    <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ minWidth: 100 }}>
                        <option value="">Wszystkie</option>
                        <option value="delete">Usunięcie</option>
                        <option value="create">Utworzenie</option>
                    </select>
                    <label>Według admina: </label>
                    <select value={adminFilter} onChange={e => setAdminFilter(e.target.value)} style={{ minWidth: 100 }}>
                        <option value="">Wszyscy</option>
                        <option value="ompzw">ompzw</option>
                        <option value="tbga">tbga</option>
                    </select>
                    <label>Według użytkownika: </label>
                    <input
                        type="text"
                        placeholder="Użytkownik"
                        value={userFilter}
                        onChange={e => setUserFilter(e.target.value)}
                        style={{ minWidth: 100 }}
                    />
                    <button className="default-btn" onClick={downloadCSV}>Pobierz CSV</button>
                </div>
            </div>
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
                    <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><FaArrowLeft /></button>
                    <span>Strona {currentPage} z {totalPages}</span>
                    <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}><FaArrowRight /></button>
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
                {view === "create" && <CreateUser />}
                {view === "delete" && <DeleteUser />}
                <UserLogs />
            </div>
        </div>
    );
};

export default UserManagement;
