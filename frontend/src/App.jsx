import React, { useState, useEffect } from 'react';
import SummitForm from './components/SummitForm';
import SummitList from './components/SummitList';
import SummitMap from './components/SummitMap';
import FilterBar from './components/FilterBar';
import GpxAnalyzer from './components/GpxAnalyzer';
import { summitAPI, visitAPI, statsAPI } from './services/api';
import './App.css';

function App() {
  const [summits, setSummits] = useState([]);
  const [allVisits, setAllVisits] = useState([]);
  const [selectedSummitId, setSelectedSummitId] = useState(null);
  const [summitVisits, setSummitVisits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingData, setEditingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ search: '', year: '', season: '' });
  const [availableYears, setAvailableYears] = useState([]);
  const [showGpxAnalyzer, setShowGpxAnalyzer] = useState(false);

  // Load summits on mount
  useEffect(() => {
    loadSummits();
    loadAllVisits();
    loadStats();
  }, []);

  // Load visits when a summit is selected
  useEffect(() => {
    if (selectedSummitId) {
      loadSummitVisits(selectedSummitId);
    } else {
      setSummitVisits([]);
    }
  }, [selectedSummitId]);

  const loadSummits = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await summitAPI.getAll();
      setSummits(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load summits:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllVisits = async () => {
    try {
      const data = await visitAPI.getAll();
      setAllVisits(data);
    } catch (err) {
      console.error('Failed to load all visits:', err);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await statsAPI.get();
      setAvailableYears(stats.years || []);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadSummitVisits = async (summitId) => {
    try {
      const data = await visitAPI.getAll({ summitId });
      setSummitVisits(data);
    } catch (err) {
      console.error('Failed to load visits:', err);
      setSummitVisits([]);
    }
  };

  // Filter summits based on current filters
  const getFilteredSummits = () => {
    let filtered = [...summits];

    // Filter by search term (summit name)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(summit =>
        summit.name.toLowerCase().includes(searchLower)
      );
    }

    // Filter by year or season (check ALL visits for each summit)
    if (filters.year || filters.season) {
      filtered = filtered.filter(summit => {
        // Get all visits for this summit
        const summitVisitsList = allVisits.filter(v => v.summitId === summit.id);
        
        if (summitVisitsList.length === 0) return false;

        // Check if ANY visit matches the criteria
        return summitVisitsList.some(visit => {
          const visitDate = new Date(visit.date);
          
          // Check year
          if (filters.year) {
            const visitYear = visitDate.getFullYear();
            if (visitYear !== parseInt(filters.year)) {
              return false;
            }
          }

          // Check season
          if (filters.season) {
            const month = visitDate.getMonth() + 1; // 1-12
            const seasons = {
              spring: [3, 4, 5],
              summer: [6, 7, 8],
              autumn: [9, 10, 11],
              winter: [12, 1, 2]
            };
            if (!seasons[filters.season]?.includes(month)) {
              return false;
            }
          }

          return true;
        });
      });
    }

    return filtered;
  };

  const filteredSummits = getFilteredSummits();

  const handleAddSummit = async (summitData) => {
    try {
      if (formMode === 'edit-summit') {
        // Update existing summit
        const updatedSummit = await summitAPI.update(editingData.id, summitData);
        setSummits((prev) =>
          prev.map((s) => (s.id === editingData.id ? { ...s, ...updatedSummit } : s))
        );
      } else if (formMode === 'add-visit') {
        // Add new visit to existing summit
        await visitAPI.create({
          summitId: editingData.summitId,
          date: summitData.date,
          notes: summitData.notes
        });
        // Reload to get updated visit counts
        await loadSummits();
        if (selectedSummitId) {
          await loadSummitVisits(selectedSummitId);
        }
      } else {
        // Create new summit with visit
        await summitAPI.createWithVisit(summitData);
        // Reload summits and visits to get updated data
        await loadSummits();
        await loadAllVisits();
      }
      setShowForm(false);
      setEditingData(null);
      setFormMode('create');
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  };

  const handleEditSummit = (id) => {
    const summit = summits.find((s) => s.id === id);
    if (summit) {
      setEditingData(summit);
      setFormMode('edit-summit');
      setShowForm(true);
    }
  };

  const handleAddVisit = (summitId) => {
    setEditingData({ summitId });
    setFormMode('add-visit');
    setShowForm(true);
  };

  const handleDeleteVisit = async (visitId) => {
    if (!window.confirm('Möchten Sie diesen Besuch wirklich löschen?')) {
      return;
    }

    try {
      await visitAPI.delete(visitId);
      // Reload summit visits and summit list to update visit counts
      await loadSummits();
      await loadAllVisits();
      if (selectedSummitId) {
        await loadSummitVisits(selectedSummitId);
      }
    } catch (err) {
      alert('Fehler beim Löschen des Besuchs: ' + err.message);
    }
  };

  const handleDeleteSummit = async (id) => {
    if (!window.confirm('Möchten Sie diesen Gipfel und alle Besuche wirklich löschen?')) {
      return;
    }

    try {
      await summitAPI.delete(id);
      setSummits((prev) => prev.filter((s) => s.id !== id));
      if (selectedSummitId === id) {
        setSelectedSummitId(null);
      }
    } catch (err) {
      alert('Fehler beim Löschen: ' + err.message);
    }
  };

  const handleExport = async () => {
    try {
      await summitAPI.export();
    } catch (err) {
      alert('Fehler beim Exportieren: ' + err.message);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedSummits = JSON.parse(e.target.result);
        await summitAPI.import(importedSummits, 'replace');
        await loadSummits();
        alert(`${importedSummits.length} Gipfel erfolgreich importiert!`);
      } catch (err) {
        alert('Fehler beim Importieren: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handlePeaksDetected = async (peaks) => {
    setShowGpxAnalyzer(false);
    
    // Query OSM for each detected peak
    const peaksWithOsmData = [];
    const peaksWithoutOsmData = [];
    
    for (const peak of peaks) {
      try {
        // Query OSM using the same logic as in SummitForm
        const radius = 100;
        const query = `
          [out:json];
          (
            node["natural"="peak"](around:${radius},${peak.lat},${peak.lon});
            node["natural"="volcano"](around:${radius},${peak.lat},${peak.lon});
          );
          out body;
        `;
        
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.elements && data.elements.length > 0) {
            const osmPeak = data.elements[0];
            peaksWithOsmData.push({
              name: osmPeak.tags?.name || `Gipfel ${peaksWithOsmData.length + 1}`,
              latitude: osmPeak.lat,
              longitude: osmPeak.lon,
              elevation: osmPeak.tags?.ele || peak.ele,
              wikipedia: osmPeak.tags?.wikipedia || null,
              fromGpx: true,
              gpxData: peak // Keep original GPX data for reference
            });
          } else {
            // No OSM data found
            peaksWithoutOsmData.push(peak);
          }
        } else {
          peaksWithoutOsmData.push(peak);
        }
      } catch (err) {
        console.error('Error querying OSM for peak:', err);
        peaksWithoutOsmData.push(peak);
      }
    }
    
    // Log peaks without OSM data for future download feature
    if (peaksWithoutOsmData.length > 0) {
      console.log('Peaks without OSM data (for download):', peaksWithoutOsmData);
      alert(`${peaksWithoutOsmData.length} Gipfel ohne OSM-Daten gefunden. Diese werden übersprungen.\n(Funktion zum Download der Daten kommt bald)`);
    }
    
    if (peaksWithOsmData.length === 0) {
      alert('Keine Gipfel mit OSM-Daten gefunden');
      return;
    }
    
    // Show summary and ask for confirmation
    const message = `${peaksWithOsmData.length} Gipfel mit OSM-Daten gefunden:\n\n` +
      peaksWithOsmData.map((p, i) => `${i + 1}. ${p.name} (${p.elevation}m)`).join('\n') +
      '\n\nMöchten Sie diese Gipfel hinzufügen? (Besuchsdatum wird noch abgefragt)';
    
    if (window.confirm(message)) {
      // TODO: Open form for each peak to add visit date
      alert('Funktion zum Hinzufügen der Gipfel kommt im nächsten Schritt!');
      console.log('Peaks to add:', peaksWithOsmData);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Gipfel werden geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Fehler beim Laden der Gipfel</h2>
        <p>{error}</p>
        <button onClick={loadSummits} className="btn btn-primary">
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="title">
            <svg
              className="title-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3l7 7-7 7V3zm9 0l7 7-7 7V3z"
              />
            </svg>
            <h1>Summit Tracker</h1>
          </div>
          <div className="controls">
            <button
              className="btn btn-primary"
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                  setEditingData(null);
                  setFormMode('create');
                } else {
                  setFormMode('create');
                  setEditingData(null);
                  setShowForm(true);
                }
              }}
            >
              {showForm ? 'Abbrechen' : '+ Gipfel hinzufügen'}
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowGpxAnalyzer(true)}
            >
              📊 GPX analysieren
            </button>
            <button className="btn btn-secondary" onClick={handleExport}>
              Exportieren
            </button>
            <label className="btn btn-secondary">
              Importieren
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
        <div className="stats">
          {filteredSummits.length} von {summits.length} {summits.length === 1 ? 'Gipfel' : 'Gipfel'}
          {filters.search || filters.year || filters.season ? ' (gefiltert)' : ''}
        </div>
      </header>

      <main className="main-content">
        <div className="left-panel">
          <div className="panel">
            <h2 className="panel-title">Deine Gipfel</h2>

            <FilterBar
              filters={filters}
              onFilterChange={setFilters}
              availableYears={availableYears}
            />

            {showForm && (
              <div className="form-container">
                <SummitForm
                  onSubmit={handleAddSummit}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingData(null);
                    setFormMode('create');
                  }}
                  initialData={editingData}
                  mode={formMode}
                />
              </div>
            )}

            <SummitList
              summits={filteredSummits}
              selectedId={selectedSummitId}
              onSelect={setSelectedSummitId}
              onDelete={handleDeleteSummit}
              onEdit={handleEditSummit}
              onAddVisit={handleAddVisit}
              onDeleteVisit={handleDeleteVisit}
              summitVisits={summitVisits}
              onLocate={(id) => {
                setSelectedSummitId(id);
              }}
            />
          </div>
        </div>

        <div className="right-panel">
          <SummitMap
            summits={filteredSummits}
            selectedId={selectedSummitId}
            onSelectSummit={setSelectedSummitId}
          />
        </div>
      </main>

      {showGpxAnalyzer && (
        <GpxAnalyzer
          onPeaksDetected={handlePeaksDetected}
          onClose={() => setShowGpxAnalyzer(false)}
        />
      )}
    </div>
  );
}

export default App;