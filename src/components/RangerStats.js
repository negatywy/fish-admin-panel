import { useEffect, useState } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import "../style/App.css";

export const RangerStats = () => {
    const [stats, setStats] = useState([]);
    const [filteredStats, setFilteredStats] = useState([]);
    const [dateFilter, setDateFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "ssr_controls"));
                if (querySnapshot.empty) {
                    setLoading(false);
                    return;
                }

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

                const now = new Date();
                const currentYear = now.getFullYear();
                const rangerData = {};
                let rangerCounter = 1;

                await Promise.all(querySnapshot.docs.map(async (document) => {
                    const data = document.data();
                    const ranger = data.controller_name || "Nieznany";
                    const rangerID = data.controller_id || "Nieznany";
                    let email = null;
                    const isSuccess = data.is_success ?? false;
                    const controlDate = data.control_date?.toDate() ?? null;

                    if (rangerID) {
                        try {
                            const userDocRef = doc(db, "users", rangerID);
                            const userDocSnap = await getDoc(userDocRef);
                            if (userDocSnap.exists()) {
                                email = userDocSnap.data().email ?? "Brak e-maila";
                            }
                        } catch (error) {
                            console.error(`Błąd pobierania e-maila dla ID: ${rangerID}`, error);
                        }
                    }

                    if (!controlDate || controlDate.getFullYear() !== currentYear) return; 
                    if (regionName !== "all" && data.association_name !== regionName) return;

                    if (!rangerData[ranger]) {
                        rangerData[ranger] = {
                            name: ranger,
                            email: email ? email.split("@")[0] : "Brak e-maila",
                            controlResults: [], // obiekty {date, isSuccess, group_code}
                        };
                    }

                    rangerData[ranger].controlResults.push({ date: controlDate, isSuccess, group_code: data.group_code ?? "" });
                }));

                const formattedStats = Object.values(rangerData).map(ranger => {
                    const totalControls = ranger.controlResults.length;
                    const successfulControls = ranger.controlResults.filter(res => res.isSuccess).length;
                    const rejectedControls = totalControls - successfulControls;
                    const controlDates = ranger.controlResults.map(res => res.date);

                    const patrolDays = new Set(controlDates.map(date => date ? date.toISOString().slice(0, 10) : null)).size;

                    const groupPatrolDays = new Set(
                        ranger.controlResults
                            .filter(res => res.group_code?.startsWith("GRUPA_"))
                            .map(res => res.date ? res.date.toISOString().slice(0, 10) : null)
                    ).size;

                    return {
                        ...ranger,
                        totalControls,
                        successfulControls,
                        rejectedControls,
                        controlDates,
                        patrolDays,
                        groupPatrolDays,
                        controlResults: ranger.controlResults
                    };
                });

                setStats(formattedStats);
                setFilteredStats(formattedStats);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
            setLoading(false);
        };

        fetchData();
    }, []);

    useEffect(() => {
        const filterStats = () => {
            if (dateFilter === "all") {
                setFilteredStats(stats);
                setCurrentPage(1);
                return;
            }

            const now = new Date();
            let cutoffDate = new Date();

            if (dateFilter === "lastWeek") {
                cutoffDate.setDate(now.getDate() - 7);
            } else if (dateFilter === "lastMonth") {
                cutoffDate.setMonth(now.getMonth() - 1);
            }

            const filtered = stats
                .map(ranger => {
                    const filteredResults = ranger.controlResults.filter(res => res.date >= cutoffDate);
                    const totalControls = filteredResults.length;
                    const successfulControls = filteredResults.filter(res => res.isSuccess).length;
                    const rejectedControls = totalControls - successfulControls;
                    const controlDates = filteredResults.map(res => res.date);
                    const patrolDays = new Set(controlDates.map(date => date ? date.toISOString().slice(0, 10) : null)).size;
                    const groupPatrolDays = new Set(
                        filteredResults
                            .filter(res => res.group_code?.startsWith("GRUPA_"))
                            .map(res => res.date ? res.date.toISOString().slice(0, 10) : null)
                    ).size;

                    return {
                        ...ranger,
                        totalControls,
                        successfulControls,
                        rejectedControls,
                        controlDates,
                        patrolDays,
                        groupPatrolDays,
                        controlResults: filteredResults
                    };
                })
                .filter(ranger => ranger.totalControls > 0);

            setFilteredStats(filtered);
            setCurrentPage(1);
        };

        filterStats();
    }, [dateFilter, stats]);

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

    const downloadCSV = () => {
        if (filteredStats.length === 0) {
            alert("Brak danych do pobrania.");
            return;
        }

        const csvData = filteredStats.map(ranger => ({
            "Strażnik": ranger.name,
            "ID Strażnika": ranger.email,
            "Liczba patroli": ranger.patrolDays,
            "Patrole grupowe": ranger.groupPatrolDays,
            "Liczba kontroli": ranger.totalControls,
            "Kontrole pozytywne": ranger.successfulControls,
            "Kontrole negatywne": ranger.rejectedControls
        }));

        const csv = Papa.unparse(csvData);
        const utf8BOM = "\uFEFF" + csv;
        const blob = new Blob([utf8BOM], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, `ranger_stats_${dateFilter}.csv`);
    };

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredStats.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredStats.length / rowsPerPage);

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
            <h1>Statystyki Strażników</h1>
            <div className="filter-container">
                <label>Filtruj według daty: </label>
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                    <option value="all">Wszystkie</option>
                    <option value="lastWeek">Ostatni tydzień</option>
                    <option value="lastMonth">Ostatni miesiąc</option>
                </select>
                <button onClick={downloadCSV} className="default-btn">Pobierz CSV</button>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Strażnik</th>
                            <th>ID Strażnika</th>
                            <th>Liczba patroli</th>
                            <th>Patrole grupowe</th>
                            <th>Liczba kontroli</th>
                            <th>Kontrole pozytywne</th>
                            <th>Wykryte wykroczenia</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map((ranger, index) => (
                            <tr key={index}>
                                <td>{ranger.name}</td>
                                <td>{ranger.email}</td>
                                <td>{ranger.patrolDays}</td>
                                <td>{ranger.groupPatrolDays}</td>
                                <td>{ranger.totalControls}</td>
                                <td>{ranger.successfulControls}</td>
                                <td>{ranger.rejectedControls}</td>
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
