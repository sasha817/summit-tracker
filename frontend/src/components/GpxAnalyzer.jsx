import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, ResponsiveContainer } from 'recharts';

function GpxAnalyzer({ onPeaksDetected, onClose }) {
  const [gpxData, setGpxData] = useState(null);
  const [detectedPeaks, setDetectedPeaks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    stopSpeedThreshold: 0.5, // m/s (slower = stopped)
    clusterDistance: 50, // meters (group nearby stops)
    clusterTimeGap: 15, // minutes (group temporally close stops)
    minStopDuration: 3, // minutes (filter short stops)
    prominenceRadius: 100, // meters (spatial context)
    prominenceTimeWindow: 10, // minutes (temporal context)
    elevationPercentile: 80 // top 20% of track
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

            // Calculate speed (m/s)
            if (points[i].time && points[i - 1].time) {
              const timeDiff = (points[i].time - points[i - 1].time) / 1000; // seconds
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

    // Add last stop if exists
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

        const timeDiff = Math.abs(stopSegments[j].startTime - stopSegments[i].endTime) / (1000 * 60); // minutes

        if (dist <= clusterDistance || timeDiff <= clusterTimeGap) {
          cluster.segments.push(stopSegments[j]);
          cluster.indices.push(j);
          used.add(j);
        }
      }

      // Calculate cluster properties
      const allPoints = cluster.segments.flatMap(s => s.points);
      const totalDuration = cluster.segments.reduce((sum, s) => {
        return sum + (s.endTime - s.startTime) / (1000 * 60); // minutes
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

    // Step 3: Score each cluster
    const elevations = points.filter(p => p.ele).map(p => p.ele);
    elevations.sort((a, b) => a - b);
    const elevationThreshold = elevations[Math.floor(elevations.length * elevationPercentile / 100)];

    clusters.forEach(cluster => {
      // Duration score (max 30 points)
      const durationScore = Math.min(cluster.duration, 30);

      // Elevation percentile score (20 points if in top percentile)
      const elevationScore = cluster.maxEle >= elevationThreshold ? 20 : 0;

      // Prominence score (max 50 points)
      let prominenceScore = 0;
      const nearbyPoints = points.filter(p => {
        if (!p.ele || !p.time) return false;
        
        const dist = calculateDistance(cluster.avgLat, cluster.avgLon, p.lat, p.lon);
        const timeDiff = Math.abs(p.time - cluster.startTime) / (1000 * 60); // minutes
        
        return dist <= prominenceRadius && timeDiff <= prominenceTimeWindow;
      });

      if (nearbyPoints.length > 0) {
        const nearbyElevations = nearbyPoints.map(p => p.ele);
        const minNearby = Math.min(...nearbyElevations);
        const elevationDiff = cluster.maxEle - minNearby;
        prominenceScore = Math.min(elevationDiff, 50);
      }

      cluster.score = durationScore + elevationScore + prominenceScore;
      cluster.durationScore = durationScore;
      cluster.elevationScore = elevationScore;
      cluster.prominenceScore = prominenceScore;
    });

    // Step 4: Filter and rank
    const rankedClusters = clusters
      .filter(c => c.duration >= minStopDuration)
      .sort((a, b) => b.score - a.score);

    return rankedClusters.map(cluster => ({
      lat: cluster.avgLat,
      lon: cluster.avgLon,
      ele: cluster.maxEle,
      duration: cluster.duration,
      startTime: cluster.startTime,
      endTime: cluster.endTime,
      score: cluster.score,
      durationScore: cluster.durationScore,
      elevationScore: cluster.elevationScore,
      prominenceScore: cluster.prominenceScore,
      index: cluster.segments[0].startIndex
    }));
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
      
      // Detect peaks using stop-based algorithm
      const peaks = detectStopBasedPeaks(points);
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
        distance: (p.distance / 1000).toFixed(2),
        elevation: Math.round(p.ele),
        isPeak: detectedPeaks.some(peak => Math.abs(peak.index - p.index) < 10)
      }));
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="gpx-analyzer-overlay">
      <div className="gpx-analyzer-modal">
        <div className="gpx-analyzer-header">
          <h3>GPX-Track analysieren (Stop-basiert)</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="gpx-analyzer-content">
          {!gpxData ? (
            <div className="gpx-upload-section">
              <p>Laden Sie eine GPX-Datei hoch. Der Algorithmus erkennt Gipfel basierend auf Stopps (wo Sie Zeit verbracht haben).</p>
              
              <div className="settings-grid">
                <div className="setting-item">
                  <label>Stop-Geschwindigkeit (m/s)</label>
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
                  <small>Filtert kurze Stopps aus</small>
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

              <div className="elevation-profile">
                <h4>Höhenprofil (Rote Punkte = Erkannte Gipfel)</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prepareChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="distance" 
                      label={{ value: 'Distanz (km)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      domain={['dataMin - 20', 'dataMax + 20']}
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
                        x={(gpxData[peak.index]?.distance / 1000).toFixed(2)}
                        y={Math.round(peak.ele)}
                        r={8}
                        fill="#e53e3e"
                        stroke="#fff"
                        strokeWidth={2}
                        label={{ value: `#${idx + 1}`, position: 'top', fill: '#2d3748', fontSize: 12, fontWeight: 'bold' }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {detectedPeaks.length > 0 && (
                <div className="detected-peaks-list">
                  <h4>Erkannte Gipfel (Stop-basiert, sortiert nach Score):</h4>
                  {detectedPeaks.map((peak, idx) => (
                    <div key={idx} className="peak-item">
                      <div>
                        <strong>#{idx + 1} - Gipfel (Score: {peak.score.toFixed(1)})</strong>
                        <div className="peak-details">
                          🕐 {formatTime(peak.startTime)} - {formatTime(peak.endTime)} ({peak.duration.toFixed(1)} min) |
                          ⛰️ {Math.round(peak.ele)}m |
                          📍 {peak.lat.toFixed(5)}, {peak.lon.toFixed(5)}
                        </div>
                        <div className="peak-scores">
                          Dauer: {peak.durationScore.toFixed(0)} | 
                          Höhe: {peak.elevationScore.toFixed(0)} | 
                          Prominenz: {peak.prominenceScore.toFixed(0)}
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