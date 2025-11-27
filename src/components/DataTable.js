
import { useEffect, useState } from "react";
import { collection, doc, getDocs, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import "../style/App.css";
import { useFilters } from "../context/FilterContext";
import { Filters } from "./Filters";
import { auth } from "../config/firebase";


export const DataTable = () => {
    const { dateFilter, setDateFilter, clubFilter, setClubFilter, statusFilter, setStatusFilter, customStartDate } = useFilters();
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [modalContent, setModalContent] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [selectedRow, setSelectedRow] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            console.log("Łączenie z Firestore...");
            const querySnapshot = await getDocs(collection(db, "ssr_controls"));
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
            const items = await Promise.all(
                querySnapshot.docs.map(async (document) => {
                    const data = document.data();
                    const rangerName = data.controller_name ?? "Nieznany";
                    const controllerId = data.controller_id ?? null;
                    let email = null;
                    if (controllerId) {
                        try {
                            const userDoc = await getDoc(doc(db, "users", controllerId));
                            if (userDoc.exists()) {
                                email = userDoc.data().email ?? "Brak e-maila";
                            }
                        } catch (error) {
                            console.error(`Błąd pobierania e-maila dla ID: ${controllerId}`, error);
                        }
                    }
                    // Handle rejection_reason as array or string
                    let reasonText = null;
                    if (Array.isArray(data.rejection_reason)) {
                        reasonText = data.rejection_reason.join('; ');
                    } else if (data.rejection_reason) {
                        reasonText = data.rejection_reason;
                    }

                    return {
                        id: document.id,
                        control_date: data.control_date?.toDate() ?? null,
                        association_club_name: data.association_club_name ?? null,
                        association_name: data.association_name ?? null,
                        controller_name: rangerName,
                        controller_id: controllerId,
                        controller_email: email ? email.split("@")[0] : "Brak e-maila",
                        group_code: data.group_code ?? null,
                        license_number: data.extractedLicenseNumber ?? null,
                        latitude: data.position?.latitude ?? null,
                        longitude: data.position?.longitude ?? null,
                        is_success: data.is_success ?? null,
                        reason: reasonText
                    };
                })
            );
            const filteredItems = items.filter(item => item.association_name === regionName);
            const sortedItems = filteredItems.sort((a, b) => (b.control_date || 0) - (a.control_date || 0));
            console.log("Przetworzone dane (posortowane):", sortedItems);
            setData(sortedItems);
            setFilteredData(sortedItems);
        } catch (error) {
            console.error("Błąd pobierania danych:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    
    useEffect(() => {
        filterData();
    }, [dateFilter, clubFilter, statusFilter, data, customStartDate]);

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

    const filterData = () => {
        let filtered = data;

        const now = new Date();
        const currentYear = now.getFullYear();

        filtered = filtered.filter(item => {
            const itemDate = item.control_date ? new Date(item.control_date) : null;
            return itemDate && itemDate.getFullYear() === currentYear;
        });
        
        if (dateFilter !== "previousYear") {
            const now = new Date();
            let cutoffDate;
            let endDate;
    
            if (dateFilter === "lastWeek") {
                cutoffDate = new Date();
                cutoffDate.setDate(now.getDate() - 7);
            } else if (dateFilter === "currentMonth") {
                // First day of current month
                cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (dateFilter === "previousMonth") {
                // First day of previous month
                cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                // Last day of previous month
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            } else if (dateFilter === "currentYear") {
                cutoffDate = new Date(now.getFullYear(), 0, 1);
            } else if (dateFilter === "previousYear") {
                // First day of previous year
                cutoffDate = new Date(now.getFullYear() - 1, 0, 1);
                // Last day of previous year
                endDate = new Date(now.getFullYear() - 1, 11, 31);
            } else if (dateFilter === "custom") {
                if (customStartDate) {
                    cutoffDate = new Date(customStartDate);
                    cutoffDate.setHours(0, 0, 0, 0);
                    endDate = new Date(customStartDate);
                    endDate.setHours(23, 59, 59, 999);
                }
            }
    
            filtered = filtered.filter(item => {
                const itemDate = item.control_date ? new Date(item.control_date) : null;
                if ((dateFilter === "previousMonth" || dateFilter === "previousYear" || dateFilter === "custom") && endDate) {
                    return itemDate && itemDate >= cutoffDate && itemDate <= endDate;
                }
                return itemDate && itemDate >= cutoffDate;
            });
        } else {
            // For previousYear, filter the entire previous year
            const now = new Date();
            const cutoffDate = new Date(now.getFullYear() - 1, 0, 1);
            const endDate = new Date(now.getFullYear() - 1, 11, 31);
            filtered = filtered.filter(item => {
                const itemDate = item.control_date ? new Date(item.control_date) : null;
                return itemDate && itemDate >= cutoffDate && itemDate <= endDate;
            });
        }
    
        if (clubFilter !== "all") {
            filtered = filtered.filter(item => item.association_club_name === clubFilter);
        }
        
        if (statusFilter === "rejected") {
            filtered = filtered.filter(item => !item.is_success);
        }

        setFilteredData(filtered);
        setCurrentPage(1);
    };

    const openModal = (content) => {
        setModalContent(content);
    };

    const closeModal = () => {
        setModalContent(null);
    };

        
    const copyToClipboard = () => {
        if (modalContent) {
            navigator.clipboard.writeText(modalContent).then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            });
        }
    };
    
    const downloadCSV = () => {
        if (filteredData.length === 0) {
            alert("Brak danych do pobrania.");
            return;
        }

        const csvData = filteredData.map((item, index) => {
            let date = null;
            let time = null;
            if (item.control_date) {
                const formatted = item.control_date.toLocaleString("pl-PL", { day: "numeric", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
                const parts = formatted.split(", ");
                date = parts[0] || null;
                time = parts[1] || null;
            }
            
            return {
                "Data": date,
                "Godzina": time,
                "Strażnik": item.controller_name ? item.controller_name : null,
                "ID Strażnika": item.controller_email ? item.controller_email.split("@")[0] : null,
                "Kod grupy": item.group_code ? item.group_code : null,
                "Zezwolenie": item.license_number ? item.license_number : null,
                "Koło": item.association_club_name ? item.association_club_name : null,
                "Szerokość geograficzna": item.latitude ? item.latitude : null,
                "Długość geograficzna": item.longitude ? item.longitude : null,
                "Wynik kontroli": item.is_success ? "OK" : "Wykroczenia",
                "Szczegóły kontroli": item.reason ? item.reason : null
            };
        });

        const csv = Papa.unparse(csvData);
        const utf8BOM = "\uFEFF" + csv;
        const blob = new Blob([utf8BOM], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, `kontrole_${dateFilter}.csv`);
    };

    // Remove duplicates within 15 minutes across all filteredData
    const roundCoord = (val) => val == null ? null : Math.round(val * 1000) / 1000;
    const removeDuplicates15Min = (rows) => {
        const result = [];
        for (let i = 0; i < rows.length; i++) {
            const curr = rows[i];
            const currLat = roundCoord(curr.latitude);
            const currLng = roundCoord(curr.longitude);
            // Check if a previous record with the same fields exists within 15 minutes
            const isDuplicate = result.some(prev => {
                const prevTime = prev.control_date ? prev.control_date.getTime() : null;
                const currTime = curr.control_date ? curr.control_date.getTime() : null;
                const timeDiff = (prevTime !== null && currTime !== null) ? Math.abs(currTime - prevTime) : null;
                // const prevLat = roundCoord(prev.latitude);
                // const prevLng = roundCoord(prev.longitude);
                return (
                    timeDiff !== null && timeDiff <= 20 * 60 * 1000 &&
                    prev.controller_name === curr.controller_name &&
                    prev.controller_email === curr.controller_email &&
                    prev.group_code === curr.group_code &&
                    prev.license_number === curr.license_number &&
                    prev.association_club_name === curr.association_club_name &&
                    // prevLat === currLat &&
                    // prevLng === currLng &&
                    prev.is_success === curr.is_success &&
                    prev.reason === curr.reason
                );
            });
            if (!isDuplicate) {
                result.push(curr);
            }
        }
        return result;
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedData = (dataToSort) => {
        if (!sortConfig.key) return dataToSort;

        const sorted = [...dataToSort].sort((a, b) => {
            if (sortConfig.key === 'controller_email') {
                // Extract prefix and number from IDs like MAZSSR_0077
                const extractParts = (id) => {
                    const match = id.match(/^(.+?)_(\d+)$/);
                    if (match) {
                        return { prefix: match[1], number: parseInt(match[2], 10) };
                    }
                    return { prefix: id, number: 0 };
                };

                const aParts = extractParts(a.controller_email);
                const bParts = extractParts(b.controller_email);

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
            }
            return 0;
        });

        return sorted;
    };

    const dedupedData = removeDuplicates15Min(filteredData);
    const sortedData = getSortedData(dedupedData);
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
            <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8}}>
                <h1 style={{margin: 0}}>Historia kontroli</h1>
                <button className="default-btn" onClick={fetchData} style={{height: 30}} title="Odśwież dane">Odśwież</button>
            </div>
            <Filters
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                clubFilter={clubFilter}
                setClubFilter={setClubFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                data={data}
                downloadCSV={downloadCSV}
                showDownloadButton={true} 
            />
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data kontroli</th>
                            <th>Strażnik</th>
                            <th onClick={() => handleSort('controller_email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                ID Strażnika {sortConfig.key === 'controller_email' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                            <th>Kod grupy</th>
                            <th>Zezwolenie</th>
                            <th>Koło</th>
                            <th>Pozycja</th>
                            <th>Wynik kontroli</th>
                            <th>Szczegóły kontroli</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map(item => (
                            <tr key={item.id} onClick={() => setSelectedRow(item.id)} className={selectedRow === item.id ? 'selected' : ''}>
                                <td>{item.control_date ? item.control_date.toLocaleString("pl-PL", { day: "numeric", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Brak"}</td>
                                <td>{item.controller_name}</td>
                                <td>{item.controller_email}</td>
                                <td>{item.group_code}</td>
                                <td>{item.license_number}</td>
                                <td>{item.association_club_name}</td>
                                <td>{item.latitude != null && item.longitude != null ? (
                                    <a
                                        href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: "#246928" }}
                                    >
                                    Zobacz na mapie
                                    </a>) : (<span style={{ color: "gray" }}>Brak danych</span>
                                )}
                                </td>
                                <td>{item.is_success ? "✅ OK" : "❌ Wykroczenia"}</td>
                                <td>
                                    {item.reason ? (
                                        <span className="clickable" onClick={() => openModal(item.reason)}>
                                            🔍 Zobacz
                                        </span>
                                    ) : null}
                                </td>
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
            {modalContent && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <button className="close-btn" onClick={closeModal}>×</button>
                            <h2>Szczegóły kontroli</h2>
                            <p>{modalContent}</p>
                            <button className="copy-btn" onClick={copyToClipboard}>
                                {copySuccess ? "✅ Skopiowano" : "Kopiuj"}
                            </button>
                        </div>
                    </div>
                )}
        </div>
    );
};
