const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const SUMMITS_FILE = path.join(__dirname, 'data', 'summits.json');
const VISITS_FILE = path.join(__dirname, 'data', 'visits.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  
  // Initialize files if they don't exist
  try {
    await fs.access(SUMMITS_FILE);
  } catch {
    await fs.writeFile(SUMMITS_FILE, '[]', 'utf-8');
  }
  
  try {
    await fs.access(VISITS_FILE);
  } catch {
    await fs.writeFile(VISITS_FILE, '[]', 'utf-8');
  }
}

// Read/Write functions
async function readSummits() {
  try {
    const data = await fs.readFile(SUMMITS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading summits:', error);
    return [];
  }
}

async function writeSummits(summits) {
  try {
    await fs.writeFile(SUMMITS_FILE, JSON.stringify(summits, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing summits:', error);
    return false;
  }
}

async function readVisits() {
  try {
    const data = await fs.readFile(VISITS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading visits:', error);
    return [];
  }
}

async function writeVisits(visits) {
  try {
    await fs.writeFile(VISITS_FILE, JSON.stringify(visits, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing visits:', error);
    return false;
  }
}

// ===== SUMMIT ENDPOINTS =====

// GET all summits with visit counts
app.get('/api/summits', async (req, res) => {
  try {
    const summits = await readSummits();
    const visits = await readVisits();
    
    // Add visit counts to each summit
    const summitsWithVisits = summits.map(summit => {
      const summitVisits = visits.filter(v => v.summitId === summit.id);
      return {
        ...summit,
        visitCount: summitVisits.length,
        lastVisited: summitVisits.length > 0 
          ? summitVisits.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
          : null
      };
    });
    
    res.json(summitsWithVisits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summits' });
  }
});

// GET single summit with all visits
app.get('/api/summits/:id', async (req, res) => {
  try {
    const summits = await readSummits();
    const visits = await readVisits();
    const summitId = parseInt(req.params.id);
    
    const summit = summits.find(s => s.id === summitId);
    
    if (!summit) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    const summitVisits = visits.filter(v => v.summitId === summitId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({
      ...summit,
      visits: summitVisits
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summit' });
  }
});

// POST new summit
app.post('/api/summits', async (req, res) => {
  try {
    const { name, latitude, longitude, elevation, wikipedia } = req.body;
    
    if (!name || !latitude || !longitude) {
      return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    }
    
    const summits = await readSummits();
    
    // Check if summit already exists (by coordinates)
    const existing = summits.find(s => 
      Math.abs(s.latitude - parseFloat(latitude)) < 0.001 &&
      Math.abs(s.longitude - parseFloat(longitude)) < 0.001
    );
    
    if (existing) {
      return res.status(409).json({ 
        error: 'Summit already exists at these coordinates',
        summit: existing
      });
    }
    
    const newSummit = {
      id: Date.now(),
      name: name.trim(),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      elevation: elevation ? parseFloat(elevation) : null,
      wikipedia: wikipedia || null,
      createdAt: new Date().toISOString()
    };
    
    summits.push(newSummit);
    
    const success = await writeSummits(summits);
    
    if (success) {
      res.status(201).json(newSummit);
    } else {
      res.status(500).json({ error: 'Failed to save summit' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to create summit' });
  }
});

// PUT update summit
app.put('/api/summits/:id', async (req, res) => {
  try {
    const { name, latitude, longitude, elevation, wikipedia } = req.body;
    const summitId = parseInt(req.params.id);
    
    const summits = await readSummits();
    const index = summits.findIndex(s => s.id === summitId);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    summits[index] = {
      ...summits[index],
      name: name || summits[index].name,
      latitude: latitude !== undefined ? parseFloat(latitude) : summits[index].latitude,
      longitude: longitude !== undefined ? parseFloat(longitude) : summits[index].longitude,
      elevation: elevation !== undefined ? (elevation ? parseFloat(elevation) : null) : summits[index].elevation,
      wikipedia: wikipedia !== undefined ? wikipedia : summits[index].wikipedia,
      updatedAt: new Date().toISOString()
    };
    
    const success = await writeSummits(summits);
    
    if (success) {
      res.json(summits[index]);
    } else {
      res.status(500).json({ error: 'Failed to update summit' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update summit' });
  }
});

// DELETE summit (and all its visits)
app.delete('/api/summits/:id', async (req, res) => {
  try {
    const summitId = parseInt(req.params.id);
    const summits = await readSummits();
    const visits = await readVisits();
    
    const filteredSummits = summits.filter(s => s.id !== summitId);
    const filteredVisits = visits.filter(v => v.summitId !== summitId);
    
    if (filteredSummits.length === summits.length) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    const successSummits = await writeSummits(filteredSummits);
    const successVisits = await writeVisits(filteredVisits);
    
    if (successSummits && successVisits) {
      res.json({ message: 'Summit and all visits deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete summit' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete summit' });
  }
});

// ===== VISIT ENDPOINTS =====

// GET all visits with optional filters
app.get('/api/visits', async (req, res) => {
  try {
    const { summitId, year, season } = req.query;
    let visits = await readVisits();
    const summits = await readSummits();
    
    // Filter by summit
    if (summitId) {
      visits = visits.filter(v => v.summitId === parseInt(summitId));
    }
    
    // Filter by year
    if (year) {
      visits = visits.filter(v => new Date(v.date).getFullYear() === parseInt(year));
    }
    
    // Filter by season
    if (season) {
      visits = visits.filter(v => {
        const month = new Date(v.date).getMonth() + 1; // 1-12
        const seasons = {
          spring: [3, 4, 5],
          summer: [6, 7, 8],
          autumn: [9, 10, 11],
          winter: [12, 1, 2]
        };
        return seasons[season.toLowerCase()]?.includes(month);
      });
    }
    
    // Enrich visits with summit data
    const enrichedVisits = visits.map(visit => {
      const summit = summits.find(s => s.id === visit.summitId);
      return {
        ...visit,
        summit: summit || null
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(enrichedVisits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
});

// POST new visit
app.post('/api/visits', async (req, res) => {
  try {
    const { summitId, date, notes } = req.body;
    
    if (!summitId || !date) {
      return res.status(400).json({ error: 'Summit ID and date are required' });
    }
    
    const summits = await readSummits();
    const summit = summits.find(s => s.id === summitId);
    
    if (!summit) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    const visits = await readVisits();
    
    const newVisit = {
      id: Date.now(),
      summitId: summitId,
      date: date,
      notes: notes || null,
      createdAt: new Date().toISOString()
    };
    
    visits.push(newVisit);
    
    const success = await writeVisits(visits);
    
    if (success) {
      res.status(201).json({
        ...newVisit,
        summit: summit
      });
    } else {
      res.status(500).json({ error: 'Failed to save visit' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to create visit' });
  }
});

// PUT update visit
app.put('/api/visits/:id', async (req, res) => {
  try {
    const { date, notes } = req.body;
    const visitId = parseInt(req.params.id);
    
    const visits = await readVisits();
    const index = visits.findIndex(v => v.id === visitId);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    
    visits[index] = {
      ...visits[index],
      date: date || visits[index].date,
      notes: notes !== undefined ? notes : visits[index].notes,
      updatedAt: new Date().toISOString()
    };
    
    const success = await writeVisits(visits);
    
    if (success) {
      res.json(visits[index]);
    } else {
      res.status(500).json({ error: 'Failed to update visit' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update visit' });
  }
});

// DELETE visit
app.delete('/api/visits/:id', async (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const visits = await readVisits();
    
    const filteredVisits = visits.filter(v => v.id !== visitId);
    
    if (filteredVisits.length === visits.length) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    
    const success = await writeVisits(filteredVisits);
    
    if (success) {
      res.json({ message: 'Visit deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete visit' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete visit' });
  }
});

// ===== COMBINED ENDPOINTS =====

// POST create summit and visit in one call
app.post('/api/summits-with-visit', async (req, res) => {
  try {
    const { name, latitude, longitude, elevation, wikipedia, date, notes } = req.body;
    
    if (!name || !latitude || !longitude || !date) {
      return res.status(400).json({ error: 'Name, coordinates, and date are required' });
    }
    
    let summits = await readSummits();
    
    // Check if summit exists
    let summit = summits.find(s => 
      Math.abs(s.latitude - parseFloat(latitude)) < 0.001 &&
      Math.abs(s.longitude - parseFloat(longitude)) < 0.001
    );
    
    let isNewSummit = false;
    
    // Create summit if it doesn't exist
    if (!summit) {
      summit = {
        id: Date.now(),
        name: name.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        elevation: elevation ? parseFloat(elevation) : null,
        wikipedia: wikipedia || null,
        createdAt: new Date().toISOString()
      };
      summits.push(summit);
      await writeSummits(summits);
      isNewSummit = true;
    }
    
    // Create visit
    const visits = await readVisits();
    const newVisit = {
      id: Date.now() + 1, // Ensure different ID
      summitId: summit.id,
      date: date,
      notes: notes || null,
      createdAt: new Date().toISOString()
    };
    visits.push(newVisit);
    await writeVisits(visits);
    
    res.status(201).json({
      summit: summit,
      visit: newVisit,
      isNewSummit: isNewSummit
    });
  } catch (error) {
    console.error('Error creating summit with visit:', error);
    res.status(500).json({ error: 'Failed to create summit and visit' });
  }
});

// GET statistics
app.get('/api/stats', async (req, res) => {
  try {
    const summits = await readSummits();
    const visits = await readVisits();
    
    const years = [...new Set(visits.map(v => new Date(v.date).getFullYear()))].sort((a, b) => b - a);
    
    const stats = {
      totalSummits: summits.length,
      totalVisits: visits.length,
      years: years,
      visitsBySeason: {
        spring: visits.filter(v => [3, 4, 5].includes(new Date(v.date).getMonth() + 1)).length,
        summer: visits.filter(v => [6, 7, 8].includes(new Date(v.date).getMonth() + 1)).length,
        autumn: visits.filter(v => [9, 10, 11].includes(new Date(v.date).getMonth() + 1)).length,
        winter: visits.filter(v => [12, 1, 2].includes(new Date(v.date).getMonth() + 1)).length,
      }
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function startServer() {
  await ensureDataDirectory();
  
  app.listen(PORT, () => {
    console.log(`🚀 Summit Tracker API running on http://localhost:${PORT}`);
    console.log(`📁 Summits stored in: ${SUMMITS_FILE}`);
    console.log(`📁 Visits stored in: ${VISITS_FILE}`);
  });
}

startServer();