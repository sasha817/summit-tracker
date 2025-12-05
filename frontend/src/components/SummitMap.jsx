import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDate } from '../utils/dateUtils';

// Custom mountain icon
const mountainIcon = new L.DivIcon({
  className: 'custom-marker',
  html: `
    <div style="
      background: #667eea; 
      width: 32px; 
      height: 32px; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      border: 3px solid white; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      <svg style="width: 18px; height: 18px; color: white;" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
      </svg>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Component to handle map bounds updates
function MapBoundsHandler({ summits, selectedId }) {
  const map = useMap();

  useEffect(() => {
    if (summits.length > 0) {
      const bounds = summits.map((s) => [s.latitude, s.longitude]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [summits, map]);

  useEffect(() => {
    if (selectedId) {
      const summit = summits.find((s) => s.id === selectedId);
      if (summit) {
        map.setView([summit.latitude, summit.longitude], 13, {
          animate: true,
        });
      }
    }
  }, [selectedId, summits, map]);

  return null;
}

function SummitMap({ summits, selectedId, onSelectSummit }) {
  const mapRef = useRef(null);

  return (
    <div className="map-container">
      <MapContainer
        center={[47.5, 11.5]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution='Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
          maxZoom={17}
        />

        {summits.map((summit) => (
          <Marker
            key={summit.id}
            position={[summit.latitude, summit.longitude]}
            icon={mountainIcon}
            eventHandlers={{
              click: () => onSelectSummit(summit.id),
            }}
          >
            <Popup>
              <div className="popup-content">
                <div className="popup-title">{summit.name}</div>
                <div className="popup-info">
                  {summit.elevation && (
                    <div>⛰️ {summit.elevation} m</div>
                  )}
                  {summit.lastVisited && (
                    <div>📅 Letzter Besuch: {formatDate(summit.lastVisited)}</div>
                  )}
                  {summit.visitCount !== undefined && (
                    <div>🔢 {summit.visitCount} {summit.visitCount === 1 ? 'Besuch' : 'Besuche'}</div>
                  )}
                  <div>
                    📍 {summit.latitude.toFixed(4)}, {summit.longitude.toFixed(4)}
                  </div>
                  {summit.wikipedia && (
                    <div>
                      📖{' '}
                      <a
                        href={`https://en.wikipedia.org/wiki/${summit.wikipedia.replace('en:', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Wikipedia
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapBoundsHandler summits={summits} selectedId={selectedId} />
      </MapContainer>
    </div>
  );
}

export default SummitMap;