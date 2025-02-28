import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import "../style/App.css";

export const DataTable = () => {
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [dateFilter, setDateFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [modalContent, setModalContent] = useState(null);
    const [clubFilter, setClubFilter] = useState("all");

    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log("Łączenie z Firestore...");
                const querySnapshot = await getDocs(collection(db, "ssr_controls"));
    
                if (querySnapshot.empty) {
                    console.warn("Firestore zwrócił pustą kolekcję.");
                }
    
                const items = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        control_date: data.control_date?.toDate() ?? null,
                        association_club_name: data.association_club_name ?? null,
                        controller_name: data.controller_name ?? null,
                        license_number: data.extractedLicenseNumber ?? null,
                        latitude: data.position?.latitude ?? null,  
                        longitude: data.position?.longitude ?? null,
                        is_success: data.is_success ?? null,
                        reason: data.rejection_reason ?? null 
                    };
                });
    
                const sortedItems = items.sort((a, b) => (b.control_date || 0) - (a.control_date || 0));
    
                console.log("Przetworzone dane (posortowane):", sortedItems);
                setData(sortedItems);
                setFilteredData(sortedItems);
            } catch (error) {
                console.error("Błąd pobierania danych:", error);
            }
        };
    
        fetchData();
    }, []);
    
    useEffect(() => {
        filterData();
    }, [dateFilter, clubFilter, data]);

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
        let csvName;
        
        if (dateFilter !== "all") {
            const now = new Date();
            let cutoffDate;
    
            if (dateFilter === "lastWeek") {
                cutoffDate = new Date();
                cutoffDate.setDate(now.getDate() - 7);
            } else if (dateFilter === "lastMonth") {
                cutoffDate = new Date();
                cutoffDate.setMonth(now.getMonth() - 1);
            }
    
            filtered = filtered.filter(item => {
                const itemDate = item.control_date ? new Date(item.control_date) : null;
                return itemDate && itemDate >= cutoffDate;
            });
        }
    
        if (clubFilter !== "all") {
            filtered = filtered.filter(item => item.association_club_name === clubFilter);
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
    
    const downloadCSV = () => {
        if (filteredData.length === 0) {
            alert("Brak danych do pobrania.");
            return;
        }

        const csvData = filteredData.map(item => ({
            "Data kontroli": item.control_date ? item.control_date.toLocaleString() : null,
            "Strażnik": item.controller_name ? item.controller_name : null,
            "Zezwolenie": item.license_number ? item.license_number : null,
            "Koło": item.association_club_name ? item.association_club_name : null,
            "Szerokość geograficzna": item.latitude ? item.latitude : null,
            "Długość geograficzna": item.longitude ? item.longitude : null,
            "Wynik kontroli": item.is_success ? "OK" : "Odrzucona",
            "Powód odrzucenia": item.reason ? item.reason : null
        }));

        const csv = Papa.unparse(csvData);
        const utf8BOM = "\uFEFF" + csv;
        const blob = new Blob([utf8BOM], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, `kontrole_${dateFilter}.csv`);
    };

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    return (
        <div>
            <h1>Historia kontroli</h1>
            <div className="filter-container">
                <label>Filtruj według daty: </label>
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                    <option value="all">Wszystkie</option>
                    <option value="lastWeek">Ostatni tydzień</option>
                    <option value="lastMonth">Ostatni miesiąc</option>
                </select>

                <label>Filtruj według Koła: </label>
                <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
                    <option value="all">Wszystkie</option>
                    {[...new Set(data.map(item => item.association_club_name))].map((club, index) => (
                        <option key={index} value={club}>{club}</option>
                    ))}
                </select>

                <button onClick={downloadCSV} className="download-btn">Pobierz CSV</button>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data kontroli</th>
                            <th>Strażnik</th>
                            <th>Zezwolenie</th>
                            <th>Koło</th>
                            <th>Szerokość geograficzna</th>
                            <th>Długość geograficzna</th>
                            <th>Wynik kontroli</th>
                            <th>Powód odrzucenia</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map(item => (
                            <tr key={item.id}>
                                <td>{item.control_date ? item.control_date.toLocaleString() : "Brak"}</td>
                                <td>{item.controller_name}</td>
                                <td>{item.license_number}</td>
                                <td>{item.association_club_name}</td>
                                <td>{item.latitude}</td>
                                <td>{item.longitude}</td>
                                <td>{item.is_success ? "✅ OK" : "❌ Odrzucona"}</td>
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
                        <button className="close-btn" onClick={closeModal}>
                            ×
                        </button>
                        <h2>Powód odrzucenia</h2>
                        <p>{modalContent}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
