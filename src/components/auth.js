import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import "../style/auth.css"; 

export const Auth = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    console.log(auth?.currentUser?.email);

    const login = async () => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate("/dashboard");
        } catch (err) {
            setError("Podano błędne dane logowania.");
        }        
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1>Zaloguj się</h1>
                <input 
                    className="auth-input"
                    placeholder="Email..." 
                    type="email"
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input 
                    className="auth-input"
                    placeholder="Hasło..."
                    type="password"
                    onChange={(e) => setPassword(e.target.value)}
                />
                {error && <p className="error-message">{error}</p>}
                <button className="auth-button" onClick={login}>Zaloguj się</button>
            </div>
        </div>
    );
};
