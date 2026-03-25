import React, { useState, useEffect } from "react";
import { useFilters } from "../context/FilterContext";
import { collection, getDocs } from "firebase/firestore";
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

const CreateUser = ({ onOperationComplete }) => {
    const [emailNo, setEmailNo] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [association, setAssociation] = useState(associationOptions[0].id);
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [nextAvailable, setNextAvailable] = useState("");
    const [fetchingNext, setFetchingNext] = useState(false);
    const [userCount, setUserCount] = useState("1");
    const [createdUsers, setCreatedUsers] = useState([]);

    // Fetch next available login number when association changes
    useEffect(() => {
        const fetchNextAvailable = async () => {
            setFetchingNext(true);
            try {
                const assocObj = associationOptions.find(opt => opt.id === association);
                const prefix = assocObj ? assocObj.prefix : "TEST_";
                
                console.log(`🔍 Fetching users for prefix: ${prefix}`);
                
                // Query users collection for this association
                const usersSnapshot = await getDocs(collection(db, "users"));
                
                console.log(`📊 Total users in database: ${usersSnapshot.size}`);
                
                let maxNumber = 0;
                const domain = "@ranger.pl";
                const lowerDomain = domain.toLowerCase();
                const lowerPrefix = prefix.toLowerCase(); // Firebase Auth stores emails as lowercase
                let matchCount = 0;
                
                const foundNumbers = []; // Track all numbers for debugging
                
                usersSnapshot.forEach((doc) => {
                    const userData = doc.data();
                    const email = userData.email;
                    
                    // Debug specific emails
                    if (email && (email.includes('0353') || email.includes('0354'))) {
                        console.log(`🔍 Checking ${email}:`);
                        console.log(`   → Lowercase: ${email.toLowerCase()}`);
                        console.log(`   → Starts with '${lowerPrefix}': ${email.toLowerCase().startsWith(lowerPrefix)}`);
                    }
                    
                    if (email && email.toLowerCase().startsWith(lowerPrefix)) {
                        matchCount++;
                        // Extract number from email like "mazssr_0353@ranger.pl"
                        // Remove prefix and domain to get just the number
                        const lowerEmail = email.toLowerCase();
                        const emailPart = lowerEmail.replace(lowerPrefix, "").replace(lowerDomain, "");
                        const num = parseInt(emailPart, 10);
                        if (!isNaN(num)) {
                            foundNumbers.push({ email: email, number: num });
                            if (num > maxNumber) {
                                maxNumber = num;
                            }
                        }
                    }
                });
                
                // Sort and show top 10 to debug the missing 353/354
                const topNumbers = foundNumbers
                    .sort((a, b) => b.number - a.number)
                    .slice(0, 10);
                console.log(`✅ Matches for ${prefix}: ${matchCount}, Max number: ${maxNumber}`);
                console.log(`📊 Top 10 highest numbers:`, topNumbers);
                
                const next = (maxNumber + 1).toString().padStart(4, '0');
                console.log(`➡️  Next available: ${next}`);
                setNextAvailable(next);
                setEmailNo(next); // Set as default value
            } catch (error) {
                console.error("Error fetching next available login:", error);
                setNextAvailable("");
            } finally {
                setFetchingNext(false);
            }
        };

        fetchNextAvailable();
    }, [association]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setStatus("");
        setCreatedUsers([]);

        if (!emailNo) {
            setStatus("Podaj nr lub zakres loginów użytkowników.");
            return;
        }

        setLoading(true);

        const apiUrl = process.env.REACT_APP_API_URL;
        const assocObj = associationOptions.find(opt => opt.id === association);
        const associationName = assocObj ? assocObj.name : "";
        const associationId = assocObj ? assocObj.id : "";
        const basePattern = assocObj ? assocObj.prefix : "TEST_";

        try {
            // multiple users support
            let emailIds = [];
            if (emailNo.includes("-")) {
                // preserve leading zeros
                const [start, end] = emailNo.split("-").map(n => n.trim());
                const startNum = parseInt(start, 10);
                const endNum = parseInt(end, 10);
                const padLength = start.length; 

                emailIds = Array.from({ length: endNum - startNum + 1 }, (_, i) =>
                    String(startNum + i).padStart(padLength, "0")
                );
            } else if (emailNo.includes(",")) {
                emailIds = emailNo.split(",").map(n => n.trim());
            } else {
                const count = parseInt(userCount, 10);
                if (!isNaN(count) && count > 1) {
                    const startNum = parseInt(emailNo, 10);
                    if (isNaN(startNum)) {
                        setStatus("Nieprawidłowy numer startowy.");
                        setLoading(false);
                        return;
                    }
                    const padLength = emailNo.length;
                    emailIds = Array.from({ length: count }, (_, i) =>
                        String(startNum + i).padStart(padLength, "0")
                    );
                } else {
                    emailIds = [emailNo];
                }
            }

            const res = await fetch(`${apiUrl}/create-users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    basePattern,
                    emailIds,
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
                const action = user.repaired ? "repair" : "create";
                if (apiUrl) {
                    await fetch(`${apiUrl}/log-admin-action`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: action,
                            admin: adminEmail,
                            user: user.email
                        })
                    });
                }
            }

            // Build status message
            const successMsgs = data.users
                .filter(u => !u.skipped && !u.error && !u.repaired)
                .map(u => `✅ ${u.email}, hasło: ${u.password}`);

            const repairedMsgs = data.users
                .filter(u => u.repaired)
                .map(u => `🔧 ${u.email} naprawiony (istniał w Auth ale nie w bazie)`);

            const skippedMsgs = data.users
                .filter(u => u.skipped)
                .map(u => `⚠️ Duplikat pominięty: ${u.email}`);

            const errorMsgs = data.users
                .filter(u => u.error)
                .map(u => `❌ Błąd przy ${u.email}: ${u.error}`);

            setStatus([...successMsgs, ...repairedMsgs, ...skippedMsgs, ...errorMsgs].join("\n"));
            setDisplayName("");
            setCreatedUsers(
                data.users
                    .filter(u => !u.skipped && !u.error)
                    .map(u => ({ email: u.email, password: u.password || "" }))
            );
            
            // Trigger log refresh
            if (onOperationComplete) {
                onOperationComplete();
            }
            
            // Calculate next available number based on what was just created
            // Extract the highest number from successfully created users
            let maxCreated = 0;
            
            // Check what numbers were just used in this creation
            emailIds.forEach(id => {
                const num = parseInt(id, 10);
                if (!isNaN(num) && num > maxCreated) {
                    maxCreated = num;
                }
            });
            
            // Set next available to the highest created + 1
            if (maxCreated > 0) {
                const next = (maxCreated + 1).toString().padStart(4, '0');
                setNextAvailable(next);
                setEmailNo(next);
            }

        } catch (err) {
            console.error(err);
            setStatus("❌ Błąd podczas dodawania użytkowników.");
        }

        setLoading(false);
    };

    const downloadCreatedUsersCSV = async () => {
        if (createdUsers.length === 0) {
            alert("Brak nowych użytkowników do pobrania.");
            return;
        }

        const adminEmail = auth.currentUser?.email || "brak";
        const adminPrefix = adminEmail.split("@")[0] || "admin";
        const dateStamp = new Date().toISOString().slice(0, 10);
        const fileName = `dodani${adminPrefix}${dateStamp}.csv`;

        const csvData = createdUsers.map(user => ({
            "Email": user.email,
            "Hasło": user.password
        }));

        const Papa = await import("papaparse");
        const csv = Papa.unparse(csvData, { delimiter: ";" });
        const utf8BOM = "\uFEFF" + csv;
        const blob = new Blob([utf8BOM], { type: "text/csv;charset=utf-8;" });
        const fileSaver = await import("file-saver");
        const saveAs = fileSaver.saveAs || fileSaver.default;
        saveAs(blob, fileName);

        const apiUrl = process.env.REACT_APP_API_URL;
        if (apiUrl) {
            await fetch(`${apiUrl}/log-admin-action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "download_csv",
                    admin: adminEmail,
                    user: `plik:${fileName} liczba:${createdUsers.length}`
                })
            });
        }

        if (onOperationComplete) {
            onOperationComplete();
        }
    };

    return (
        <div>
            <h2>Tworzenie nowego użytkownika</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12}}>
                <label>
                    Okręg:
                    <select value={association} onChange={e => setAssociation(e.target.value)} disabled={loading} 
                            style={{marginLeft: 8, width: 420}}>
                        {associationOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Login nr: 
                    {fetchingNext && <span style={{marginLeft: 8, color: "#666", fontSize: 14}}>(sprawdzanie...)</span>}
                    {!fetchingNext && nextAvailable && (
                        <span style={{marginLeft: 8, color: "#246928", fontSize: 14, fontWeight: 600}}>
                            (następny dostępny: {nextAvailable})
                        </span>
                    )}
                        <input
                            type="text"
                            value={emailNo}
                            onChange={e => setEmailNo(e.target.value)}
                            disabled={loading || fetchingNext}
                            placeholder={nextAvailable}
                            style={{marginLeft: 8, width: 150}}
                        />
                </label>
                <label>
                    Ilość kont:
                    <input
                        type="number"
                        min="1"
                        value={userCount}
                        onChange={e => setUserCount(e.target.value)}
                        disabled={loading}
                        style={{ marginLeft: 8, width: 80 }}
                    />
                </label>
                <label>
                    Imię i nazwisko:
                    <input
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        disabled={loading}
                        style={{marginLeft: 8, width: 250}}
                    />
                </label>
                <button className="default-btn" type="submit" disabled={loading} 
                            style={{marginTop: 8, width: 480}}>Dodaj użytkownika</button>
            </form>
            {loading && (
                <div className="spinner" style={{flexDirection: 'column'}}>
                    <div className="spinner-circle"></div>
                    <div style={{marginTop: 16, color: "#246928", fontWeight: 600, fontSize: 18}}>ładowanie...</div>
                </div>
            )}
            {status && (
                <div style={{ marginTop: 16 }}>
                    {status.includes("✅") && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 18, fontWeight: 600, color: "#246928", marginBottom: 8 }}>Dodano:</div>
                            <div style={{ 
                                fontSize: 16, 
                                color: "green", 
                                backgroundColor: "#f0f8f0", 
                                padding: 12, 
                                borderRadius: 4,
                                border: "1px solid #c3e6cb",
                                whiteSpace: "pre-wrap",
                                fontFamily: "monospace"
                            }}>{status}</div>
                            <button 
                                className="default-btn" 
                                onClick={() => {
                                    navigator.clipboard.writeText(status);
                                    alert("Skopiowano do schowka!");
                                }}
                                style={{ marginTop: 8 }}
                            >
                                📋 Kopiuj do schowka
                            </button>
                            <button
                                className="default-btn"
                                onClick={downloadCreatedUsersCSV}
                                style={{ marginTop: 8, marginLeft: 8 }}
                            >
                                📄 Pobierz CSV
                            </button>
                        </div>
                    )}
                    {!status.includes("✅") && (
                        <div style={{ color: "red", marginTop: 8, fontSize: 16 }}>{status}</div>
                    )}
                </div>
            )}
        </div>
    );
};

