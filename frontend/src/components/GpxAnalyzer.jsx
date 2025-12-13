import React, { useState, useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTileUrl, getMapStyle } from '../config/maptiler';

// Fix for default marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function GpxAnalyzer({ onPeaksDetected, onClose }) {
  const [gpxData, setGpxData] = useState(null);
  const [detectedPeaks, setDetectedPeaks] = useState([]);
  const [selectedPeakIndices, setSelectedPeakIndices] = useState([]);
  const [hoveredPeakIndex, setHoveredPeakIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const plotRef = useRef(null);
  const mapRef = useRef(null);
  const [mapCenter, setMapCenter] = useState([47.2692, 11.4041]); // Default: Innsbruck area
  const [mapZoom, setMapZoom] = useState(13);
  const [settings, setSettings] = useState({
    stopSpeedThreshold: 0.5,
    clusterDistance: 50,
    clusterTimeGap: 5,  // Reduced from 15 - tighter temporal clustering
    minStopDuration: 1,  // Reduced from 3 - catch shorter summit stops
    prominenceRadius: 100,
    prominenceTimeWindow: 10,
    elevationPercentile: 80
  });

  const parseGPX = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(e.target.result, 'text/xml');
          
          const parseError = xmlDoc.querySelector('parsererror');
          if (parseError) {
            reject(new Error('Ungültige GPX-Datei'));
            return;
          }

          const trkpts = xmlDoc.querySelectorAll('trkpt');
          const points = [];

          trkpts.forEach((trkpt, index) => {
            const lat = parseFloat(trkpt.getAttribute('lat'));
            const lon = parseFloat(trkpt.getAttribute('lon'));
            const eleNode = trkpt.querySelector('ele');
            const timeNode = trkpt.querySelector('time');
            
            const ele = eleNode ? parseFloat(eleNode.textContent) : null;
            const time = timeNode ? new Date(timeNode.textContent) : null;

            points.push({
              index,
              lat,
              lon,
              ele,
              time,
              distance: 0,
              speed: 0
            });
          });

          // Calculate distance and speed
          let totalDistance = 0;
          for (let i = 1; i < points.length; i++) {
            const dist = calculateDistance(
              points[i - 1].lat,
              points[i - 1].lon,
              points[i].lat,
              points[i].lon
            );
            totalDistance += dist;
            points[i].distance = totalDistance;

            if (points[i].time && points[i - 1].time) {
              const timeDiff = (points[i].time - points[i - 1].time) / 1000;
              points[i].speed = timeDiff > 0 ? dist / timeDiff : 0;
            }
          }

          resolve(points);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
      reader.readAsText(file);
    });
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const detectStopBasedPeaks = (points) => {
    const { stopSpeedThreshold, clusterDistance, clusterTimeGap, minStopDuration,
            prominenceRadius, prominenceTimeWindow, elevationPercentile } = settings;

    // Step 1: Identify stop segments
    const stopSegments = [];
    let currentStop = null;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (point.speed < stopSpeedThreshold) {
        if (!currentStop) {
          currentStop = {
            startIndex: i,
            points: [point]
          };
        } else {
          currentStop.points.push(point);
        }
      } else {
        if (currentStop && currentStop.points.length >= 2) {
          stopSegments.push({
            ...currentStop,
            endIndex: i - 1,
            startTime: currentStop.points[0].time,
            endTime: currentStop.points[currentStop.points.length - 1].time,
            avgLat: currentStop.points.reduce((sum, p) => sum + p.lat, 0) / currentStop.points.length,
            avgLon: currentStop.points.reduce((sum, p) => sum + p.lon, 0) / currentStop.points.length,
            avgEle: currentStop.points.reduce((sum, p) => sum + (p.ele || 0), 0) / currentStop.points.length,
            maxEle: Math.max(...currentStop.points.map(p => p.ele || 0))
          });
        }
        currentStop = null;
      }
    }

    if (currentStop && currentStop.points.length >= 2) {
      stopSegments.push({
        ...currentStop,
        endIndex: points.length - 1,
        startTime: currentStop.points[0].time,
        endTime: currentStop.points[currentStop.points.length - 1].time,
        avgLat: currentStop.points.reduce((sum, p) => sum + p.lat, 0) / currentStop.points.length,
        avgLon: currentStop.points.reduce((sum, p) => sum + p.lon, 0) / currentStop.points.length,
        avgEle: currentStop.points.reduce((sum, p) => sum + (p.ele || 0), 0) / currentStop.points.length,
        maxEle: Math.max(...currentStop.points.map(p => p.ele || 0))
      });
    }

    // Step 2: Cluster nearby stops
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < stopSegments.length; i++) {
      if (used.has(i)) continue;

      const cluster = {
        segments: [stopSegments[i]],
        indices: [i]
      };
      used.add(i);

      for (let j = i + 1; j < stopSegments.length; j++) {
        if (used.has(j)) continue;

        const dist = calculateDistance(
          stopSegments[i].avgLat,
          stopSegments[i].avgLon,
          stopSegments[j].avgLat,
          stopSegments[j].avgLon
        );

        const timeDiff = Math.abs(stopSegments[j].startTime - stopSegments[i].endTime) / (1000 * 60);

        if (dist <= clusterDistance || timeDiff <= clusterTimeGap) {
          cluster.segments.push(stopSegments[j]);
          cluster.indices.push(j);
          used.add(j);
        }
      }

      const allPoints = cluster.segments.flatMap(s => s.points);
      const totalDuration = cluster.segments.reduce((sum, s) => {
        return sum + (s.endTime - s.startTime) / (1000 * 60);
      }, 0);

      if (totalDuration >= minStopDuration) {
        cluster.avgLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
        cluster.avgLon = allPoints.reduce((sum, p) => sum + p.lon, 0) / allPoints.length;
        cluster.avgEle = allPoints.reduce((sum, p) => sum + (p.ele || 0), 0) / allPoints.length;
        cluster.maxEle = Math.max(...allPoints.map(p => p.ele || 0));
        cluster.duration = totalDuration;
        cluster.startTime = cluster.segments[0].startTime;
        cluster.endTime = cluster.segments[cluster.segments.length - 1].endTime;
        
        clusters.push(cluster);
      }
    }

    // Step 3: Calculate prominence and score
    const elevations = points.map(p => p.ele || 0);
    const sortedElevations = [...elevations].sort((a, b) => a - b);
    const elevationThreshold = sortedElevations[Math.floor(sortedElevations.length * elevationPercentile / 100)];

    clusters.forEach(cluster => {
      const centerIdx = Math.floor((cluster.segments[0].startIndex + cluster.segments[cluster.segments.length - 1].endIndex) / 2);
      
      const spatialNeighbors = points.filter(p => {
        const dist = calculateDistance(cluster.avgLat, cluster.avgLon, p.lat, p.lon);
        return dist <= prominenceRadius && p.index !== centerIdx;
      });

      const temporalNeighbors = points.filter(p => {
        if (!p.time || !cluster.startTime) return false;
        const timeDiff = Math.abs(p.time - cluster.startTime) / (1000 * 60);
        return timeDiff <= prominenceTimeWindow && p.index !== centerIdx;
      });

      const combinedNeighbors = [...new Set([...spatialNeighbors, ...temporalNeighbors])];
      const neighborElevations = combinedNeighbors.map(p => p.ele || 0);
      const avgNeighborEle = neighborElevations.length > 0
        ? neighborElevations.reduce((sum, e) => sum + e, 0) / neighborElevations.length
        : cluster.avgEle;

      cluster.prominence = cluster.maxEle - avgNeighborEle;
      cluster.index = centerIdx;

      const durationScore = Math.min(cluster.duration / 10, 1) * 100;
      const elevationScore = cluster.avgEle >= elevationThreshold ? 100 : 50;
      const prominenceScore = Math.min(cluster.prominence / 50, 1) * 100;

      cluster.score = (durationScore + elevationScore + prominenceScore) / 3;
      cluster.durationScore = durationScore;
      cluster.elevationScore = elevationScore;
      cluster.prominenceScore = prominenceScore;

      cluster.lat = cluster.avgLat;
      cluster.lon = cluster.avgLon;
      cluster.ele = cluster.maxEle;
    });

    return clusters.sort((a, b) => b.score - a.score);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const points = await parseGPX(file);
      setGpxData(points);
      
      const peaks = detectStopBasedPeaks(points);
      setDetectedPeaks(peaks);
      setSelectedPeakIndices(peaks.map((_, idx) => idx));
      
      // Set map center to the middle of the track
      if (points.length > 0) {
        const lats = points.map(p => p.lat);
        const lons = points.map(p => p.lon);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
        setMapCenter([centerLat, centerLon]);
        setMapZoom(12);
      }
    } catch (error) {
      alert(`Fehler: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create Plotly chart
  useEffect(() => {
    if (!gpxData || !plotRef.current) return;

    const times = gpxData.map(p => p.time ? p.time.toLocaleTimeString('de-DE') : '');
    const elevations = gpxData.map(p => p.ele || 0);
    const distances = gpxData.map(p => p.distance / 1000); // km

    // Elevation profile trace
    const elevationTrace = {
      x: distances,
      y: elevations,
      type: 'scatter',
      mode: 'lines',
      name: 'Höhenprofil',
      line: {
        color: '#667eea',
        width: 2
      },
      hovertemplate: 'Distanz: %{x:.2f} km<br>Höhe: %{y:.0f} m<extra></extra>'
    };

    // Summit markers
    const summitMarkers = {
      x: detectedPeaks.map(peak => gpxData[peak.index]?.distance / 1000 || 0),
      y: detectedPeaks.map(peak => peak.ele),
      type: 'scatter',
      mode: 'markers+text',
      name: 'Erkannte Gipfel',
      marker: {
        size: detectedPeaks.map((peak, idx) => 
          hoveredPeakIndex === idx ? 18 : selectedPeakIndices.includes(idx) ? 14 : 10
        ),
        color: detectedPeaks.map((peak, idx) => {
          if (hoveredPeakIndex === idx) return '#fbbf24';
          if (selectedPeakIndices.includes(idx)) return '#48bb78';
          return '#e53e3e';
        }),
        line: {
          color: 'white',
          width: 2
        }
      },
      text: detectedPeaks.map((_, idx) => `#${idx + 1}`),
      textposition: 'top center',
      textfont: {
        size: 12,
        color: 'black',
        family: 'Arial',
        weight: 'bold'
      },
      hovertemplate: detectedPeaks.map((peak, idx) => 
        `Gipfel #${idx + 1}<br>` +
        `Höhe: ${Math.round(peak.ele)} m<br>` +
        `Dauer: ${peak.duration.toFixed(1)} min<br>` +
        `Score: ${peak.score.toFixed(1)}<extra></extra>`
      )
    };

    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);

    const layout = {
      xaxis: {
        title: 'Distanz (km)',
        gridcolor: '#e0e0e0'
      },
      yaxis: {
        title: 'Höhe (m)',
        gridcolor: '#e0e0e0',
        range: [minEle - 20, maxEle + 50]
      },
      hovermode: 'closest',
      plot_bgcolor: '#fafafa',
      paper_bgcolor: 'white',
      showlegend: true,
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: 'rgba(255, 255, 255, 0.8)'
      },
      margin: { t: 20, r: 20, b: 50, l: 60 }
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      displaylogo: false
    };

    Plotly.newPlot(plotRef.current, [elevationTrace, summitMarkers], layout, config);

    // Add click handler for markers
    plotRef.current.on('plotly_click', (data) => {
      if (data.points[0].curveNumber === 1) { // Summit markers trace
        const pointIndex = data.points[0].pointIndex;
        handlePeakToggle(pointIndex);
      }
    });

  }, [gpxData, detectedPeaks, selectedPeakIndices, hoveredPeakIndex]);

  // Update map when hovering peaks
  useEffect(() => {
    if (hoveredPeakIndex !== null && detectedPeaks[hoveredPeakIndex] && mapRef.current) {
      const peak = detectedPeaks[hoveredPeakIndex];
      mapRef.current.setView([peak.lat, peak.lon], 15, { animate: true });
    }
  }, [hoveredPeakIndex, detectedPeaks]);

  const handlePeakToggle = (idx) => {
    setSelectedPeakIndices(prev => 
      prev.includes(idx) 
        ? prev.filter(i => i !== idx)
        : [...prev, idx]
    );
  };

  const handleSelectAll = () => {
    setSelectedPeakIndices(detectedPeaks.map((_, idx) => idx));
  };

  const handleDeselectAll = () => {
    setSelectedPeakIndices([]);
  };

  const handleConfirmPeaks = () => {
    const selectedPeaks = selectedPeakIndices.map(idx => detectedPeaks[idx]);
    onPeaksDetected(selectedPeaks);
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    return time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="gpx-analyzer-overlay">
      <div className="gpx-analyzer-modal">
        <div className="gpx-analyzer-header">
          <h3>🏔️ GPX Gipfel-Analyse</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="gpx-analyzer-content">
          {!gpxData ? (
            <div className="gpx-upload-section">
              <p>Lade eine GPX-Datei hoch, um automatisch Gipfel zu erkennen.</p>
              
              <div className="algorithm-info">
                <h4>Stop-basierte Gipfelerkennung</h4>
                <p><strong>Methode:</strong> Identifiziert Gipfel durch Analyse von Stop-Clustern (Geschwindigkeit &lt; 0.5 m/s) kombiniert mit Höhenprominenz.</p>
              </div>

              <div className="settings-grid">
                <div className="setting-item">
                  <label>Stopp-Geschwindigkeit (m/s)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.stopSpeedThreshold}
                    onChange={(e) => setSettings({...settings, stopSpeedThreshold: parseFloat(e.target.value)})}
                    min="0.1"
                    max="2"
                  />
                  <small>Standard: 0.5 m/s (~1.8 km/h)</small>
                </div>
                <div className="setting-item">
                  <label>Cluster-Distanz (m)</label>
                  <input
                    type="number"
                    value={settings.clusterDistance}
                    onChange={(e) => setSettings({...settings, clusterDistance: parseInt(e.target.value)})}
                    min="20"
                    max="200"
                  />
                  <small>Gruppiert Stopps in diesem Radius</small>
                </div>
                <div className="setting-item">
                  <label>Min. Stopp-Dauer (min)</label>
                  <input
                    type="number"
                    value={settings.minStopDuration}
                    onChange={(e) => setSettings({...settings, minStopDuration: parseInt(e.target.value)})}
                    min="1"
                    max="30"
                  />
                  <small>Standard: 1 min (optimiert für kurze Gipfelstopps)</small>
                </div>
                <div className="setting-item">
                  <label>Zeit-Cluster (min)</label>
                  <input
                    type="number"
                    value={settings.clusterTimeGap}
                    onChange={(e) => setSettings({...settings, clusterTimeGap: parseInt(e.target.value)})}
                    min="1"
                    max="30"
                  />
                  <small>Standard: 5 min (gruppiert nahe Stopps zeitlich)</small>
                </div>
              </div>

              <label className="btn btn-primary file-upload-btn">
                {loading ? 'Verarbeite...' : 'GPX-Datei auswählen'}
                <input
                  type="file"
                  accept=".gpx"
                  onChange={handleFileUpload}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          ) : (
            <div className="gpx-results">
              <div className="gpx-stats">
                <div className="stat-item">
                  <strong>Trackpunkte:</strong> {gpxData.length}
                </div>
                <div className="stat-item">
                  <strong>Distanz:</strong> {(gpxData[gpxData.length - 1].distance / 1000).toFixed(2)} km
                </div>
                <div className="stat-item">
                  <strong>Gipfel erkannt:</strong> {detectedPeaks.length}
                </div>
                {gpxData[0].time && gpxData[gpxData.length - 1].time && (
                  <div className="stat-item">
                    <strong>Dauer:</strong> {Math.round((gpxData[gpxData.length - 1].time - gpxData[0].time) / (1000 * 60))} min
                  </div>
                )}
              </div>

              {/* Two-column layout */}
              <div className="gpx-two-column-layout">
                {/* LEFT COLUMN: Summit table */}
                <div className="gpx-left-column">
                  {detectedPeaks.length > 0 && (
                    <div className="detected-peaks-list-compact">
                      <div className="peaks-header">
                        <h4>Erkannte Gipfel ({detectedPeaks.length})</h4>
                        <div className="selection-controls">
                          <button 
                            className="btn-small btn-secondary"
                            onClick={handleSelectAll}
                          >
                            Alle
                          </button>
                          <button 
                            className="btn-small btn-secondary"
                            onClick={handleDeselectAll}
                          >
                            Keine
                          </button>
                        </div>
                      </div>
                      <div className="peaks-table-compact">
                        <table>
                          <thead>
                            <tr>
                              <th width="30"></th>
                              <th width="30">#</th>
                              <th>Zeit</th>
                              <th>Höhe</th>
                              <th>Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detectedPeaks.map((peak, idx) => {
                              const scoreClass = peak.score > 60 ? 'score-high' : 
                                               peak.score > 30 ? 'score-medium' : 'score-low';
                              return (
                                <tr 
                                  key={idx} 
                                  className={`${selectedPeakIndices.includes(idx) ? 'selected' : ''} ${hoveredPeakIndex === idx ? 'hovered' : ''}`}
                                  onClick={() => handlePeakToggle(idx)}
                                  onMouseEnter={() => setHoveredPeakIndex(idx)}
                                  onMouseLeave={() => setHoveredPeakIndex(null)}
                                >
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={selectedPeakIndices.includes(idx)}
                                      onChange={() => handlePeakToggle(idx)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                  <td><strong>{idx + 1}</strong></td>
                                  <td>{formatTime(peak.startTime)}</td>
                                  <td>{Math.round(peak.ele)} m</td>
                                  <td>
                                    <span className={`score-badge ${scoreClass}`}>{peak.score.toFixed(0)}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Chart and Map */}
                <div className="gpx-right-column">
                  {/* Elevation Profile */}
                  <div className="elevation-profile-plotly">
                    <h4>Höhenprofil</h4>
                    <div className="peak-legend">
                      <span className="legend-item">
                        <span className="legend-dot" style={{ backgroundColor: '#e53e3e' }}></span>
                        Nicht ausgewählt
                      </span>
                      <span className="legend-item">
                        <span className="legend-dot" style={{ backgroundColor: '#48bb78' }}></span>
                        Ausgewählt
                      </span>
                      <span className="legend-item">
                        <span className="legend-dot" style={{ backgroundColor: '#fbbf24' }}></span>
                        Hervorgehoben
                      </span>
                    </div>
                    <div ref={plotRef} style={{ width: '100%', height: '250px' }}></div>
                  </div>

                  {/* Map Preview */}
                  <div className="map-preview">
                    <h4>Kartenansicht</h4>
                    <div className="map-container">
                      <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '280px', width: '100%' }}
                        ref={mapRef}
                      >
                        <TileLayer
                          url={getTileUrl('outdoor')}
                          attribution={getMapStyle('outdoor').attribution}
                          maxZoom={getMapStyle('outdoor').maxZoom}
                        />
                        
                        {/* GPX Track */}
                        <Polyline
                          positions={gpxData.map(point => [point.lat, point.lon])}
                          pathOptions={{
                            color: '#667eea',
                            weight: 3,
                            opacity: 0.7
                          }}
                        />
                        
                        {/* Peak Markers */}
                        {detectedPeaks.map((peak, idx) => (
                          <Marker
                            key={idx}
                            position={[peak.lat, peak.lon]}
                            opacity={hoveredPeakIndex === idx ? 1 : selectedPeakIndices.includes(idx) ? 0.7 : 0.3}
                          >
                            <Popup>
                              <div>
                                <strong>Gipfel #{idx + 1}</strong><br/>
                                Höhe: {Math.round(peak.ele)} m<br/>
                                Dauer: {peak.duration.toFixed(1)} min<br/>
                                Score: {peak.score.toFixed(1)}<br/>
                                <small>{peak.lat.toFixed(5)}, {peak.lon.toFixed(5)}</small>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="gpx-actions">
                <button 
                  className="btn btn-primary"
                  onClick={handleConfirmPeaks}
                  disabled={selectedPeakIndices.length === 0}
                >
                  Ausgewählte Gipfel zu OSM abfragen ({selectedPeakIndices.length})
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setGpxData(null);
                    setDetectedPeaks([]);
                    setSelectedPeakIndices([]);
                  }}
                >
                  Neue Datei
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GpxAnalyzer;