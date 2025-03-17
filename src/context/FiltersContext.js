import { createContext, useContext, useState } from "react";

const FiltersContext = createContext();

export const FiltersProvider = ({ children }) => {
    const [dateFilter, setDateFilter] = useState("all");
    const [clubFilter, setClubFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    return (
        <FiltersContext.Provider value={{ 
            dateFilter, setDateFilter, 
            clubFilter, setClubFilter, 
            statusFilter, setStatusFilter 
        }}>
            {children}
        </FiltersContext.Provider>
    );
};

export const useFilters = () => useContext(FiltersContext);
