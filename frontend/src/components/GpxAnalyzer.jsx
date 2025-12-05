import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, ResponsiveContainer } from 'recharts';

function GpxAnalyzer({ onPeaksDetected, onClose }) {
  const [gpxData, setGpxData] = useState(null);
  const [detectedPeaks, setDetectedPeaks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    minElevationDiff: 50, // minimum elevation difference to consider a peak
    minTimeAtPeak: 2, // minimum minutes spent near peak
    searchRadius: 50 // meters radius to check around point
  });

  const parseGPX = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(e.target.result, 'text/xml');
          
          // Check for parsing errors
          const parseError = xmlDoc.querySelector('parsererror');
          if (parseError) {
            reject(new Error('Ungültige GPX-Datei'));
            return;
          }

          // Extract track points
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
              distance: 0 // Will be calculated
            });
          });

          // Calculate cumulative distance
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
    const R = 6371e3; // Earth radius in meters
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

  const detectPeaks = (points) => {
    const peaks = [];
    const { minElevationDiff, minTimeAtPeak, searchRadius } = settings;

    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i];
      
      if (!point.ele) continue;

      // Check if this point is higher than surrounding points within radius
      let isLocalMax = true;
      let pointsNearby = [];

      // Check points within distance radius
      for (let j = 0; j < points.length; j++) {
        if (j === i) continue;
        
        const dist = calculateDistance(
          point.lat,
          point.lon,
          points[j].lat,
          points[j].lon
        );

        if (dist <= searchRadius) {
          pointsNearby.push(points[j]);
          if (points[j].ele && points[j].ele > point.ele) {
            isLocalMax = false;
            break;
          }
        }
      }

      if (!isLocalMax) continue;

      // Check elevation difference with nearby points
      const nearbyElevations = pointsNearby
        .filter(p => p.ele !== null)
        .map(p => p.ele);
      
      if (nearbyElevations.length === 0) continue;

      const minNearbyEle = Math.min(...nearbyElevations);
      const elevationDiff = point.ele - minNearbyEle;

      if (elevationDiff < minElevationDiff) continue;

      // Check time spent near peak
      if (point.time && minTimeAtPeak > 0) {
        const timeWindowMs = minTimeAtPeak * 60 * 1000;
        const pointsInTimeWindow = pointsNearby.filter(p => {
          if (!p.time) return false;
          const timeDiff = Math.abs(p.time - point.time);
          return timeDiff <= timeWindowMs;
        });

        if (pointsInTimeWindow.length < 2) continue;
      }

      // This is a potential peak
      peaks.push({
        ...point,
        elevationDiff,
        nearbyPoints: pointsNearby.length
      });
    }

    // Remove peaks that are too close to each other (keep highest)
    const filteredPeaks = [];
    const minPeakDistance = searchRadius * 2;

    peaks.sort((a, b) => b.ele - a.ele); // Sort by elevation, highest first

    for (const peak of peaks) {
      const tooClose = filteredPeaks.some(existingPeak => {
        const dist = calculateDistance(
          peak.lat,
          peak.lon,
          existingPeak.lat,
          existingPeak.lon
        );
        return dist < minPeakDistance;
      });

      if (!tooClose) {
        filteredPeaks.push(peak);
      }
    }

    return filteredPeaks.sort((a, b) => a.index - b.index);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const points = await parseGPX(file);
      
      if (points.length === 0) {
        alert('Keine Trackpunkte in der GPX-Datei gefunden');
        return;
      }

      setGpxData(points);
      
      // Detect peaks
      const peaks = detectPeaks(points);
      setDetectedPeaks(peaks);

      if (peaks.length === 0) {
        alert('Keine Gipfel erkannt. Versuchen Sie, die Einstellungen anzupassen.');
      }
    } catch (error) {
      alert('Fehler beim Verarbeiten der GPX-Datei: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPeaks = () => {
    if (detectedPeaks.length === 0) {
      alert('Keine Gipfel zum Hinzufügen');
      return;
    }
    onPeaksDetected(detectedPeaks);
  };

  const prepareChartData = () => {
    if (!gpxData) return [];
    
    return gpxData
      .filter(p => p.ele !== null)
      .map(p => ({
        distance: (p.distance / 1000).toFixed(2), // km
        elevation: Math.round(p.ele),
        isPeak: detectedPeaks.some(peak => peak.index === p.index)
      }));
  };

  return (
    <div className="gpx-analyzer-overlay">
      <div className="gpx-analyzer-modal">
        <div className="gpx-analyzer-header">
          <h3>GPX-Track analysieren</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="gpx-analyzer-content">
          {!gpxData ? (
            <div className="gpx-upload-section">
              <p>Laden Sie eine GPX-Datei hoch, um Gipfel automatisch zu erkennen.</p>
              
              <div className="settings-grid">
                <div className="setting-item">
                  <label>Min. Höhendifferenz (m)</label>
                  <input
                    type="number"
                    value={settings.minElevationDiff}
                    onChange={(e) => setSettings({...settings, minElevationDiff: parseInt(e.target.value)})}
                    min="10"
                    max="500"
                  />
                </div>
                <div className="setting-item">
                  <label>Min. Zeit am Gipfel (min)</label>
                  <input
                    type="number"
                    value={settings.minTimeAtPeak}
                    onChange={(e) => setSettings({...settings, minTimeAtPeak: parseInt(e.target.value)})}
                    min="0"
                    max="30"
                  />
                </div>
                <div className="setting-item">
                  <label>Suchradius (m)</label>
                  <input
                    type="number"
                    value={settings.searchRadius}
                    onChange={(e) => setSettings({...settings, searchRadius: parseInt(e.target.value)})}
                    min="20"
                    max="200"
                  />
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
              </div>

              <div className="elevation-profile">
                <h4>Höhenprofil</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prepareChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="distance" 
                      label={{ value: 'Distanz (km)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      label={{ value: 'Höhe (m)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="elevation" 
                      stroke="#667eea" 
                      strokeWidth={2}
                      dot={false}
                    />
                    {detectedPeaks.map((peak, idx) => (
                      <ReferenceDot
                        key={idx}
                        x={(peak.distance / 1000).toFixed(2)}
                        y={Math.round(peak.ele)}
                        r={6}
                        fill="#e53e3e"
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {detectedPeaks.length > 0 && (
                <div className="detected-peaks-list">
                  <h4>Erkannte Gipfel:</h4>
                  {detectedPeaks.map((peak, idx) => (
                    <div key={idx} className="peak-item">
                      <div>
                        <strong>Gipfel {idx + 1}</strong>
                        <div className="peak-details">
                          Höhe: {Math.round(peak.ele)}m | 
                          Koordinaten: {peak.lat.toFixed(5)}, {peak.lon.toFixed(5)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="gpx-actions">
                <button 
                  className="btn btn-primary"
                  onClick={handleConfirmPeaks}
                  disabled={detectedPeaks.length === 0}
                >
                  Gipfel zu OSM abfragen ({detectedPeaks.length})
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setGpxData(null);
                    setDetectedPeaks([]);
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