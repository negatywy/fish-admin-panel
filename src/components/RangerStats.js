import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { saveAs } from "file-saver";
import Papa from "papaparse";

export const RangerStats = () => {
    const [stats, setStats] = useState([]);
    const [filteredStats, setFilteredStats] = useState([]);
    const [dateFilter, setDateFilter] = useState("all");

    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log("Fetching data from Firestore...");
                const querySnapshot = await getDocs(collection(db, "ssr_controls"));

                if (querySnapshot.empty) {
                    console.warn("Firestore returned an empty collection.");
                    return;
                }

                const rangerData = {};

                querySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const ranger = data.controller_name || "Nieznany";
                    const isSuccess = data.is_success ?? false;
                    const controlDate = data.control_date?.toDate() ?? null;

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
        filterStats();
    }, [dateFilter, stats]);

    const filterStats = () => {
        if (dateFilter === "all") {
            setFilteredStats(stats);
            return;
        }

        const now = new Date();
        let cutoffDate;

        if (dateFilter === "lastWeek") {
            cutoffDate = new Date();
            cutoffDate.setDate(now.getDate() - 7);
        } else if (dateFilter === "lastMonth") {
            cutoffDate = new Date();
            cutoffDate.setMonth(now.getMonth() - 1);
        }

        const filtered = stats.filter(ranger => 
            ranger.controlDates.some(date => date && date >= cutoffDate)
        );
        
        setFilteredStats(filtered);
    };

    const downloadCSV = () => {
        if (filteredStats.length === 0) {
            alert("Brak danych do pobrania.");
            return;
        }

        const csvData = filteredStats.map(ranger => ({
            "Strażnik": ranger.name,
            "Liczba kontroli": ranger.totalControls,
            "Udane kontrole": ranger.successfulControls,
            "Nieudane kontrole": ranger.rejectedControls
        }));

        const csv = Papa.unparse(csvData);
        const utf8BOM = "\uFEFF" + csv;
        const blob = new Blob([utf8BOM], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, `ranger_stats_${dateFilter}.csv`);
    };


    return (
        <div>
            <h1>Statystyki Strażników</h1>
            
            <div className="filter-container" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label>Filtruj według daty: </label>
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                    <option value="all">Wszystkie</option>
                    <option value="lastWeek">Ostatni tydzień</option>
                    <option value="lastMonth">Ostatni miesiąc</option>
                </select>
                <button onClick={downloadCSV} className="download-btn">Pobierz CSV</button>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Strażnik</th>
                            <th>Liczba kontroli</th>
                            <th>Udane kontrole</th>
                            <th>Nieudane kontrole</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStats.map((ranger, index) => (
                            <tr key={index}>
                                <td>{ranger.name}</td>
                                <td>{ranger.totalControls}</td>
                                <td>{ranger.successfulControls}</td>
                                <td>{ranger.rejectedControls}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
