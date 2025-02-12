import { auth } from "../config/firebase";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import '../App.css';

export const Dashboard = () => {
    const navigate = useNavigate();

    const logout = async () => {
        try {
            await signOut(auth);
            navigate("/");
        } catch (err) {
            console.error(err);
        }        
    };

    useEffect(() => {
        if (!auth.currentUser) {
            navigate("/");
        }
    }, [auth.currentUser, navigate]);

    return (
        <div>
            <h1>Welcome to the Dashboard</h1>
            <p>User: {auth?.currentUser?.email}</p>
            <button onClick={logout}>Logout</button>
        </div>
    );
};
