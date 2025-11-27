import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/ranger_logo.jpg";
import "../style/auth.css";
import { QRCodeSVG } from "qrcode.react";
import { collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../config/firebase";

export const Auth = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [qrCode, setQrCode] = useState("");
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    useEffect(() => {
        if (currentUser) {
            navigate("/dashboard");
        }
    }, [currentUser, navigate]);

    const login = async () => {
        setError("");
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate("/dashboard");
        } catch (err) {
            setError("Podano błędne dane logowania.");
        }
    };

    const generateQR = async () => {
        const random = Math.floor(1000 + Math.random() * 9000);
        const qrCode = `GRUPA_${random}`;
        const today = new Date().toISOString().slice(0, 10); 

        // Sprawdź, czy taki kod już istnieje dziś
        const q = query(
            collection(db, "patrol_codes"),
            where("code", "==", qrCode),
            where("date", "==", today)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Kod już istnieje, spróbuj ponownie
            return generateQR();
        } else {
            // Zapisz nowy kod do bazy
            await addDoc(collection(db, "patrol_codes"), {
                code: qrCode,
                date: today,
                createdAt: Timestamp.now()
            });
            setQrCode(qrCode);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-content">
                <img src={logo} alt="Logo" className="auth-logo" />
                <div className="auth-box">
                    <h1>Zaloguj się</h1>
                    <input
                        className="auth-input"
                        placeholder="Email..."
                        type="email"
                        onChange={(e) => setEmail(e.target.value)} />
                    <input
                        className="auth-input"
                        placeholder="Hasło..."
                        type="password"
                        onChange={(e) => setPassword(e.target.value)} />
                    {error && <p className="error-message">{error}</p>}
                    <button className="auth-button" onClick={login}>Zaloguj się</button>
                    <button className="auth-button" onClick={generateQR}>Generuj patrol</button>
                </div>                    
                    {qrCode && (
                        <div className="auth-content">
                            <div style={{ marginTop: 24, textAlign: "center" }}>
                                <QRCodeSVG value={qrCode} size={180} />
                                <div style={{ marginTop: 8, fontSize: 16 }}>{qrCode}</div>
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );
};
