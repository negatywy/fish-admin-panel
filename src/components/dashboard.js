import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { SidebarMenu } from "./SidebarMenu";
import { DataTable } from "./DataTable";
import { ControlMap } from "./ControlMap";
import { StatsCharts } from "./StatsCharts";
import { RangerStats } from "./RangerStats";
import "../style/App.css";
import "../style/table.css";
import { Menu, MenuItem, Button } from "@mui/material";

export const Dashboard = () => {
    const navigate = useNavigate();
    const [activeComponent, setActiveComponent] = useState("dataTable");
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    useEffect(() => {
        if (!auth.currentUser) {
            navigate("/");
        }
    }, [navigate]);

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        auth.signOut().then(() => navigate("/"));
    };

    return (
        <div className="dashboard-container">
            <SidebarMenu setActiveComponent={setActiveComponent} />
            <div className="main-content">
                <div className="topbar">
                    <Button onClick={handleMenuOpen} className="user-button">
                        {auth?.currentUser?.email}
                    </Button>
                    <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
                        <MenuItem onClick={handleMenuClose}>Szczegóły profilu</MenuItem>
                        <MenuItem onClick={handleLogout}>Wyloguj</MenuItem>
                    </Menu>
                </div>
                {activeComponent === "dataTable" && <DataTable />}
                {activeComponent === "controlMap" && <ControlMap />}
                {activeComponent === "statsCharts" && <StatsCharts />}
                {activeComponent === "rangerStats" && <RangerStats />}
            </div>
        </div>
    );
};
