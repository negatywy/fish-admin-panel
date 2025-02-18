import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { saveAs } from "file-saver";
import Papa from "papaparse";

export const DataTable = () => {
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [dateFilter, setDateFilter] = useState("all");

    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log("Łączenie z Firestore...");
                const querySnapshot = await getDocs(collection(db, "kontrole"));

                if (querySnapshot.empty) {
                    console.warn("Firestore zwrócił pustą kolekcję.");
                }

                const items = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        data: data.data?.toDate() ?? null,
                        kod_grupy: data.kod_grupy ?? "Brak",
                        kolo: data.kolo ?? "Brak",
                        okreg: data.okreg ?? "Brak",
                        powod_odrzucenia: data.powod_odrzucenia ?? "Brak",
                        pozycja: data.pozycja ? `${data.pozycja.latitude}, ${data.pozycja.longitude}` : "Brak pozycji",
                        straznik: data.straznik ?? "Brak",
                        uwagi: data.uwagi ?? "Brak",
                        wynik: data.wynik ?? "Brak",
                        zezwolenie: data.zezwolenie ?? "Brak",
                    };
                });

                console.log("Przetworzone dane:", items);
                setData(items);
                setFilteredData(items); // Initially, show all data
            } catch (error) {
                console.error("Błąd pobierania danych:", error);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        filterData();
    }, [dateFilter, data]);

    const filterData = () => {
        if (dateFilter === "all") {
            setFilteredData(data);
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

        const filtered = data.filter(item => item.data && item.data >= cutoffDate);
        setFilteredData(filtered);
    };

    const downloadCSV = () => {
        if (filteredData.length === 0) {
            alert("Brak danych do pobrania.");
            return;
        }

        const csvData = filteredData.map(item => ({
            Data: item.data ? item.data.toLocaleString() : "Brak daty",
            "Kod Grupy": item.kod_grupy,
            Koło: item.kolo,
            Okręg: item.okreg,
            "Powód Odrzucenia": item.powod_odrzucenia,
            Pozycja: item.pozycja,
            Strażnik: item.straznik,
            Uwagi: item.uwagi,
            Wynik: item.wynik,
            Zezwolenie: item.zezwolenie,
        }));

        const csv = Papa.unparse(csvData);
        const utf8BOM = "\uFEFF" + csv;
        const blob = new Blob([utf8BOM], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, `dane_${dateFilter}.csv`);
    };

    return (
        <div>
            <h2>Lista Danych</h2>

            {/* Dropdown for selecting date range */}
            <div className="filter-container">
                <label>Filtruj według daty: </label>
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                    <option value="all">Wszystkie</option>
                    <option value="lastWeek">Ostatni tydzień</option>
                    <option value="lastMonth">Ostatni miesiąc</option>
                </select>

                {/* Download CSV Button */}
                <button onClick={downloadCSV} className="download-btn">Pobierz CSV</button>
            </div>

            {/* Data Table */}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Kod Grupy</th>
                            <th>Koło</th>
                            <th>Okręg</th>
                            <th>Powód Odrzucenia</th>
                            <th>Pozycja</th>
                            <th>Strażnik</th>
                            <th>Uwagi</th>
                            <th>Wynik</th>
                            <th>Zezwolenie</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map(item => (
                            <tr key={item.id}>
                                <td>{item.data ? item.data.toLocaleString() : "Brak daty"}</td>
                                <td>{item.kod_grupy}</td>
                                <td>{item.kolo}</td>
                                <td>{item.okreg}</td>
                                <td>{item.powod_odrzucenia}</td>
                                <td>{item.pozycja}</td>
                                <td>{item.straznik}</td>
                                <td>{item.uwagi}</td>
                                <td>{item.wynik}</td>
                                <td>{item.zezwolenie}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
