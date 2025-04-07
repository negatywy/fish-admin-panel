import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "../style/App.css";
import { db } from "../config/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Filters } from "./Filters";
import { useFilters } from "../context/FilterContext";
import { auth } from "../config/firebase";

const defaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow
});

const redIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: markerShadow
});

export const ControlMap = () => {
    const { dateFilter, setDateFilter, clubFilter, setClubFilter, statusFilter, setStatusFilter } = useFilters();
    const [points, setPoints] = useState([]);
    const [filteredPoints, setFilteredPoints] = useState([]);

    useEffect(() => {
        const fetchPoints = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "ssr_controls"));

                const user = auth.currentUser;
                let regionName ="all";
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

                // do anonimizacji
                // const rangerMapping = {};
                // let rangerCounter = 1;

                const fetchedPoints = [];

                await Promise.all(
                    querySnapshot.docs.map(async (document) => {
                        const data = document.data();
                        if (!data.position || !data.position.latitude || !data.position.longitude) return;
                        if (regionName !== "all" && data.association_name !== regionName) return;

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

                        fetchedPoints.push({
                            id: document.id,
                            control_date: data.control_date?.toDate() ?? null,
                            association_name: data.association_name ?? null,
                            controller_name: rangerName,
                            controller_id: controllerId ?? null,
                            controller_email: email.split("@")[0],
                            lat: data.position.latitude,
                            lng: data.position.longitude,
                            is_success: data.is_success ?? false,
                            association_club_name: data.association_club_name ?? "",
                            license_number: data.extractedLicenseNumber ?? null,
                        });
                    })
                );

                setPoints(fetchedPoints);
            } catch (error) {
                console.error("Error fetching map data:", error);
            }
        };

        fetchPoints();
    }, []);

    useEffect(() => {
        const now = new Date();
        const currentYear = now.getFullYear();

        let filtered = points.filter(point => 
            point.control_date && point.control_date.getFullYear() === currentYear
        );

        if (dateFilter !== "all") {
            let cutoffDate = new Date();
            if (dateFilter === "lastWeek") {
                cutoffDate.setDate(now.getDate() - 7);
            } else if (dateFilter === "lastMonth") {
                cutoffDate.setMonth(now.getMonth() - 1);
            }
            filtered = filtered.filter(point => point.control_date >= cutoffDate);
        }

        if (clubFilter !== "all") {
            filtered = filtered.filter(point => point.association_club_name === clubFilter);
        }

        if (statusFilter === "rejected") {
            filtered = filtered.filter(point => !point.is_success);
        }

        setFilteredPoints(filtered);
    }, [dateFilter, clubFilter, statusFilter, points]);

    return (
        <div>
            <Filters 
                dateFilter={dateFilter} 
                setDateFilter={setDateFilter} 
                clubFilter={clubFilter} 
                setClubFilter={setClubFilter} 
                statusFilter={statusFilter} 
                setStatusFilter={setStatusFilter} 
                data={points} 
                style={{ margin: "10px 0" }}
                showDownloadButton={false}
            />
            <MapContainer 
                center={[52.4461, 21.0302]} 
                zoom={10} 
                style={{ height: "calc(90vh - 20px)", width: "100%" }}
                className="map-container"
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
                />
                {filteredPoints.map(point => (
                    <Marker 
                        key={point.id} 
                        position={[point.lat, point.lng]} 
                        icon={point.is_success ? defaultIcon : redIcon} 
                    >
                        <Popup>
                            <strong>{point.is_success ? "✅ OK" : "❌ Wykroczenia"}</strong><br />
                            {point.control_date ? point.control_date.toLocaleString() : "No control date"}<br />
                            <strong>Zezwolenie: </strong>{point.license_number ? `${point.license_number}` : "Brak"}<br />
                            <strong>Strażnik: </strong>{point.controller_name ? `${point.controller_name}` : "Brak"}<br />
                            <strong>ID: </strong>{point.controller_name ? `${point.controller_email}` : "Brak"}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};
