import { useState, useEffect } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { auth } from "../config/firebase";
import { associationOptions } from "./CreateUsers";

export const DeleteUser = () => {
    const [login, setLogin] = useState("");
    const [status, setStatus] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deletePrefix, setDeletePrefix] = useState("");
    const [availableAssociations, setAvailableAssociations] = useState([]);

    useEffect(() => {
        const user = auth.currentUser;
        let allowedOptions = [];

        switch (user?.email) {
            case "admin.ompzw@naturai.pl":
                allowedOptions = associationOptions;
                break;
            case "admin.tbga@naturai.pl":
                allowedOptions = associationOptions.filter(opt => 
                    opt.name === "Okręg PZW w Tarnobrzegu"
                );
                break;
            default:
                allowedOptions = [];
                break;
        }

        setAvailableAssociations(allowedOptions);
        if (allowedOptions.length > 0) {
            setDeletePrefix(allowedOptions[0].prefix); // set default
        }
    }, []);

    const handleDelete = async () => {
        setStatus("");
        if (!login) {
            setStatus([{ type: "error", email: "-", message: "Podaj login/y użytkownika." }]);
            return;
        }

        setLoading(true);

        const password = window.prompt("Aby usunąć użytkowników, wpisz hasło bezpieczeństwa:");
        if (password !== "DeleteIt") {
            setStatus([{ type: "error", email: "-", message: "Niepoprawne hasło. Operacja anulowana." }]);
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

            // Build structured status
            const successMsgs = data.results
            .filter(r => r.success)
            .map(r => ({ type: "success", email: r.email }));

            const failMsgs = data.results
            .filter(r => !r.success)
            .map(r => ({ type: "error", email: r.email, message: r.message }));

            setStatus([...successMsgs, ...failMsgs]);
        } catch (err) {
            console.error(err);
            setStatus([{ type: "error", email: "-", message: "❌ Błąd podczas usuwania użytkowników." }]);
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
                    {availableAssociations.map(opt => (
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
            {status.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <h3>Wynik operacji usuwania:</h3>
                    <ul style={{ paddingLeft: 20 }}>
                    {status.map((item, idx) => {
                        if (item.type === "success") {
                        return (
                            <li key={idx} style={{ color: "green" }}>
                            ✅ Usunięto: <strong>{item.email}</strong>
                            </li>
                        );
                        }
                        if (item.type === "error") {
                        return (
                            <li key={idx} style={{ color: "red" }}>
                            ❌ Błąd przy {item.email}: {item.message}
                            </li>
                        );
                        }
                        return null;
                    })}
                    </ul>
                </div>
                )}
        </div>
    );
};