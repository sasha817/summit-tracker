import React, { useState } from 'react';

function SummitForm({ onSubmit, onCancel, initialData = null, mode = 'create' }) {
  // mode can be: 'create' (summit+visit), 'edit-summit', 'add-visit', 'edit-visit'
  
  const [formData, setFormData] = useState(
    initialData || {
      name: '',
      latitude: '',
      longitude: '',
      date: new Date().toISOString().split('T')[0],
      elevation: '',
      wikipedia: '',
      notes: '',
    }
  );

  const [errors, setErrors] = useState({});
  const [osmData, setOsmData] = useState(null);
  const [showOsmPopup, setShowOsmPopup] = useState(false);
  const [loadingOsm, setLoadingOsm] = useState(false);

  // Function to query OSM for peak data
  const queryOSM = async (latitude, longitude) => {
    const radius = 100;
    const query = `
      [out:json];
      (
        node["natural"="peak"](around:${radius},${latitude},${longitude});
        node["natural"="volcano"](around:${radius},${latitude},${longitude});
      );
      out body;
    `;
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });
    
    if (!response.ok) {
      throw new Error('Failed to query OSM');
    }
    
    const data = await response.json();
    return data.elements;
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

    return Math.round(R * c);
  };

  const validate = () => {
    const newErrors = {};

    if (mode !== 'edit-visit' && mode !== 'add-visit') {
      if (!formData.name.trim()) {
        newErrors.name = 'Summit name is required';
      }

      const lat = parseFloat(formData.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.latitude = 'Latitude must be between -90 and 90';
      }

      const lon = parseFloat(formData.longitude);
      if (isNaN(lon) || lon < -180 || lon > 180) {
        newErrors.longitude = 'Longitude must be between -180 and 180';
      }
    }

    if (mode === 'create' || mode === 'add-visit' || mode === 'edit-visit') {
      if (!formData.date) {
        newErrors.date = 'Date is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validate()) {
      const submitData = {};
      
      if (mode === 'edit-visit') {
        submitData.date = formData.date;
        submitData.notes = formData.notes ? formData.notes.trim() : null;
      } else if (mode === 'add-visit') {
        submitData.summitId = initialData.summitId;
        submitData.date = formData.date;
        submitData.notes = formData.notes ? formData.notes.trim() : null;
      } else if (mode === 'edit-summit') {
        submitData.name = formData.name.trim();
        submitData.latitude = parseFloat(formData.latitude);
        submitData.longitude = parseFloat(formData.longitude);
        submitData.elevation = formData.elevation ? parseFloat(formData.elevation) : null;
        submitData.wikipedia = formData.wikipedia ? formData.wikipedia.trim() : null;
      } else {
        // mode === 'create' - summit with visit
        submitData.name = formData.name.trim();
        submitData.latitude = parseFloat(formData.latitude);
        submitData.longitude = parseFloat(formData.longitude);
        submitData.date = formData.date;
        submitData.elevation = formData.elevation ? parseFloat(formData.elevation) : null;
        submitData.wikipedia = formData.wikipedia ? formData.wikipedia.trim() : null;
        submitData.notes = formData.notes ? formData.notes.trim() : null;
      }

      onSubmit(submitData);

      // Reset form
      setFormData({
        name: '',
        latitude: '',
        longitude: '',
        date: new Date().toISOString().split('T')[0],
        elevation: '',
        wikipedia: '',
        notes: '',
      });
      setErrors({});
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleCheckOSM = async () => {
    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      alert('Please enter valid coordinates first');
      return;
    }

    setLoadingOsm(true);
    try {
      const results = await queryOSM(lat, lon);
      
      if (results.length === 0) {
        alert('No peak found at these coordinates in OSM.');
        return;
      }

      const peak = results[0];
      const osmDataObj = {
        osmName: peak.tags?.name || 'Unnamed peak',
        osmElevation: peak.tags?.ele || peak.tags?.elevation || null,
        osmWikipedia: peak.tags?.wikipedia || null,
        lat: peak.lat,
        lon: peak.lon,
        distance: calculateDistance(lat, lon, peak.lat, peak.lon),
      };
      
      setOsmData(osmDataObj);
      setShowOsmPopup(true);
    } catch (error) {
      alert('Failed to query OpenStreetMap: ' + error.message);
    } finally {
      setLoadingOsm(false);
    }
  };

  const handleApplyOsmData = () => {
    if (osmData) {
      setFormData((prev) => ({
        ...prev,
        name: osmData.osmName || prev.name,
        latitude: osmData.lat,
        longitude: osmData.lon,
        elevation: osmData.osmElevation || prev.elevation,
        wikipedia: osmData.osmWikipedia || prev.wikipedia,
      }));
      setShowOsmPopup(false);
      setOsmData(null);
    }
  };

  const getFormTitle = () => {
    switch (mode) {
      case 'create': return 'Gipfel & ersten Besuch hinzufügen';
      case 'edit-summit': return 'Gipfel bearbeiten';
      case 'add-visit': return 'Neuen Besuch hinzufügen';
      case 'edit-visit': return 'Besuch bearbeiten';
      default: return 'Gipfelformular';
    }
  };

  const getSubmitButtonText = () => {
    switch (mode) {
      case 'create': return 'Gipfel & Besuch speichern';
      case 'edit-summit': return 'Gipfel aktualisieren';
      case 'add-visit': return 'Besuch hinzufügen';
      case 'edit-visit': return 'Besuch aktualisieren';
      default: return 'Speichern';
    }
  };

  const showSummitFields = mode !== 'edit-visit' && mode !== 'add-visit';
  const showVisitFields = mode !== 'edit-summit';

  return (
    <>
      {showOsmPopup && osmData && (
        <div className="osm-popup-overlay" onClick={() => setShowOsmPopup(false)}>
          <div className="osm-popup" onClick={(e) => e.stopPropagation()}>
            <h3>OpenStreetMap-Daten gefunden</h3>
            <div className="osm-data">
              <div className="osm-field">
                <strong>Name:</strong> {osmData.osmName}
              </div>
              {osmData.osmElevation && (
                <div className="osm-field">
                  <strong>Höhe:</strong> {osmData.osmElevation} m
                </div>
              )}
              <div className="osm-field">
                <strong>Koordinaten:</strong> {osmData.lat.toFixed(6)}, {osmData.lon.toFixed(6)}
              </div>
              <div className="osm-field">
                <strong>Entfernung:</strong> {osmData.distance} Meter
              </div>
              {osmData.osmWikipedia && (
                <div className="osm-field">
                  <strong>Wikipedia:</strong>{' '}
                  <a
                    href={`https://en.wikipedia.org/wiki/${osmData.osmWikipedia.replace('en:', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {osmData.osmWikipedia}
                  </a>
                </div>
              )}
            </div>
            <div className="osm-popup-actions">
              <button className="btn btn-primary" onClick={handleApplyOsmData}>
                Daten übernehmen
              </button>
              <button className="btn btn-secondary" onClick={() => setShowOsmPopup(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="summit-form">
        <h3 className="form-title">{getFormTitle()}</h3>

        {showSummitFields && (
          <>
            <div className="form-group">
              <label htmlFor="name">Gipfelname *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="z.B. Zugspitze"
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="latitude">Breitengrad *</label>
                <input
                  type="number"
                  id="latitude"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  step="any"
                  placeholder="47.4211"
                  className={errors.latitude ? 'error' : ''}
                />
                {errors.latitude && (
                  <span className="error-message">{errors.latitude}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="longitude">Längengrad *</label>
                <input
                  type="number"
                  id="longitude"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  step="any"
                  placeholder="10.9853"
                  className={errors.longitude ? 'error' : ''}
                />
                {errors.longitude && (
                  <span className="error-message">{errors.longitude}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="elevation">Höhe (Meter)</label>
              <input
                type="number"
                id="elevation"
                name="elevation"
                value={formData.elevation}
                onChange={handleChange}
                step="1"
                placeholder="z.B. 2962"
              />
            </div>

            <div className="form-group">
              <label htmlFor="wikipedia">Wikipedia</label>
              <input
                type="text"
                id="wikipedia"
                name="wikipedia"
                value={formData.wikipedia}
                onChange={handleChange}
                placeholder="z.B. de:Zugspitze"
              />
            </div>
          </>
        )}

        {showVisitFields && (
          <>
            <div className="form-group">
              <label htmlFor="date">Besuchsdatum *</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={errors.date ? 'error' : ''}
              />
              {errors.date && <span className="error-message">{errors.date}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notizen</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Wetter, Begleiter, besondere Momente..."
                rows="3"
              />
            </div>
          </>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {getSubmitButtonText()}
          </button>
          {showSummitFields && (
            <button 
              type="button" 
              className="btn btn-secondary btn-osm"
              onClick={handleCheckOSM}
              disabled={loadingOsm}
            >
              {loadingOsm ? 'Checking...' : '🗺️ Check OSM'}
            </button>
          )}
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Abbrechen
          </button>
        </div>
      </form>
    </>
  );
}

export default SummitForm;