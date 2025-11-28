import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import "../style/App.css";

export const Konfigurator = () => {
    const [reasons, setReasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [newReason, setNewReason] = useState("");
    const [adding, setAdding] = useState(false);
    const [selectedReason, setSelectedReason] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchReasons = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            let regionName = "all";
            
            switch (user?.email) {
                case "admin.ompzw@naturai.pl":
                    regionName = "Okręg Mazowiecki Polskiego Związku Wędkarskiego w Warszawie";
                    break;
                case "admin.tbga@naturai.pl":
                    regionName = "Okręg PZW w Tarnobrzegu";
                    break;
                default:
                    regionName = "all";
                    break;
            }

            const reasonsRef = collection(db, "possible_control_rejections");
            const querySnapshot = await getDocs(reasonsRef);
            
            console.log("Total documents found:", querySnapshot.docs.length);
            
            const reasonsList = [];
            querySnapshot.docs.forEach(doc => {
                const data = doc.data();
                console.log("Document ID:", doc.id, "Data:", data);
                
                const associationName = data.association_name || "Brak";
                
                // If reasons field is an array, expand each reason into a separate row
                if (Array.isArray(data.reasons)) {
                    console.log("Found reasons array with", data.reasons.length, "items");
                    data.reasons.forEach((reason, idx) => {
                        reasonsList.push({
                            id: `${doc.id}_${idx}`,
                            reason: reason,
                            association_name: associationName
                        });
                    });
                } else if (data.reasons) {
                    // If reasons is a single value
                    console.log("Found single reason:", data.reasons);
                    reasonsList.push({
                        id: doc.id,
                        reason: data.reasons,
                        association_name: associationName
                    });
                }
            });
            
            console.log("Total reasons in list:", reasonsList.length);

            // Filter by region if not "all"
            // If a reason has no association_name or is "Brak", show it for all regions
            const filteredReasons = regionName === "all" 
                ? reasonsList 
                : reasonsList.filter(item => 
                    !item.association_name || 
                    item.association_name === "Brak" || 
                    item.association_name === regionName
                );

            setReasons(filteredReasons);
        } catch (error) {
            console.error("Błąd pobierania powodów:", error);
        }
        setLoading(false);
    };

    const hashPassword = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    };

    const addNewReason = async () => {
        if (!newReason.trim()) {
            alert("Proszę wpisać powód");
            return;
        }

        // Ask for password
        const password = prompt("Wprowadź hasło autoryzacyjne:");
        if (!password) {
            return;
        }

        setAdding(true);
        try {
            // Verify password hash
            const passwordHash = await hashPassword(password);
            if (passwordHash !== 'd81560b1f1b7c6ae4d607fde83bb810d1ed6c77c63fc35ac5469be95a6339d28') {
                alert("Nieprawidłowe hasło");
                setAdding(false);
                return;
            }

            // Update the document with ID "reasons" in the possible_control_rejections collection
            const reasonsDocRef = doc(db, "possible_control_rejections", "reasons");
            await updateDoc(reasonsDocRef, {
                reasons: arrayUnion(newReason.trim())
            });

            setNewReason("");
            await fetchReasons(); // Refresh the list
            alert("Rodzaj dodany pomyślnie");
        } catch (error) {
            console.error("Błąd dodawania rodzaju wykroczenia:", error);
            alert("Błąd dodawania rodzaju wykroczenia: " + error.message);
        }
        setAdding(false);
    };

    const deleteReason = async (reasonToDelete) => {
        if (!reasonToDelete) {
            alert("Proszę wybrać rodzaj wykroczenia do usunięcia");
            return;
        }

        // Confirm deletion
        if (!window.confirm(`Czy na pewno chcesz usunąć rodzaj wykroczenia: "${reasonToDelete}"?`)) {
            return;
        }

        // Ask for password
        const password = prompt("Wprowadź hasło autoryzacyjne:");
        if (!password) {
            return;
        }

        setDeleting(true);
        try {
            // Verify password hash
            const passwordHash = await hashPassword(password);
            if (passwordHash !== 'd81560b1f1b7c6ae4d607fde83bb810d1ed6c77c63fc35ac5469be95a6339d28') {
                alert("Nieprawidłowe hasło");
                setDeleting(false);
                return;
            }

            // Remove the reason from the array in Firestore
            const reasonsDocRef = doc(db, "possible_control_rejections", "reasons");
            await updateDoc(reasonsDocRef, {
                reasons: arrayRemove(reasonToDelete)
            });

            setSelectedReason(null);
            await fetchReasons(); // Refresh the list
            alert("Rodzaj usunięty pomyślnie");
        } catch (error) {
            console.error("Błąd usuwania powodu:", error);
            alert("Błąd usuwania powodu: " + error.message);
        }
        setDeleting(false);
    };

    useEffect(() => {
        fetchReasons();
    }, []);

    useEffect(() => {
        const updateRowsPerPage = () => {
            const tableHeight = window.innerHeight - 220;
            const rowHeight = 40;
            setRowsPerPage(Math.max(1, Math.floor(tableHeight / rowHeight)));
        };
        
        updateRowsPerPage();
        window.addEventListener("resize", updateRowsPerPage);
        return () => window.removeEventListener("resize", updateRowsPerPage);
    }, []);

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = reasons.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(reasons.length / rowsPerPage);

    if (loading) {
        return (
            <div className="spinner" style={{flexDirection: 'column', marginTop: '20%'}}>
                <div className="spinner-circle"></div>
                <div style={{marginTop: 16, fontWeight: 600, color: '#246928', fontSize: 18}}>Ładowanie...</div>
            </div>
        );
    }

    return (
        <div>
            <h1>Konfigurator</h1>
            <div style={{display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap'}}>
                <input 
                    type="text" 
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="Wpisz nowy rodzaj wykroczenia"
                    style={{padding: '8px', borderRadius: '4px', border: '1px solid #ddd', flex: 1, maxWidth: '400px'}}
                    onKeyPress={(e) => e.key === 'Enter' && addNewReason()}
                />
                <button 
                    className="default-btn" 
                    onClick={addNewReason}
                    disabled={adding}
                    style={{height: 36}}
                >
                    {adding ? "Dodawanie..." : "Dodaj"}
                </button>
                <button 
                    className="default-btn" 
                    onClick={() => deleteReason(selectedReason)}
                    disabled={deleting || !selectedReason}
                    style={{height: 36, backgroundColor: selectedReason ? '#dc3545' : undefined}}
                >
                    {deleting ? "Usuwanie..." : "Usuń zaznaczony"}
                </button>
            </div>
            {selectedReason && (
                <div style={{marginBottom: 16, padding: '8px', backgroundColor: '#e3f2fd', borderRadius: '4px'}}>
                    <strong>Zaznaczony powód:</strong> {selectedReason}
                </div>
            )}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Rodzaj wykroczenia</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map((reason, index) => (
                            <tr 
                                key={reason.id}
                                className={selectedReason === reason.reason ? 'selected' : ''}
                                onClick={() => setSelectedReason(reason.reason)}
                                style={{cursor: 'pointer'}}
                            >
                                <td>{reason.reason || "Brak"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div className="pagination" style={{ marginTop: "5px" }}>
                        <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><FaArrowLeft /></button>
                        <span>Strona {currentPage} z {totalPages}</span>
                        <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}><FaArrowRight /></button>
                    </div>
                )}
            </div>
        </div>
    );
};
