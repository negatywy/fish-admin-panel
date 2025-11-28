import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { useFilters } from "../context/FilterContext";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import "../style/App.css";

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export const StatsCharts = () => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { dateFilter, setDateFilter, customStartDate, setCustomStartDate } = useFilters();

    const fetchData = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "ssr_controls"));
            if (querySnapshot.empty) {
                setChartData(null);
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
            let cutoffDate = new Date();
            let endDate;

            // Apply date filter
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

            // Aggregate data by time period
            const aggregatedData = {};

            querySnapshot.docs.forEach((document) => {
                const data = document.data();
                const controlDate = data.control_date?.toDate();
                
                if (!controlDate) return;
                
                // Filter by region
                if (regionName !== "all" && data.association_name !== regionName) return;

                // Filter by date range
                if (endDate) {
                    if (controlDate < cutoffDate || controlDate > endDate) return;
                } else {
                    if (controlDate < cutoffDate) return;
                }

                // Determine the label based on date filter
                let label;
                if (dateFilter === "lastWeek" || dateFilter === "custom") {
                    // Group by day
                    label = controlDate.toLocaleDateString("pl-PL");
                } else if (dateFilter === "currentMonth" || dateFilter === "previousMonth") {
                    // Group by day
                    label = controlDate.toLocaleDateString("pl-PL");
                } else if (dateFilter === "currentYear" || dateFilter === "previousYear") {
                    // Group by month
                    const monthNames = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
                    label = `${monthNames[controlDate.getMonth()]} ${controlDate.getFullYear()}`;
                }

                if (!aggregatedData[label]) {
                    aggregatedData[label] = {
                        patrolDays: new Set(),
                        controls: 0,
                        rejectedControls: 0
                    };
                }

                // Track patrol days (unique dates)
                const dateKey = controlDate.toISOString().slice(0, 10);
                aggregatedData[label].patrolDays.add(dateKey);

                // Count controls
                aggregatedData[label].controls += 1;

                // Count rejected controls (is_success === false)
                if (data.is_success === false) {
                    aggregatedData[label].rejectedControls += 1;
                }
            });

            // Convert to arrays for Chart.js
            const sortedLabels = Object.keys(aggregatedData).sort((a, b) => {
                // Sort by date
                const dateA = parseLabelToDate(a, dateFilter);
                const dateB = parseLabelToDate(b, dateFilter);
                return dateA - dateB;
            });

            const patrols = sortedLabels.map(label => aggregatedData[label].patrolDays.size);
            const controls = sortedLabels.map(label => aggregatedData[label].controls);
            const rejectedControls = sortedLabels.map(label => aggregatedData[label].rejectedControls);

            setChartData({
                labels: sortedLabels,
                datasets: [
                    {
                        label: 'Liczba patroli',
                        data: patrols,
                        backgroundColor: 'rgba(75, 192, 192, 0.7)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'Liczba kontroli',
                        data: controls,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'Wykryte wykroczenia',
                        data: rejectedControls,
                        backgroundColor: 'rgba(255, 99, 132, 0.7)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1,
                    },
                ],
            });
        } catch (error) {
            console.error("Error fetching data:", error);
        }
        setLoading(false);
    };

    // Helper function to parse label back to date for sorting
    const parseLabelToDate = (label, filter) => {
        if (filter === "currentYear" || filter === "previousYear") {
            // Format: "Sty 2024"
            const monthNames = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
            const parts = label.split(" ");
            const monthIndex = monthNames.indexOf(parts[0]);
            const year = parseInt(parts[1]);
            return new Date(year, monthIndex, 1);
        } else {
            // Format: "dd.mm.yyyy"
            const parts = label.split(".");
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    };

    useEffect(() => {
        fetchData();
    }, [dateFilter, customStartDate]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: {
                        size: 12
                    }
                }
            },
            title: {
                display: true,
                text: 'Statystyki kontroli i patroli',
                font: {
                    size: 16,
                    weight: 'bold'
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            }
        },
        scales: {
            x: {
                stacked: false,
                ticks: {
                    font: {
                        size: 11
                    },
                    maxRotation: 45,
                    minRotation: 45
                }
            },
            y: {
                stacked: false,
                beginAtZero: true,
                ticks: {
                    font: {
                        size: 11
                    },
                    precision: 0
                },
                title: {
                    display: true,
                    text: 'Liczba',
                    font: {
                        size: 12
                    }
                }
            }
        }
    };

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
            <h1>Wykresy statystyk</h1>
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
            </div>
            {(!chartData || chartData.labels.length === 0) ? (
                <div style={{textAlign: 'center', marginTop: '5rem', fontSize: '1rem', color: '#666'}}>
                    Brak danych do wyświetlenia dla wybranego zakresu dat.
                </div>
            ) : (
                <div style={{
                    padding: '1.5rem',
                    backgroundColor: 'white',
                    borderRadius: '0.5rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    height: 'calc(100vh - 15rem)'
                }}>
                    <Bar data={chartData} options={chartOptions} />
                </div>
            )}
        </div>
    );
};
