import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import "../style/App.css";
import { auth } from "../config/firebase";

export const RangerStats = () => {
    const [stats, setStats] = useState([]);
    const [filteredStats, setFilteredStats] = useState([]);
    const [dateFilter, setDateFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "ssr_controls"));
                if (querySnapshot.empty) return;

                const user = auth.currentUser;
                let regionName ="all";
                switch (user.email) {
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
                const rangerMapping = {};

                querySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const ranger = data.controller_name || "Nieznany";
                    const isSuccess = data.is_success ?? false;
                    const controlDate = data.control_date?.toDate() ?? null;

                    if (!controlDate || controlDate.getFullYear() !== currentYear) return; 
                    if (regionName !== "all" && data.association_name !== regionName) return;

                    if (!(ranger in rangerMapping)) {
                        rangerMapping[ranger] = `Strażnik ${rangerCounter++}`;
                    }

                    // const anonymizedName = rangerMapping[ranger];
                    // const anonymizedName = ranger; // do anonimizacji

                    if (!rangerData[ranger]) {
                        rangerData[ranger] = {
                            name: ranger,
                            totalControls: 0,
                            successfulControls: 0,
                            rejectedControls: 0,
                            controlDates: []
                        };
                    }

                    rangerData[ranger].totalControls += 1;
                    if (isSuccess) {
                        rangerData[ranger].successfulControls += 1;
                    } else {
                        rangerData[ranger].rejectedControls += 1;
                    }
                    
                    rangerData[ranger].controlDates.push(controlDate);
                });

                const formattedStats = Object.values(rangerData);
                setStats(formattedStats);
                setFilteredStats(formattedStats);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
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

            const filtered = stats.filter(ranger => 
                ranger.controlDates.some(date => date >= cutoffDate)
            );

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
                            <th>Liczba kontroli</th>
                            <th>Kontrole pozytywne</th>
                            <th>Kontrole negatywne</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map((ranger, index) => (
                            <tr key={index}>
                                <td>{ranger.name}</td>
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