const DeleteUser = ({ onOperationComplete }) => {
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
                if (apiUrl) {
                    await fetch(`${apiUrl}/log-admin-action`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "delete",
                            admin: adminEmail,
                            user: result.email
                        })
                    });
                }
            }

            // Build status message
            const successMsgs = data.results.filter(r => r.success).map(r => `✅ ${r.email}`);
            const failMsgs = data.results.filter(r => !r.success).map(r => `❌ ${r.email}: ${r.message}`);

            setStatus([...successMsgs, ...failMsgs].join("\n"));
            
            // Trigger log refresh
            if (onOperationComplete) {
                onOperationComplete();
            }

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
            {loading && (
                <div className="spinner">
                    <div className="spinner-circle"></div>
                    <div style={{marginLeft: 16, color: "#246928"}}>ładowanie...</div>
                </div>
            )}
            {status && (
                <div style={{ marginTop: 16 }}>
                    {status.includes("✅") && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 18, fontWeight: 600, color: "#d32f2f", marginBottom: 8 }}>Usunięto:</div>
                            <div style={{ 
                                fontSize: 16, 
                                color: status.includes("❌") ? "#d32f2f" : "green", 
                                backgroundColor: status.includes("❌") ? "#ffebee" : "#f0f8f0", 
                                padding: 12, 
                                borderRadius: 4,
                                border: status.includes("❌") ? "1px solid #ef9a9a" : "1px solid #c3e6cb",
                                whiteSpace: "pre-wrap",
                                fontFamily: "monospace"
                            }}>{status}</div>
                            <button 
                                className="default-btn" 
                                onClick={() => {
                                    navigator.clipboard.writeText(status);
                                    alert("Skopiowano do schowka!");
                                }}
                                style={{ marginTop: 8 }}
                            >
                                📋 Kopiuj do schowka
                            </button>
                        </div>
                    )}
                    {!status.includes("✅") && (
                        <div style={{ color: "red", marginTop: 8, fontSize: 16 }}>{status}</div>
                    )}
                </div>
            )}
        </div>
    );
};

