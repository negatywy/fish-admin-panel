import React, { createContext, useContext, useState } from 'react';

const FilterContext = createContext();

export const useFilterContext = () => {
    return useContext(FilterContext);
};

export const FilterProvider = ({ children }) => {
    const [filteredData, setFilteredData] = useState([]);

    const updateFilteredData = (data) => {
        setFilteredData(data);
    };

    return (
        <FilterContext.Provider value={{ filteredData, updateFilteredData }}>
            {children}
        </FilterContext.Provider>
    );
};
