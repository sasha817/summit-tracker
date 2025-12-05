import React, { useState, useEffect } from 'react';
import SummitForm from './components/SummitForm';
import SummitList from './components/SummitList';
import SummitMap from './components/SummitMap';
import { summitAPI, visitAPI } from './services/api';
import './App.css';

function App() {
  const [summits, setSummits] = useState([]);
  const [selectedSummitId, setSelectedSummitId] = useState(null);
  const [summitVisits, setSummitVisits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingData, setEditingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load summits on mount
  useEffect(() => {
    loadSummits();
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

  const loadSummitVisits = async (summitId) => {
    try {
      const data = await visitAPI.getAll({ summitId });
      setSummitVisits(data);
    } catch (err) {
      console.error('Failed to load visits:', err);
      setSummitVisits([]);
    }
  };

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
        // Reload summits to get updated visit counts
        await loadSummits();
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
          {summits.length} {summits.length === 1 ? 'Gipfel' : 'Gipfel'} besucht
        </div>
      </header>

      <main className="main-content">
        <div className="left-panel">
          <div className="panel">
            <h2 className="panel-title">Deine Gipfel</h2>

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
              summits={summits}
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
            summits={summits}
            selectedId={selectedSummitId}
            onSelectSummit={setSelectedSummitId}
          />
        </div>
      </main>
    </div>
  );
}

export default App;