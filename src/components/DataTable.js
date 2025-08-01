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
    const { dateFilter, setDateFilter, clubFilter, setClubFilter, statusFilter, setStatusFilter } = useFilters();
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [modalContent, setModalContent] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
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

                // do anonimizacji
                // const rangerMapping = {};
                // let rangerCounter = 1;

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
    
                        // do anonimizacji
                        // if (!(rangerName in rangerMapping)) {
                        //     rangerMapping[rangerName] = `Strażnik ${rangerCounter++}`;
                        // }

                        return {
                            id: document.id,
                            control_date: data.control_date?.toDate() ?? null,
                            association_club_name: data.association_club_name ?? null,
                            association_name: data.association_name ?? null,
                            controller_name: rangerName, //rangerMapping[rangerName],  // Anonymized name
                            controller_id: controllerId,
                            controller_email: email ? email.split("@")[0] : "Brak e-maila",
                            license_number: data.extractedLicenseNumber ?? null,
                            latitude: data.position?.latitude ?? null,
                            longitude: data.position?.longitude ?? null,
                            is_success: data.is_success ?? null,
                            reason: data.rejection_reason ?? null 
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

        fetchData();
    }, []);
    
    
    useEffect(() => {
        filterData();
    }, [dateFilter, clubFilter, statusFilter, data]);

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

        const csvData = filteredData.map((item, index) => ({
            "Data kontroli": item.control_date ? item.control_date.toLocaleString() : null,
            "Strażnik": item.controller_name ? item.controller_name : null, // `Strażnik ${index + 1}`
            "ID Strażnika": item.controller_email ? item.controller_email.split("@")[0] : null,
            "Zezwolenie": item.license_number ? item.license_number : null,
            "Koło": item.association_club_name ? item.association_club_name : null,
            "Szerokość geograficzna": item.latitude ? item.latitude : null,
            "Długość geograficzna": item.longitude ? item.longitude : null,
            "Wynik kontroli": item.is_success ? "OK" : "Wykroczenia",
            "Szczegóły kontroli": item.reason ? item.reason : null
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

    if (loading) {
        return <div style={{textAlign: "center", marginTop: 40}}><b>Ładowanie tabeli...</b></div>;
    }

    return (
        <div>
            <h1>Historia kontroli</h1>
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
                            <th>ID Strażnika</th>
                            <th>Zezwolenie</th>
                            <th>Koło</th>
                            <th>Pozycja</th>
                            <th>Wynik kontroli</th>
                            <th>Szczegóły kontroli</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map(item => (
                            <tr key={item.id}>
                                <td>{item.control_date ? item.control_date.toLocaleString() : "Brak"}</td>
                                <td>{item.controller_name}</td>
                                <td>{item.controller_email}</td>
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
