import React, { useState, useEffect } from 'react';
import SummitForm from './components/SummitForm';
import SummitList from './components/SummitList';
import SummitMap from './components/SummitMap';
import { summitAPI } from './services/api';
import './App.css';

function App() {
  const [summits, setSummits] = useState([]);
  const [selectedSummitId, setSelectedSummitId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSummit, setEditingSummit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load summits on mount
  useEffect(() => {
    loadSummits();
  }, []);

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

  const handleAddSummit = async (summitData) => {
    try {
      if (editingSummit) {
        // Update existing summit
        const updatedSummit = await summitAPI.update(editingSummit.id, summitData);
        setSummits((prev) =>
          prev.map((s) => (s.id === editingSummit.id ? updatedSummit : s))
        );
        setEditingSummit(null);
      } else {
        // Create new summit
        const newSummit = await summitAPI.create(summitData);
        setSummits((prev) => [newSummit, ...prev]);
        setSelectedSummitId(newSummit.id);
      }
      setShowForm(false);
    } catch (err) {
      alert(`Failed to ${editingSummit ? 'update' : 'add'} summit: ` + err.message);
    }
  };

  const handleEditSummit = (id) => {
    const summit = summits.find((s) => s.id === id);
    if (summit) {
      setEditingSummit(summit);
      setShowForm(true);
    }
  };

  const handleDeleteSummit = async (id) => {
    if (!window.confirm('Are you sure you want to delete this summit?')) {
      return;
    }

    try {
      await summitAPI.delete(id);
      setSummits((prev) => prev.filter((s) => s.id !== id));
      if (selectedSummitId === id) {
        setSelectedSummitId(null);
      }
    } catch (err) {
      alert('Failed to delete summit: ' + err.message);
    }
  };

  const handleExport = async () => {
    try {
      await summitAPI.export();
    } catch (err) {
      alert('Failed to export: ' + err.message);
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
        alert(`Successfully imported ${importedSummits.length} summits!`);
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading summits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Error Loading Summits</h2>
        <p>{error}</p>
        <button onClick={loadSummits} className="btn btn-primary">
          Retry
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
                if (showForm && editingSummit) {
                  setEditingSummit(null);
                }
                setShowForm(!showForm);
              }}
            >
              {showForm ? 'Cancel' : '+ Add Summit'}
            </button>
            <button className="btn btn-secondary" onClick={handleExport}>
              Export
            </button>
            <label className="btn btn-secondary">
              Import
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
          {summits.length} {summits.length === 1 ? 'summit' : 'summits'} visited
        </div>
      </header>

      <main className="main-content">
        <div className="left-panel">
          <div className="panel">
            <h2 className="panel-title">Your Summits</h2>

            {showForm && (
              <div className="form-container">
                <SummitForm
                  onSubmit={handleAddSummit}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingSummit(null);
                  }}
                  initialData={editingSummit}
                />
              </div>
            )}

            <SummitList
              summits={summits}
              selectedId={selectedSummitId}
              onSelect={setSelectedSummitId}
              onDelete={handleDeleteSummit}
              onEdit={handleEditSummit}
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