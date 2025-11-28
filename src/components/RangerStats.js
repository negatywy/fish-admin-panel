import { useEffect, useState } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { useFilters } from "../context/FilterContext";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import "../style/App.css";

export const RangerStats = () => {
    const [stats, setStats] = useState([]);
    const [filteredStats, setFilteredStats] = useState([]);
    const { dateFilter, setDateFilter, customStartDate, setCustomStartDate } = useFilters();
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [selectedRow, setSelectedRow] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "ssr_controls"));
            if (querySnapshot.empty) {
                setStats([]);
                setFilteredStats([]);
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
                        controlResults: [],
                    };
                }

                rangerData[ranger].controlResults.push({
                    date: controlDate,
                    isSuccess,
                    group_code: data.group_code ?? "",
                });
            }));

            const formattedStats = Object.values(rangerData).map((ranger) => {
                const totalControls = ranger.controlResults.length;
                const successfulControls = ranger.controlResults.filter((res) => res.isSuccess).length;
                const rejectedControls = totalControls - successfulControls;
                const controlDates = ranger.controlResults.map((res) => res.date);
                const patrolDays = new Set(controlDates.map((d) => d?.toISOString().slice(0, 10))).size;
                const groupPatrolDays = new Set(
                    ranger.controlResults
                        .filter((res) => res.group_code?.startsWith("GRUPA_"))
                        .map((res) => res.date?.toISOString().slice(0, 10))
                ).size;

                return {
                    ...ranger,
                    totalControls,
                    successfulControls,
                    rejectedControls,
                    controlDates,
                    patrolDays,
                    groupPatrolDays,
                };
            });

            setStats(formattedStats);
            setFilteredStats(formattedStats);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const filterStats = () => {
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

            const filtered = stats
                .map(ranger => {
                    const filteredResults = ranger.controlResults.filter(res => {
                        if ((dateFilter === "previousMonth" || dateFilter === "previousYear" || dateFilter === "custom") && endDate) {
                            return res.date >= cutoffDate && res.date <= endDate;
                        }
                        return res.date >= cutoffDate;
                    });
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
    }, [dateFilter, stats, customStartDate]);

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

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedData = () => {
        if (!sortConfig.key) return filteredStats;

        const sorted = [...filteredStats].sort((a, b) => {
            if (sortConfig.key === 'email') {
                // Extract prefix and number from IDs like MAZSSR_0077
                const extractParts = (id) => {
                    const match = id.match(/^(.+?)_(\d+)$/);
                    if (match) {
                        return { prefix: match[1], number: parseInt(match[2], 10) };
                    }
                    return { prefix: id, number: 0 };
                };

                const aParts = extractParts(a.email);
                const bParts = extractParts(b.email);

                // First compare by prefix
                if (aParts.prefix !== bParts.prefix) {
                    return sortConfig.direction === 'asc'
                        ? aParts.prefix.localeCompare(bParts.prefix)
                        : bParts.prefix.localeCompare(aParts.prefix);
                }

                // Then compare by number
                return sortConfig.direction === 'asc'
                    ? aParts.number - bParts.number
                    : bParts.number - aParts.number;
            } else if (['patrolDays', 'groupPatrolDays', 'totalControls', 'successfulControls', 'rejectedControls'].includes(sortConfig.key)) {
                // Numeric sorting for all numeric columns
                const aValue = a[sortConfig.key] || 0;
                const bValue = b[sortConfig.key] || 0;
                return sortConfig.direction === 'asc'
                    ? aValue - bValue
                    : bValue - aValue;
            }
            return 0;
        });

        return sorted;
    };

    const sortedData = getSortedData();
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = sortedData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(sortedData.length / rowsPerPage);

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
                    <button onClick={fetchData} className="default-btn" style={{ marginLeft: 8 }}>Odśwież</button>
                )}
                <button onClick={fetchData} className="default-btn" style={{ marginLeft: 8 }}>Odśwież</button>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Strażnik</th>
                            <th onClick={() => handleSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                ID Strażnika {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                            <th onClick={() => handleSort('patrolDays')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                Liczba patroli {sortConfig.key === 'patrolDays' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                            <th onClick={() => handleSort('groupPatrolDays')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                Patrole grupowe {sortConfig.key === 'groupPatrolDays' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                            <th onClick={() => handleSort('totalControls')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                Liczba kontroli {sortConfig.key === 'totalControls' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                            <th onClick={() => handleSort('successfulControls')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                Kontrole pozytywne {sortConfig.key === 'successfulControls' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                            <th onClick={() => handleSort('rejectedControls')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                Wykryte wykroczenia {sortConfig.key === 'rejectedControls' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map((ranger, index) => (
                            <tr key={index} onClick={() => setSelectedRow(index)} className={selectedRow === index ? 'selected' : ''}>
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
