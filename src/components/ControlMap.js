import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "../style/App.css";
import { db } from "../config/firebase";
import { collection, getDocs } from "firebase/firestore";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Filters } from "./Filters";
import { useFilters } from "../context/FilterContext";

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
                const fetchedPoints = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        control_date: data.control_date?.toDate() ?? null,
                        lat: data.position?.latitude ?? null,
                        lng: data.position?.longitude ?? null,
                        is_success: data.is_success ?? false,
                        association_club_name: data.association_club_name ?? ""
                    };
                });

                const validPoints = fetchedPoints.filter(point => point.lat !== null && point.lng !== null);

                setPoints(validPoints);
            } catch (error) {
                console.error("Error fetching map data:", error);
            }
        };

        fetchPoints();
    }, []);

    useEffect(() => {
        let filtered = [...points];

        if (dateFilter !== "all") {
            const now = new Date();
            filtered = filtered.filter(point => {
                if (!point.control_date) return false;
                const diffTime = now - point.control_date;
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                return dateFilter === "lastWeek" ? diffDays <= 7 : diffDays <= 30;
            });
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
                style={{margin: "10px 0"}}
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
                            {point.control_date ? point.control_date.toLocaleString() : "No control date"}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};
