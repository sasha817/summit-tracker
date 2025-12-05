import React from 'react';
import { formatDate } from '../utils/dateUtils';

function VisitList({ visits, onDeleteVisit }) {
  if (!visits || visits.length === 0) {
    return (
      <div className="visit-empty">
        <p>Keine Besuche vorhanden</p>
      </div>
    );
  }

  return (
    <div className="visit-list">
      <h4 className="visit-list-title">Besuche ({visits.length})</h4>
      {visits.map((visit) => (
        <div key={visit.id} className="visit-item">
          <div className="visit-info">
            <div className="visit-date">
              📅 {formatDate(visit.date)}
            </div>
            {visit.notes && (
              <div className="visit-notes">
                💭 {visit.notes}
              </div>
            )}
          </div>
          <button
            className="btn-small btn-delete-visit"
            onClick={() => onDeleteVisit(visit.id)}
            title="Besuch löschen"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default VisitList;