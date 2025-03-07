import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "../style/App.css";
import { db } from "../config/firebase";
import { collection, getDocs } from "firebase/firestore";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow
});

const redIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: markerShadow
});

export const ControlMap = () => {
    const [points, setPoints] = useState([]);

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
                        is_success: data.is_success ?? false
                    };
                });

                console.log("Fetched points:", fetchedPoints);

                // Remove any points with null latitude or longitude
                const validPoints = fetchedPoints.filter(point => point.lat !== null && point.lng !== null);

                setPoints(validPoints);
            } catch (error) {
                console.error("Error fetching map data:", error);
            }
        };

        fetchPoints();
    }, []);

    return (
        <MapContainer center={[52.4461, 21.0302]} zoom={10} className="map-container">
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            />
            {points.map(point => (
                <Marker 
                    key={point.id} 
                    position={[point.lat, point.lng]} 
                    icon={point.is_success ? defaultIcon : redIcon} 
                >
                    <Popup>
                        <strong>{point.is_success ? "✅ Successful" : "❌ Rejected"}</strong><br />
                        {point.control_date ? point.control_date.toLocaleString() : "No control date"}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
};
