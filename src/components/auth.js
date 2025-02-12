import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

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
            setError("Invalid email or password. Please try again.");
        }        
    };

    return (
        <div>
            <input 
                placeholder="Email..." 
                onChange={(e) => setEmail(e.target.value)}
            />
            <input 
                placeholder="Password..."
                type="password"
                onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p style={{ color: "red" }}>{error}</p>}
            <button onClick={login}>Login</button>
        </div>
    );
};
