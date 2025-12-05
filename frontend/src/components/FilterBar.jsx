import React from 'react';

function FilterBar({ filters, onFilterChange, availableYears }) {
  const seasons = [
    { value: '', label: 'Alle Jahreszeiten' },
    { value: 'spring', label: 'Frühling' },
    { value: 'summer', label: 'Sommer' },
    { value: 'autumn', label: 'Herbst' },
    { value: 'winter', label: 'Winter' }
  ];

  const handleSearchChange = (e) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const handleYearChange = (e) => {
    onFilterChange({ ...filters, year: e.target.value });
  };

  const handleSeasonChange = (e) => {
    onFilterChange({ ...filters, season: e.target.value });
  };

  const clearFilters = () => {
    onFilterChange({ search: '', year: '', season: '' });
  };

  const hasActiveFilters = filters.search || filters.year || filters.season;

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label htmlFor="search" className="filter-label">
          🔍 Suche
        </label>
        <input
          type="text"
          id="search"
          className="filter-input"
          placeholder="Gipfelname suchen..."
          value={filters.search}
          onChange={handleSearchChange}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="year" className="filter-label">
          📅 Jahr
        </label>
        <select
          id="year"
          className="filter-select"
          value={filters.year}
          onChange={handleYearChange}
        >
          <option value="">Alle Jahre</option>
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="season" className="filter-label">
          🍂 Jahreszeit
        </label>
        <select
          id="season"
          className="filter-select"
          value={filters.season}
          onChange={handleSeasonChange}
        >
          {seasons.map(season => (
            <option key={season.value} value={season.value}>
              {season.label}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          className="btn-clear-filters"
          onClick={clearFilters}
          title="Filter zurücksetzen"
        >
          ✕ Filter löschen
        </button>
      )}
    </div>
  );
}

export default FilterBar;