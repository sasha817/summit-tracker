import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDate } from '../utils/dateUtils';
import { getTileUrl, getMapStyle, MAPTILER_CONFIG } from '../config/maptiler';

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

// Component to track and update zoom level
function ZoomTracker({ onZoomChange }) {
  const map = useMap();

  useEffect(() => {
    // Set initial zoom
    onZoomChange(map.getZoom());

    // Listen for zoom changes
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };

    map.on('zoomend', handleZoom);

    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

// Component to handle map tile layer updates
function TileLayerUpdater({ mapStyle }) {
  const map = useMap();
  
  useEffect(() => {
    // Force re-render of tiles when style changes
    map.invalidateSize();
  }, [mapStyle, map]);
  
  return null;
}

// Component to handle map bounds updates
function MapBoundsHandler({ summits, selectedId, zoomLevel }) {
  const map = useMap();

  useEffect(() => {
    if (summits.length > 0 && !selectedId) {
      const bounds = summits.map((s) => [s.latitude, s.longitude]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [summits, map, selectedId]);

  useEffect(() => {
    if (selectedId) {
      const summit = summits.find((s) => s.id === selectedId);
      if (summit) {
        map.setView([summit.latitude, summit.longitude], zoomLevel, {
          animate: true,
          duration: 0.5,
        });
      }
    }
  }, [selectedId, summits, map, zoomLevel]);

  return null;
}

function SummitMap({ summits, selectedId, onSelectSummit }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyle, setMapStyle] = useState(MAPTILER_CONFIG.defaultStyle);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(6);
  const [selectionZoom, setSelectionZoom] = useState(14); // Default zoom when selecting summit

  const currentStyle = getMapStyle(mapStyle);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Listen for fullscreen changes (e.g., ESC key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Get zoom level description
  const getZoomDescription = (zoom) => {
    if (zoom <= 6) return 'Region';
    if (zoom <= 9) return 'Area';
    if (zoom <= 11) return 'Valley';
    if (zoom <= 13) return 'Mountain';
    if (zoom <= 15) return 'Peak';
    if (zoom <= 17) return 'Trail';
    return 'Detail';
  };

  return (
    <div className="map-container" ref={containerRef}>
      {/* Fullscreen Button */}
      <button 
        className="map-fullscreen-btn"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Vollbild beenden (ESC)' : 'Vollbild'}
      >
        {isFullscreen ? '✕' : '⛶'}
      </button>
      
      {/* Map Style Selector */}
      <div className="map-style-selector">
        <button 
          className="map-style-btn"
          onClick={() => setShowStyleSelector(!showStyleSelector)}
          title="Kartenstil ändern"
        >
          🗺️ {currentStyle.name}
        </button>
        
        {showStyleSelector && (
          <div className="map-style-dropdown">
            {Object.entries(MAPTILER_CONFIG.styles).map(([key, style]) => (
              <button
                key={key}
                className={`map-style-option ${mapStyle === key ? 'active' : ''}`}
                onClick={() => {
                  setMapStyle(key);
                  setShowStyleSelector(false);
                }}
              >
                {style.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zoom Info Display */}
      <div className="map-zoom-info">
        <div className="zoom-level">
          Zoom: {currentZoom.toFixed(1)}
        </div>
        <div className="zoom-description">
          {getZoomDescription(currentZoom)}
        </div>
      </div>

      {/* Selection Zoom Control */}
      <div className="map-selection-zoom">
        <label className="zoom-label">
          Auswahl-Zoom:
        </label>
        <div className="zoom-controls">
          <button
            className="zoom-btn"
            onClick={() => setSelectionZoom(Math.max(10, selectionZoom - 1))}
            disabled={selectionZoom <= 10}
            title="Weniger Zoom bei Auswahl"
          >
            −
          </button>
          <span className="zoom-value">{selectionZoom}</span>
          <button
            className="zoom-btn"
            onClick={() => setSelectionZoom(Math.min(18, selectionZoom + 1))}
            disabled={selectionZoom >= 18}
            title="Mehr Zoom bei Auswahl"
          >
            +
          </button>
        </div>
        <div className="zoom-preset-btns">
          <button
            className={`zoom-preset ${selectionZoom === 12 ? 'active' : ''}`}
            onClick={() => setSelectionZoom(12)}
            title="Übersicht"
          >
            Übersicht
          </button>
          <button
            className={`zoom-preset ${selectionZoom === 14 ? 'active' : ''}`}
            onClick={() => setSelectionZoom(14)}
            title="Standard"
          >
            Standard
          </button>
          <button
            className={`zoom-preset ${selectionZoom === 16 ? 'active' : ''}`}
            onClick={() => setSelectionZoom(16)}
            title="Nah"
          >
            Nah
          </button>
        </div>
      </div>
      
      <MapContainer
        center={[47.5, 11.5]}
        zoom={6}
        maxZoom={currentStyle.maxZoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          key={mapStyle}
          url={getTileUrl(mapStyle)}
          attribution={currentStyle.attribution}
          maxZoom={currentStyle.maxZoom}
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

        <MapBoundsHandler summits={summits} selectedId={selectedId} zoomLevel={selectionZoom} />
        <TileLayerUpdater mapStyle={mapStyle} />
        <ZoomTracker onZoomChange={setCurrentZoom} />
      </MapContainer>
    </div>
  );
}

export default SummitMap;