import React, { createContext, useState, useContext } from 'react';

const FilterContext = createContext();

export const useFilters = () => useContext(FilterContext);

export const FilterProvider = ({ children }) => {
  const [dateFilter, setDateFilter] = useState("lastWeek");
  const [clubFilter, setClubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");

  const resetFilters = () => {
    setDateFilter("lastWeek");
    setClubFilter("all");
    setStatusFilter("all");
    setCustomStartDate("");
  };

  const value = {
    dateFilter,
    setDateFilter,
    clubFilter,
    setClubFilter,
    statusFilter,
    setStatusFilter,
    customStartDate,
    setCustomStartDate,
    resetFilters,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};
