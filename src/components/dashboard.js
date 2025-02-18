import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { SidebarMenu } from "./SidebarMenu";
import { DataTable } from "./DataTable";
import { OtherComponent } from "./OtherComponent";
import "../style/App.css";
import "../style/table.css";

export const Dashboard = () => {
    const navigate = useNavigate();
    const [activeComponent, setActiveComponent] = useState("dataTable");

    useEffect(() => {
        if (!auth.currentUser) {
            navigate("/");
        }
    }, [navigate]);

    return (
        <div className="dashboard-container">
            <SidebarMenu setActiveComponent={setActiveComponent} />
            <div className="main-content">
                <h1>Dashboard</h1>
                <p>Użytkownik: {auth?.currentUser?.email}</p>
                {activeComponent === "dataTable" && <DataTable />}
                {activeComponent === "otherComponent" && <OtherComponent />}
            </div>
        </div>
    );
};
