import { useFilters } from "../context/FiltersContext";

const Filters = ({ data, style, downloadCSV, showDownloadButton = true }) => {
    const { dateFilter, setDateFilter, clubFilter, setClubFilter, statusFilter, setStatusFilter } = useFilters();

    return (
        <div className="filter-container" style={style}>
            <label>Według daty: </label>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                <option value="all">Wszystkie</option>
                <option value="lastWeek">Ostatni tydzień</option>
                <option value="lastMonth">Ostatni miesiąc</option>
            </select>

            <label>Według koła: </label>
            <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
                <option value="all">Wszystkie</option>
                {[...new Set(data.map(item => item.association_club_name))].map((club, index) => (
                    <option key={index} value={club}>{club}</option>
                ))}
            </select>

            <label>Według statusu: </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Wszystkie</option>
                <option value="rejected">Tylko odrzucone</option>
            </select>

            {showDownloadButton && (
                <button onClick={downloadCSV} className="download-btn">Pobierz CSV</button>
            )}
        </div>
    );
};

export default Filters;
