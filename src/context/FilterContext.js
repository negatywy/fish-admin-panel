import React, { createContext, useState, useContext } from 'react';

const FilterContext = createContext();

export const useFilters = () => useContext(FilterContext);

export const FilterProvider = ({ children }) => {
  const [dateFilter, setDateFilter] = useState("all");
  const [clubFilter, setClubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const resetFilters = () => {
    setDateFilter("all");
    setClubFilter("all");
    setStatusFilter("all");
  };

  const value = {
    dateFilter,
    setDateFilter,
    clubFilter,
    setClubFilter,
    statusFilter,
    setStatusFilter,
    resetFilters,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};
