import { useEffect, useState, useRef } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { useFilters } from "../context/FilterContext";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import "../style/App.css";

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export const StatsCharts = () => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scaleType, setScaleType] = useState('linear'); // 'linear' or 'logarithmic'
    const { dateFilter, setDateFilter, customStartDate, setCustomStartDate } = useFilters();
    const chartContainerRef = useRef(null);

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
            let cutoffDate;
            let endDate;

            // Apply date filter
            if (dateFilter === "lastWeek") {
                cutoffDate = new Date();
                cutoffDate.setDate(now.getDate() - 7);
            } else if (dateFilter === "currentMonth") {
                cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (dateFilter === "previousMonth") {
                cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                cutoffDate.setHours(0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                endDate.setHours(23, 59, 59, 999);
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
            const rangerPatrolDays = {}; // Track patrol days per ranger per label
            const groupUsersCache = new Map();

            const getGroupUsers = async (groupCode) => {
                const normalized = typeof groupCode === "string" ? groupCode.trim() : groupCode;
                if (!normalized || !normalized.startsWith("GRUPA_")) return [];
                if (groupUsersCache.has(normalized)) return groupUsersCache.get(normalized);
                try {
                    const groupDoc = await getDoc(doc(db, "ssr_groups", normalized));
                    if (!groupDoc.exists()) {
                        groupUsersCache.set(normalized, []);
                        return [];
                    }
                    const usersArray = groupDoc.data()?.users || [];
                    groupUsersCache.set(normalized, usersArray);
                    return usersArray;
                } catch (error) {
                    console.error(`Error fetching group users for code: ${normalized}`, error);
                }
                const fallback = [];
                groupUsersCache.set(normalized, fallback);
                return fallback;
            };

            const getGroupMemberIdsForDate = async (groupCode, controlDate) => {
                if (!controlDate) return [];
                const users = await getGroupUsers(groupCode);
                if (!users.length) return [];
                const dateKey = controlDate.toISOString().slice(0, 10);
                const memberIds = users
                    .filter((entry) => {
                        const entryId = entry?.id || entry?.uid;
                        if (!entryId) return false;
                        const joined = entry?.joined?.toDate ? entry.joined.toDate() : entry?.joined ? new Date(entry.joined) : null;
                        if (!joined) return false;
                        return joined.toISOString().slice(0, 10) === dateKey;
                    })
                    .map((entry) => entry?.id || entry?.uid)
                    .filter(Boolean);
                return Array.from(new Set(memberIds));
            };

            for (const document of querySnapshot.docs) {
                const data = document.data();
                const controlDate = data.control_date?.toDate();
                
                if (!controlDate) continue;
                
                // Filter by region
                if (regionName !== "all" && data.association_name !== regionName) continue;

                // Filter by date range
                if (cutoffDate) {
                    if (endDate) {
                        if (controlDate < cutoffDate || controlDate > endDate) continue;
                    } else {
                        if (controlDate < cutoffDate) continue;
                    }
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
                        controls: 0,
                        rejectedControls: 0
                    };
                }

                // Track patrol days per ranger per label (same logic as RangerStats)
                const rangerId = data.controller_id || data.controller_name || "unknown";
                const dateKey = controlDate.toISOString().slice(0, 10);
                const rangerLabelKey = `${label}::${rangerId}`;
                
                if (!rangerPatrolDays[rangerLabelKey]) {
                    rangerPatrolDays[rangerLabelKey] = new Set();
                }
                rangerPatrolDays[rangerLabelKey].add(dateKey);

                const groupCode = typeof data.group_code === "string" ? data.group_code.trim() : data.group_code ?? "";
                if (groupCode.startsWith("GRUPA_")) {
                    const groupMemberIds = await getGroupMemberIdsForDate(groupCode, controlDate);
                    groupMemberIds.forEach((memberId) => {
                        const memberLabelKey = `${label}::${memberId}`;
                        if (!rangerPatrolDays[memberLabelKey]) {
                            rangerPatrolDays[memberLabelKey] = new Set();
                        }
                        rangerPatrolDays[memberLabelKey].add(dateKey);
                    });
                }

                // Count controls
                aggregatedData[label].controls += 1;

                // Count rejected controls (is_success === false)
                if (data.is_success === false) {
                    aggregatedData[label].rejectedControls += 1;
                }
            }

            // Calculate total patrol days per label by summing unique days per ranger
            const labelPatrolDays = {};
            Object.keys(rangerPatrolDays).forEach(key => {
                const [label] = key.split("::");
                if (!labelPatrolDays[label]) {
                    labelPatrolDays[label] = 0;
                }
                labelPatrolDays[label] += rangerPatrolDays[key].size;
            });

            // Convert to arrays for Chart.js
            const sortedLabels = Object.keys(aggregatedData).sort((a, b) => {
                // Sort by date
                const dateA = parseLabelToDate(a, dateFilter);
                const dateB = parseLabelToDate(b, dateFilter);
                return dateA - dateB;
            });

            const patrols = sortedLabels.map(label => labelPatrolDays[label] || 0);
            const controls = sortedLabels.map(label => aggregatedData[label].controls);
            const rejectedControls = sortedLabels.map(label => aggregatedData[label].rejectedControls);

            setChartData({
                labels: sortedLabels,
                datasets: [
                    {
                        label: 'Liczba patroli',
                        data: patrols,
                        backgroundColor: (context) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                            gradient.addColorStop(0, 'rgba(75, 192, 192, 0.9)');
                            gradient.addColorStop(0.5, 'rgba(75, 192, 192, 0.7)');
                            gradient.addColorStop(1, 'rgba(75, 192, 192, 0.5)');
                            return gradient;
                        },
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        borderRadius: 4,
                        shadowOffsetX: 3,
                        shadowOffsetY: 3,
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.3)',
                    },
                    {
                        label: 'Liczba kontroli',
                        data: controls,
                        backgroundColor: (context) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                            gradient.addColorStop(0, 'rgba(54, 162, 235, 0.9)');
                            gradient.addColorStop(0.5, 'rgba(54, 162, 235, 0.7)');
                            gradient.addColorStop(1, 'rgba(54, 162, 235, 0.5)');
                            return gradient;
                        },
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2,
                        borderRadius: 4,
                        shadowOffsetX: 3,
                        shadowOffsetY: 3,
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.3)',
                    },
                    {
                        label: 'Wykryte wykroczenia',
                        data: rejectedControls,
                        backgroundColor: (context) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                            gradient.addColorStop(0, 'rgba(255, 99, 132, 0.9)');
                            gradient.addColorStop(0.5, 'rgba(255, 99, 132, 0.7)');
                            gradient.addColorStop(1, 'rgba(255, 99, 132, 0.5)');
                            return gradient;
                        },
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        borderRadius: 4,
                        shadowOffsetX: 3,
                        shadowOffsetY: 3,
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.3)',
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

    const getDateRangeLabel = () => {
        const now = new Date();
        switch (dateFilter) {
            case "previousYear":
                return `Poprzedni rok (${now.getFullYear() - 1})`;
            case "lastWeek": {
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                return `Ostatni tydzień (${weekAgo.toLocaleDateString("pl-PL")} - ${now.toLocaleDateString("pl-PL")})`;
            }
            case "currentMonth": {
                const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
                return `Bieżący miesiąc (${monthNames[now.getMonth()]} ${now.getFullYear()})`;
            }
            case "previousMonth": {
                const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
                const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return `Poprzedni miesiąc (${monthNames[prevMonth.getMonth()]} ${prevMonth.getFullYear()})`;
            }
            case "currentYear":
                return `Bieżący rok (${now.getFullYear()})`;
            case "custom":
                return customStartDate ? `Wybrany dzień (${new Date(customStartDate).toLocaleDateString("pl-PL")})` : "Wybierz dzień";
            default:
                return "";
        }
    };

    const exportToPDF = async () => {
        if (!chartContainerRef.current) return;
        
        try {
            const canvas = await html2canvas(chartContainerRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 10;
            
            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save(`statystyki_${dateFilter}_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error('Błąd podczas eksportu PDF:', error);
            alert('Wystąpił błąd podczas eksportu PDF');
        }
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: {
                        size: 12
                    },
                    padding: 15
                }
            },
            title: {
                display: true,
                text: `Statystyki kontroli i patroli - ${getDateRangeLabel()}`,
                font: {
                    size: 16,
                    weight: 'bold'
                },
                padding: 20
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 4,
                titleFont: {
                    size: 14,
                    weight: 'bold'
                },
                bodyFont: {
                    size: 13
                },
                boxPadding: 6
            }
        },
        scales: {
            x: {
                stacked: false,
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 11
                    },
                    maxRotation: 45,
                    minRotation: 45
                }
            },
            y: {
                type: scaleType,
                stacked: false,
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    font: {
                        size: 11
                    },
                    precision: 0,
                    callback: function(value) {
                        if (scaleType === 'logarithmic') {
                            return Number(value.toString());
                        }
                        return value;
                    }
                },
                title: {
                    display: true,
                    text: 'Liczba' + (scaleType === 'logarithmic' ? ' (skala logarytmiczna)' : ''),
                    font: {
                        size: 12
                    }
                }
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
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
                <label style={{ marginLeft: 16 }}>Skala: </label>
                <select value={scaleType} onChange={(e) => setScaleType(e.target.value)}>
                    <option value="linear">Liniowa</option>
                    <option value="logarithmic">Logarytmiczna</option>
                </select>
                <button onClick={exportToPDF} className="default-btn" style={{ marginLeft: 8 }}>Eksportuj PDF</button>
            </div>
            {(!chartData || chartData.labels.length === 0) ? (
                <div style={{textAlign: 'center', marginTop: '5rem', fontSize: '1rem', color: '#666'}}>
                    Brak danych do wyświetlenia dla wybranego zakresu dat.
                </div>
            ) : (
                <div ref={chartContainerRef} style={{
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
