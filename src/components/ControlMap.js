import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "../style/App.css";
import { db } from "../config/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow
});

L.Marker.prototype.options.icon = DefaultIcon;

export const ControlMap = () => {
    const [points, setPoints] = useState([]);

    useEffect(() => {
        const fetchPoints = async () => {
            const querySnapshot = await getDocs(collection(db, "ssr_controls"));
            const fetchedPoints = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    control_date: data.control_date?.toDate() ?? null, 
                    lat: data.position?.latitude ?? null, 
                    lng: data.position?.longitude ?? null
                };
            });
            setPoints(fetchedPoints);
        };
        fetchPoints();
    }, []);

    return (
        <MapContainer center={[50.5382, 21.6541]} zoom={10} className="map-container">
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            />
            {points.map(point => (
                <Marker key={point.id} position={[point.lat, point.lng]}>
                    <Popup>{point.name || "Unnamed Point"}</Popup>
                </Marker>
            ))}
        </MapContainer>
    );
};
