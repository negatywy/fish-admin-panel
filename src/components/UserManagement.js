import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { auth } from "../config/firebase";

const associationOptions = [
  {
    id: "GMUe0Hd56WJ7U0HQ3qpa",
    name: "Okręg Mazowiecki Polskiego Związku Wędkarskiego w Warszawie",
    prefix: "MAZSSR_"
  },
  {
    id: "hpAlqBYPhqCdlSJVc9RG",
    name: "Okręg PZW w Tarnobrzegu",
    prefix: "TBGSSR_"
  }
];

const CreateUser = () => {
    const [count, setCount] = useState("");
    const [association, setAssociation] = useState(associationOptions[0].id);
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        setStatus("");

        if (!count || isNaN(count) || parseInt(count, 10) <= 0) {
            setStatus("Podaj poprawną liczbę użytkowników do utworzenia.");
            return;
        }

        setLoading(true);

        const assocObj = associationOptions.find(opt => opt.id === association);
        const associationName = assocObj ? assocObj.name : "";
        const associationId = assocObj ? assocObj.id : "";

        try {
            const apiUrl = process.env.REACT_APP_API_URL;

            const res = await fetch(`${apiUrl}/create-users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    count: parseInt(count, 10),
                    appVersion: "1.0.0",
                    associationId,
                    associationName
                }),
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Błąd backendu");
            }

            // Save log in Firestore
            const adminEmail = auth.currentUser?.email || "brak";
            for (const user of data.users) {
                if (user.skipped) {
                    console.warn(`⚠️ Pominięto duplikat: ${user.email}`);
                    continue;
                }
                await setDoc(doc(collection(db, "user_mngmnt_logs")), {
                    date: serverTimestamp(),
                    action: "create",
                    admin: adminEmail,
                    user: user.email
                });
            }

            // Build status message
            const successMsgs = data.users
                .filter(u => !u.skipped && !u.error)
                .map(u => `✅ ${u.email}, hasło: ${u.password}`);

            const skippedMsgs = data.users
                .filter(u => u.skipped)
                .map(u => `⚠️ Duplikat pominięty: ${u.email}`);

            const errorMsgs = data.users
                .filter(u => u.error)
                .map(u => `❌ Błąd przy ${u.email}: ${u.error}`);

            setStatus([...successMsgs, ...skippedMsgs, ...errorMsgs].join("\n"));
            setCount("");
            setAssociation(associationOptions[0].id);

        } catch (err) {
            console.error(err);
            setStatus("❌ Błąd podczas dodawania użytkowników.");
        }

        setLoading(false);
    };

    return (
        <div>
            <h2>Tworzenie nowych użytkowników</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label>
                    Liczba użytkowników:
                    <input
                        type="number"
                        min="1"
                        value={count}
                        onChange={e => setCount(e.target.value)}
                        disabled={loading}
                        style={{ marginLeft: 8, width: 150 }}
                    />
                </label>
                <label>
                    Okręg:
                    <select
                        value={association}
                        onChange={e => setAssociation(e.target.value)}
                        disabled={loading}
                        style={{ marginLeft: 8, width: 420 }}
                    >
                        {associationOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                    </select>
                </label>
                <button
                    className="default-btn"
                    type="submit"
                    disabled={loading}
                    style={{ marginTop: 8, width: 480 }}
                >
                    Dodaj użytkowników
                </button>
            </form>
            {loading && <div style={{ color: "#246928", marginTop: 8 }}>Dodawanie użytkowników...</div>}
            {status && <pre style={{ color: status.includes("✅") ? "green" : "red", marginTop: 8, whiteSpace: "pre-wrap" }}>
                {status}
            </pre>}
        </div>
    );
};

const DeleteUser = () => {
    const [login, setLogin] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [deletePrefix, setDeletePrefix] = useState("MAZSSR_"); // default

    const handleDelete = async () => {
        setStatus("");
        if (!login) {
            setStatus("Podaj login/y użytkownika.");
            return;
        }

        setLoading(true);

        const password = window.prompt("Aby usunąć użytkowników, wpisz hasło bezpieczeństwa:");
        if (password !== "DeleteIt") {
            setStatus("Niepoprawne hasło. Operacja anulowana.");
            setLoading(false);
            return;
        }

        try {
            // Parse input: ranges, comma-separated, or single
            const parts = login.split(",").map(p => p.trim());
            let emails = [];

            for (const part of parts) {
                if (part.includes("-")) {
                    const [start, end] = part.split("-").map(p => p.trim());
                    const startNum = parseInt(start, 10);
                    const endNum = parseInt(end, 10);

                    for (let i = startNum; i <= endNum; i++) {
                        const width = start.length; // preserve padding
                        emails.push(`${deletePrefix}${String(i).padStart(width, "0")}@ranger.pl`);
                    }
                } else {
                    // 🔹 Use input as-is
                    emails.push(`${deletePrefix}${part}@ranger.pl`);
                }
            }

            const confirm = window.confirm(`Czy na pewno chcesz usunąć użytkowników:\n${emails.join("\n")}?`);
            if (!confirm) {
                setStatus("Usuwanie anulowane.");
                setLoading(false);
                return;
            }

            const apiUrl = process.env.REACT_APP_API_URL;
            const res = await fetch(`${apiUrl}/delete-users`, { // 🔹 call batch route
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emails }),
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Błąd backendu");
            }

            // Save logs for each user
            const adminEmail = auth.currentUser?.email || "brak";
            for (const result of data.results) {
                await setDoc(doc(collection(db, "user_mngmnt_logs")), {
                    date: serverTimestamp(),
                    action: "delete",
                    admin: adminEmail,
                    user: result.email,
                    success: result.success
                });
            }

            // Build status message
            const successMsgs = data.results.filter(r => r.success).map(r => `✅ ${r.email}`);
            const failMsgs = data.results.filter(r => !r.success).map(r => `❌ ${r.email}: ${r.message}`);

            setStatus([...successMsgs, ...failMsgs].join("\n"));

        } catch (err) {
            console.error(err);
            setStatus("❌ Błąd podczas usuwania użytkowników.");
        }

        setLoading(false);
        };

    return (
        <div>
            <h2>Usuwanie użytkownika</h2>
            <div style={{ marginBottom: 10 }}>
                <p><label style={{ marginRight: 7 }}>Prefiks:</label>
                <select
                    value={deletePrefix}
                    onChange={(e) => setDeletePrefix(e.target.value)}
                >
                    {associationOptions.map(opt => (
                        <option key={opt.id} value={opt.prefix}>{opt.prefix}</option>
                    ))}
                </select></p>
                <p><label style={{ marginRight: 7 }}>Loginy do usunięcia (np. 0001, 0002-0005):</label>
                <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="np. 0001, 0002-0005"
                /></p>
                <button
                    className="default-btn"
                    onClick={handleDelete}
                    style={{ width: 480 }}
                    disabled={loading}
                >
                    Usuń użytkowników
                </button>
            </div>
            {loading && <div style={{ color: "#246928", marginBottom: 8 }}>Wyszukiwanie użytkownika...</div>}
            {status && <div style={{ color: status.includes("✅") ? "green" : "red" }}>{status}</div>}
        </div>
    );
};

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
