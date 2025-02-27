import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { saveAs } from "file-saver";
import Papa from "papaparse";

export const RangerStats = () => {
    const [stats, setStats] = useState([]);

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
                    const position = data.position ? `${data.position.latitude}, ${data.position.longitude}` : "Brak danych";
                    const isSuccess = data.is_success ?? false;

                    if (!rangerData[ranger]) {
                        rangerData[ranger] = {
                            name: ranger,
                            totalControls: 0,
                            successfulControls: 0,
                            locations: new Set()
                        };
                    }

                    rangerData[ranger].totalControls += 1;
                    if (isSuccess) {
                        rangerData[ranger].successfulControls += 1;
                    } 
                    rangerData[ranger].locations.add(position);
                });

                // Convert the object into an array
                const formattedStats = Object.values(rangerData).map(ranger => ({
                    ...ranger,
                    locations: Array.from(ranger.locations).join(" | ") // Convert Set to string
                }));

                setStats(formattedStats);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, []);

    const downloadCSV = () => {
        if (stats.length === 0) {
            alert("Brak danych do pobrania.");
            return;
        }

        const csvData = stats.map(ranger => ({
            "Strażnik": ranger.name,
            "Liczba kontroli": ranger.totalControls,
            "Udane kontrole": ranger.successfulControls,
            "Pozycje kontroli": ranger.locations
        }));

        const csv = Papa.unparse(csvData);
        const utf8BOM = "\uFEFF" + csv;
        const blob = new Blob([utf8BOM], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, `ranger_stats.csv`);
    };

    return (
        <div>
            <h1>Statystyki Strażników</h1>
            
            {/* Download CSV Button */}
            <button onClick={downloadCSV} className="download-btn">Pobierz CSV</button>

            {/* Data Table */}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Strażnik</th>
                            <th>Liczba kontroli</th>
                            <th>Udane kontrole</th>
                            <th>Pozycje kontroli</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map((ranger, index) => (
                            <tr key={index}>
                                <td>{ranger.name}</td>
                                <td>{ranger.totalControls}</td>
                                <td>{ranger.successfulControls}</td>
                                <td>{ranger.locations}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
