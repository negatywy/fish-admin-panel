import React from 'react';
import { useFilters } from '../context/FilterContext';

export const Filters = ({ data, style, downloadCSV, showDownloadButton = true }) => {
    const { dateFilter, setDateFilter, clubFilter, setClubFilter, statusFilter, setStatusFilter, customStartDate, setCustomStartDate } = useFilters();

    return (
        <div className="filter-container" style={style}>
            <label>Według daty: </label>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                <option value="previousYear">Poprzedni rok</option>
                <option value="lastWeek">Ostatni tydzień</option>
                <option value="currentMonth">Bieżący miesiąc</option>
                <option value="previousMonth">Poprzedni miesiąc</option>
                <option value="currentYear">Bieżący rok</option>
                <option value="custom">Wybierz dzień</option>
            </select>
            {dateFilter === 'custom' && (
                <>
                    <label>Data: </label>
                    <input 
                        type="date" 
                        value={customStartDate} 
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </>
            )}

            <label title="Nr. Koła osoby kontrolowanej">Według koła: </label>
            <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
                <option value="all">Wszystkie</option>
                {[...new Set(data.map(item => item.association_club_name))].map((club, index) => (
                    <option key={index} value={club}>{club}</option>
                ))}
            </select>

            <label>Według statusu: </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Wszystkie</option>
                <option value="rejected">Tylko wykroczenia</option>
            </select>

            {showDownloadButton && (
                <button onClick={downloadCSV} className="default-btn">Pobierz CSV</button>
            )}
        </div>
    );
};
