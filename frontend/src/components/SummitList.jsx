import React from 'react';
import { formatDate } from '../utils/dateUtils';
import VisitList from './VisitList';

function SummitList({ summits, selectedId, onSelect, onDelete, onLocate, onEdit, onAddVisit, summitVisits, onDeleteVisit }) {
  if (summits.length === 0) {
    return (
      <div className="empty-state">
        <svg
          className="empty-icon"
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
        <p>No summits yet. Start tracking your adventures!</p>
      </div>
    );
  }

  return (
    <div className="summit-list">
      {summits.map((summit) => (
        <div key={summit.id}>
          <div
            className={`summit-card ${selectedId === summit.id ? 'active' : ''}`}
            onClick={() => onSelect(summit.id)}
          >
            <div className="summit-name">{summit.name}</div>
            <div className="summit-info">
              {summit.elevation && (
                <div className="info-item">
                  <span className="icon">⛰️</span>
                  <span>{summit.elevation} m</span>
                </div>
              )}
              <div className="info-item">
                <span className="icon">📍</span>
                <span>
                  {summit.latitude.toFixed(6)}, {summit.longitude.toFixed(6)}
                </span>
              </div>
              {summit.lastVisited && (
                <div className="info-item">
                  <span className="icon">📅</span>
                  <span>Letzter Besuch: {formatDate(summit.lastVisited)}</span>
                </div>
              )}
              {summit.visitCount !== undefined && (
                <div className="info-item">
                  <span className="icon">🔢</span>
                  <span>{summit.visitCount} {summit.visitCount === 1 ? 'Besuch' : 'Besuche'}</span>
                </div>
              )}
              {summit.wikipedia && (
                <div className="info-item">
                  <span className="icon">📖</span>
                  <a
                    href={`https://en.wikipedia.org/wiki/${summit.wikipedia.replace('en:', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Wikipedia
                  </a>
                </div>
              )}
            </div>
            <div className="summit-actions">
              <button
                className="btn-small btn-visit"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddVisit(summit.id);
                }}
              >
                + Besuch
              </button>
              <button
                className="btn-small btn-edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(summit.id);
                }}
              >
                Bearbeiten
              </button>
              <button
                className="btn-small btn-locate"
                onClick={(e) => {
                  e.stopPropagation();
                  onLocate(summit.id);
                }}
              >
                Karte
              </button>
              <button
                className="btn-small btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(summit.id);
                }}
              >
                Löschen
              </button>
            </div>
          </div>
          
          {selectedId === summit.id && summitVisits && summitVisits.length > 0 && (
            <div className="visit-section">
              <VisitList 
                visits={summitVisits} 
                onDeleteVisit={onDeleteVisit}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default SummitList;