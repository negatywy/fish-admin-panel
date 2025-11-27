import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../config/firebase";
import { SidebarMenu } from "./SidebarMenu";
import { DataTable } from "./DataTable";
import { ControlMap } from "./ControlMap";
import { StatsCharts } from "./StatsCharts";
import { RangerStats } from "./RangerStats";
import UserManagement from "./UserManagement";
import { Konfigurator } from "./Konfigurator";
import { useFilters } from "../context/FilterContext";
import "../style/App.css";
import "../style/table.css";
import { Menu, MenuItem, Button } from "@mui/material";

export const Dashboard = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [activeComponent, setActiveComponent] = useState("dataTable");
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const { resetFilters } = useFilters();

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        resetFilters(); 
        auth.signOut().then(() => navigate("/"));
    };

    return (
        <div className="dashboard-container">
            <SidebarMenu setActiveComponent={setActiveComponent} />
            <div className="main-content">
                <div className="topbar">
                    <Button onClick={handleMenuOpen} className="user-button">
                        {currentUser?.email}
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
                {activeComponent === "userManagement" && <UserManagement />}
                {activeComponent === "konfigurator" && <Konfigurator />}
            </div>
        </div>
    );
};