const UserLogs = ({ refreshTrigger }) => {
    const [logs, setLogs] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [error, setError] = useState(null);
    const { dateFilter, setDateFilter, customStartDate, setCustomStartDate } = useFilters();
    const [actionFilter, setActionFilter] = useState("");
    const [adminFilter, setAdminFilter] = useState("");
    const [userFilter, setUserFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const currentAdminEmail = auth.currentUser?.email || "";
    const isOmpzwAdmin = currentAdminEmail === "admin.ompzw@naturai.pl";

    useEffect(() => {
        const fetchLogs = async () => {
            setError(null);
            setLoading(true);
            try {
                const querySnapshot = await getDocs(collection(db, "user_mngmnt_logs"));
                const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                items.sort((a, b) => (b.date?.toDate?.() || 0) - (a.date?.toDate?.() || 0));
                setLogs(items);
            } catch (err) {
                setError("Błąd pobierania logów użytkowników");
            }
            setLoading(false);
        };
        fetchLogs();
    }, [refreshTrigger]);

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
        const logDate = log.date?.toDate ? log.date.toDate() : null;
        if (!logDate) return false;
        if (!isOmpzwAdmin) {
            match = match && (log.admin || "") === currentAdminEmail;
        }
        const now = new Date();
        let cutoffDate = new Date();
        let endDate;
        if (dateFilter === "lastWeek") {
            cutoffDate.setDate(now.getDate() - 7);
        } else if (dateFilter === "currentMonth") {
            cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (dateFilter === "previousMonth") {
            cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (dateFilter === "currentYear") {
            cutoffDate = new Date(now.getFullYear(), 0, 1);
        } else if (dateFilter === "previousYear") {
            cutoffDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31);
        } else if (dateFilter === "custom") {
            if (customStartDate) {
                cutoffDate = new Date(customStartDate);
                cutoffDate.setHours(0, 0, 0, 0);
                endDate = new Date(customStartDate);
                endDate.setHours(23, 59, 59, 999);
            }
        }
        if ((dateFilter === "previousMonth" || dateFilter === "previousYear" || dateFilter === "custom") && endDate) {
            match = match && logDate >= cutoffDate && logDate <= endDate;
        } else {
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
        const actionTranslations = {
            "delete": "usuń",
            "create": "utwórz",
            "repair": "naprawa",
            "download_csv": "pobierz csv",
            "download_csv_controls": "pobierz csv kontrole",
            "download_csv_ranger_stats": "pobierz csv statystyki"
        };
        const csvData = filteredLogs.map(log => ({
            "Data": log.date?.toDate ? log.date.toDate().toLocaleString("pl-PL", { day: "numeric", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Brak",
            "Akcja": actionTranslations[log.action] || log.action || "-",
            "Admin": log.admin || "-",
            "Użytkownik": log.user || "-",
            "IP": log.ip || "-"
        }));
        import("papaparse").then(Papa => {
            const csv = Papa.unparse(csvData, { delimiter: ";" });
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

    // Helper function to translate and style action text
    const formatAction = (action) => {
        const actionTranslations = {
            "delete": "usuń",
            "create": "utwórz",
            "repair": "naprawa",
            "download_csv": "pobierz csv",
            "download_csv_controls": "pobierz csv kontrole",
            "download_csv_ranger_stats": "pobierz csv statystyki"
        };
        const translatedAction = actionTranslations[action] || action || "-";
        const isDelete = action === "delete";
        
        return (
            <span style={{ color: isDelete ? '#dc3545' : 'inherit', fontWeight: isDelete ? '600' : 'normal' }}>
                {translatedAction}
            </span>
        );
    };


    if (loading) {
        return (
            <div className="spinner" style={{flexDirection: 'column'}}>
                <div className="spinner-circle"></div>
                <div style={{marginTop: 16, color: "#246928", fontWeight: 600, fontSize: 18}}>ładowanie...</div>
            </div>
        );
    }
    if (error) return <p style={{color: 'red'}}>{error}</p>;

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label>Według daty: </label>
                    <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ minWidth: 140 }}>
                        <option value="previousYear">Poprzedni rok</option>
                        <option value="lastWeek">Ostatni tydzień</option>
                        <option value="currentMonth">Bieżący miesiąc</option>
                        <option value="previousMonth">Poprzedni miesiąc</option>
                        <option value="currentYear">Bieżący rok</option>
                        <option value="custom">Wybierz dzień</option>
                    </select>
                    {dateFilter === 'custom' && (
                        <>
                            <label>Data: </label>
                            <input 
                                type="date" 
                                value={customStartDate} 
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                            />
                        </>
                    )}
                    {dateFilter === 'custom' && customStartDate === new Date().toISOString().slice(0, 10) && (
                        <button onClick={() => {
                            setLoading(true);
                            (async () => {
                                try {
                                    const querySnapshot = await getDocs(collection(db, "user_mngmnt_logs"));
                                    const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                                    items.sort((a, b) => (b.date?.toDate?.() || 0) - (a.date?.toDate?.() || 0));
                                    setLogs(items);
                                } catch (err) {
                                    setError("Błąd pobierania logów użytkowników");
                                }
                                setLoading(false);
                            })();
                        }} className="default-btn" style={{ marginLeft: 8 }}>Odśwież</button>
                    )}
                    <label>Typ akcji: </label>
                    <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ minWidth: 100 }}>
                        <option value="">Wszystkie</option>
                        <option value="delete">Usuń</option>
                        <option value="create">Utwórz</option>
                        <option value="repair">Naprawa</option>
                        <option value="download_csv">Pobierz CSV</option>
                        <option value="download_csv_controls">Pobierz CSV kontrole</option>
                        <option value="download_csv_ranger_stats">Pobierz CSV statystyki</option>
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
                            <th>IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map(log => (
                            <tr key={log.id}>
                                <td>{log.date?.toDate ? log.date.toDate().toLocaleString("pl-PL", { day: "numeric", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Brak"}</td>
                                <td>{formatAction(log.action)}</td>
                                <td>{log.admin || "-"}</td>
                                <td>{log.user || "-"}</td>
                                <td>{log.ip || "-"}</td>
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
    const [logRefreshTrigger, setLogRefreshTrigger] = useState(0);
    
    const refreshLogs = () => {
        setLogRefreshTrigger(prev => prev + 1);
    };

    const currentUserEmail = auth.currentUser?.email;
    const isOmpzwAdmin = currentUserEmail === "admin.ompzw@naturai.pl";
    
    return (
        <div className="user-management">
            <h1>Zarządzanie użytkownikami</h1>
            <div style={{ marginBottom: 20 }}>
                {isOmpzwAdmin && (
                    <>
                        <button className="default-btn" onClick={() => setView("create")}>Utwórz nowego użytkownika</button>{" "}
                        <button className="default-btn" onClick={() => setView("delete")}>Usuń użytkownika</button>{" "}
                        {view === "create" && <CreateUser onOperationComplete={refreshLogs} />}
                        {view === "delete" && <DeleteUser onOperationComplete={refreshLogs} />}
                    </>
                )}
                <h2 style={{ marginTop: 32, marginBottom: 16 }}>Dziennik zarządzania użytkownikami</h2>
                <UserLogs refreshTrigger={logRefreshTrigger} />
            </div>
        </div>
    );
};

export default UserManagement;
