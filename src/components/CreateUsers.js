import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../config/firebase";

export const associationOptions = [
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

export const CreateUser = () => {
    const [count, setCount] = useState("");
    const [association, setAssociation] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
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
            setAssociation(allowedOptions[0].id); // set default
        }
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setStatus("");

        if (!count || isNaN(count) || parseInt(count, 10) <= 0) {
            setStatus("Podaj poprawną liczbę użytkowników do utworzenia.");
            return;
        }

        setLoading(true);

        const assocObj = availableAssociations.find(opt => opt.id === association);
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
                .map(u => ({ type: "success", email: u.email, password: u.password }));

            const skippedMsgs = data.users
                .filter(u => u.skipped)
                .map(u => ({ type: "skipped", email: u.email }));

            const errorMsgs = data.users
                .filter(u => u.error)
                .map(u => ({ type: "error", email: u.email, error: u.error }));

            setStatus([...successMsgs, ...skippedMsgs, ...errorMsgs]);
            setCount("");
            if (availableAssociations.length > 0) {
                setAssociation(availableAssociations[0].id);
            }

        } catch (err) {
            console.error(err);
            setStatus("❌ Błąd podczas dodawania użytkowników.");
        }

        setLoading(false);
    };

    const downloadCSV = () => {
        const successUsers = status.filter(item => item.type === "success");
        if (successUsers.length === 0) return;

        const header = "email,password\n";
        const rows = successUsers
            .map(user => `${user.email},${user.password}`)
            .join("\n");
        const csvContent = header + rows;

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "users.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <h2>Tworzenie nowych użytkowników</h2>
            {availableAssociations.length === 0 ? (
                <p style={{ color: "red" }}>Nie masz uprawnień do tworzenia użytkowników.</p>
            ) : (
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
                            {availableAssociations.map(opt => (
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
            )}
            {loading && <div style={{ color: "#246928", marginTop: 8 }}>Dodawanie użytkowników...</div>}
            {status.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <h3>Lista utworzonych użytkowników:</h3>
                    <ul style={{ paddingLeft: 20 }}>
                    {status.map((item, idx) => {
                        if (item.type === "success") {
                        return (
                            <li key={idx} style={{ color: "green" }}>
                            login: <strong>{item.email}</strong>, hasło: <strong>{item.password}</strong>
                            </li>
                        );
                        }
                        if (item.type === "skipped") {
                        return (
                            <li key={idx} style={{ color: "orange" }}>
                            ⚠️ Duplikat pominięty: {item.email}
                            </li>
                        );
                        }
                        if (item.type === "error") {
                        return (
                            <li key={idx} style={{ color: "red" }}>
                            ❌ Błąd przy {item.email}: {item.error}
                            </li>
                        );
                        }
                        return null;
                    })}
                    </ul>
                    {status.some(item => item.type === "success") && (<button onClick={downloadCSV} className="default-btn">Pobierz CSV</button>)}
                </div>
                )}
        </div>
    );
};
