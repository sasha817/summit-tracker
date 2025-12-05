const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data', 'summits.json');

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
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
  }
}

// Read summits from file
async function readSummits() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading summits:', error);
    return [];
  }
}

// Write summits to file
async function writeSummits(summits) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(summits, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing summits:', error);
    return false;
  }
}

// GET all summits
app.get('/api/summits', async (req, res) => {
  try {
    const summits = await readSummits();
    res.json(summits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summits' });
  }
});

// GET single summit
app.get('/api/summits/:id', async (req, res) => {
  try {
    const summits = await readSummits();
    const summit = summits.find(s => s.id === parseInt(req.params.id));
    
    if (!summit) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    res.json(summit);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summit' });
  }
});

// POST new summit
app.post('/api/summits', async (req, res) => {
  try {
    const { name, latitude, longitude, date, elevation, wikipedia } = req.body;
    
    // Validation
    if (!name || !latitude || !longitude || !date) {
      return res.status(400).json({ error: 'Name, latitude, longitude, and date are required' });
    }
    
    const summits = await readSummits();
    
    const newSummit = {
      id: Date.now(),
      name: name.trim(),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      date: date,
      elevation: elevation ? parseFloat(elevation) : null,
      wikipedia: wikipedia || null,
      createdAt: new Date().toISOString()
    };
    
    summits.push(newSummit);
    summits.sort((a, b) => new Date(b.date) - new Date(a.date));
    
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
    const { name, latitude, longitude, date, elevation, wikipedia } = req.body;
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
      date: date || summits[index].date,
      elevation: elevation !== undefined ? (elevation ? parseFloat(elevation) : null) : summits[index].elevation,
      wikipedia: wikipedia !== undefined ? wikipedia : summits[index].wikipedia,
      updatedAt: new Date().toISOString()
    };
    
    summits.sort((a, b) => new Date(b.date) - new Date(a.date));
    
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

// DELETE summit
app.delete('/api/summits/:id', async (req, res) => {
  try {
    const summitId = parseInt(req.params.id);
    const summits = await readSummits();
    
    const filteredSummits = summits.filter(s => s.id !== summitId);
    
    if (filteredSummits.length === summits.length) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    const success = await writeSummits(filteredSummits);
    
    if (success) {
      res.json({ message: 'Summit deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete summit' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete summit' });
  }
});

// GET export summits
app.get('/api/summits/export/json', async (req, res) => {
  try {
    const summits = await readSummits();
    res.setHeader('Content-Disposition', `attachment; filename=summits-${Date.now()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(summits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export summits' });
  }
});

// POST import summits
app.post('/api/summits/import', async (req, res) => {
  try {
    const { summits, mode = 'replace' } = req.body;
    
    if (!Array.isArray(summits)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    let finalSummits = summits;
    
    if (mode === 'merge') {
      const existingSummits = await readSummits();
      finalSummits = [...existingSummits, ...summits];
      
      // Remove duplicates by ID
      const uniqueMap = new Map();
      finalSummits.forEach(s => uniqueMap.set(s.id, s));
      finalSummits = Array.from(uniqueMap.values());
    }
    
    finalSummits.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const success = await writeSummits(finalSummits);
    
    if (success) {
      res.json({ 
        message: 'Summits imported successfully', 
        count: finalSummits.length 
      });
    } else {
      res.status(500).json({ error: 'Failed to import summits' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to import summits' });
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
    console.log(`📁 Data stored in: ${DATA_FILE}`);
  });
}

startServer();