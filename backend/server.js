const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const { dbRun, dbGet, dbAll, initializeDatabase } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database on startup
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// ===== SUMMIT ENDPOINTS =====

// GET all summits with visit counts
app.get('/api/summits', async (req, res) => {
  try {
    const summits = await dbAll(`
      SELECT 
        s.*,
        COUNT(v.id) as visitCount,
        MAX(v.date) as lastVisited
      FROM summits s
      LEFT JOIN visits v ON s.id = v.summit_id
      GROUP BY s.id
      ORDER BY s.name
    `);
    
    // Convert snake_case to camelCase for frontend compatibility
    const formattedSummits = summits.map(summit => ({
      id: summit.id,
      name: summit.name,
      latitude: summit.latitude,
      longitude: summit.longitude,
      elevation: summit.elevation,
      wikipedia: summit.wikipedia,
      createdAt: summit.created_at,
      updatedAt: summit.updated_at,
      visitCount: summit.visitCount,
      lastVisited: summit.lastVisited
    }));
    
    res.json(formattedSummits);
  } catch (error) {
    console.error('Error fetching summits:', error);
    res.status(500).json({ error: 'Failed to fetch summits' });
  }
});

// GET single summit with all visits
app.get('/api/summits/:id', async (req, res) => {
  try {
    const summitId = parseInt(req.params.id);
    
    const summit = await dbGet('SELECT * FROM summits WHERE id = ?', [summitId]);
    
    if (!summit) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    const visits = await dbAll(
      'SELECT * FROM visits WHERE summit_id = ? ORDER BY date DESC',
      [summitId]
    );
    
    // Format for frontend
    const formattedVisits = visits.map(v => ({
      id: v.id,
      summitId: v.summit_id,
      date: v.date,
      notes: v.notes,
      createdAt: v.created_at
    }));
    
    res.json({
      id: summit.id,
      name: summit.name,
      latitude: summit.latitude,
      longitude: summit.longitude,
      elevation: summit.elevation,
      wikipedia: summit.wikipedia,
      createdAt: summit.created_at,
      updatedAt: summit.updated_at,
      visits: formattedVisits
    });
  } catch (error) {
    console.error('Error fetching summit:', error);
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
    
    // Check if summit already exists (by coordinates)
    const existing = await dbGet(
      'SELECT * FROM summits WHERE ABS(latitude - ?) < 0.001 AND ABS(longitude - ?) < 0.001',
      [parseFloat(latitude), parseFloat(longitude)]
    );
    
    if (existing) {
      return res.status(409).json({ 
        error: 'Summit already exists at these coordinates',
        summit: {
          id: existing.id,
          name: existing.name,
          latitude: existing.latitude,
          longitude: existing.longitude
        }
      });
    }
    
    // Generate ID and timestamps
    const id = Date.now();
    const createdAt = new Date().toISOString();
    
    await dbRun(
      `INSERT INTO summits (id, name, latitude, longitude, elevation, wikipedia, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, parseFloat(latitude), parseFloat(longitude), elevation || null, wikipedia || null, createdAt]
    );
    
    const newSummit = await dbGet('SELECT * FROM summits WHERE id = ?', [id]);
    
    res.status(201).json({
      id: newSummit.id,
      name: newSummit.name,
      latitude: newSummit.latitude,
      longitude: newSummit.longitude,
      elevation: newSummit.elevation,
      wikipedia: newSummit.wikipedia,
      createdAt: newSummit.created_at
    });
  } catch (error) {
    console.error('Error creating summit:', error);
    res.status(500).json({ error: 'Failed to create summit' });
  }
});

// PUT update summit
app.put('/api/summits/:id', async (req, res) => {
  try {
    const summitId = parseInt(req.params.id);
    const { name, latitude, longitude, elevation, wikipedia } = req.body;
    
    const existing = await dbGet('SELECT * FROM summits WHERE id = ?', [summitId]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    const updatedAt = new Date().toISOString();
    
    await dbRun(
      `UPDATE summits 
       SET name = ?, latitude = ?, longitude = ?, elevation = ?, wikipedia = ?, updated_at = ?
       WHERE id = ?`,
      [
        name || existing.name,
        latitude !== undefined ? parseFloat(latitude) : existing.latitude,
        longitude !== undefined ? parseFloat(longitude) : existing.longitude,
        elevation !== undefined ? elevation : existing.elevation,
        wikipedia !== undefined ? wikipedia : existing.wikipedia,
        updatedAt,
        summitId
      ]
    );
    
    const updated = await dbGet('SELECT * FROM summits WHERE id = ?', [summitId]);
    
    res.json({
      id: updated.id,
      name: updated.name,
      latitude: updated.latitude,
      longitude: updated.longitude,
      elevation: updated.elevation,
      wikipedia: updated.wikipedia,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    console.error('Error updating summit:', error);
    res.status(500).json({ error: 'Failed to update summit' });
  }
});

// DELETE summit
app.delete('/api/summits/:id', async (req, res) => {
  try {
    const summitId = parseInt(req.params.id);
    
    const existing = await dbGet('SELECT * FROM summits WHERE id = ?', [summitId]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    // Delete visits first (or rely on CASCADE)
    await dbRun('DELETE FROM visits WHERE summit_id = ?', [summitId]);
    await dbRun('DELETE FROM summits WHERE id = ?', [summitId]);
    
    res.json({ message: 'Summit deleted successfully' });
  } catch (error) {
    console.error('Error deleting summit:', error);
    res.status(500).json({ error: 'Failed to delete summit' });
  }
});

// ===== VISIT ENDPOINTS =====

// GET all visits (with optional filters)
app.get('/api/visits', async (req, res) => {
  try {
    const { summitId, year, season } = req.query;
    
    let sql = `
      SELECT v.*, s.name as summit_name
      FROM visits v
      JOIN summits s ON v.summit_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    if (summitId) {
      sql += ' AND v.summit_id = ?';
      params.push(parseInt(summitId));
    }
    
    if (year) {
      sql += ' AND strftime("%Y", v.date) = ?';
      params.push(year);
    }
    
    if (season) {
      const seasonMonths = {
        'winter': ['12', '01', '02'],
        'spring': ['03', '04', '05'],
        'summer': ['06', '07', '08'],
        'autumn': ['09', '10', '11']
      };
      
      if (seasonMonths[season]) {
        sql += ' AND strftime("%m", v.date) IN (' + seasonMonths[season].map(() => '?').join(',') + ')';
        params.push(...seasonMonths[season]);
      }
    }
    
    sql += ' ORDER BY v.date DESC';
    
    const visits = await dbAll(sql, params);
    
    const formattedVisits = visits.map(v => ({
      id: v.id,
      summitId: v.summit_id,
      summitName: v.summit_name,
      date: v.date,
      notes: v.notes,
      createdAt: v.created_at
    }));
    
    res.json(formattedVisits);
  } catch (error) {
    console.error('Error fetching visits:', error);
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
    
    // Verify summit exists
    const summit = await dbGet('SELECT * FROM summits WHERE id = ?', [summitId]);
    if (!summit) {
      return res.status(404).json({ error: 'Summit not found' });
    }
    
    const id = Date.now();
    const createdAt = new Date().toISOString();
    
    await dbRun(
      'INSERT INTO visits (id, summit_id, date, notes, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, summitId, date, notes || null, createdAt]
    );
    
    const newVisit = await dbGet('SELECT * FROM visits WHERE id = ?', [id]);
    
    res.status(201).json({
      id: newVisit.id,
      summitId: newVisit.summit_id,
      date: newVisit.date,
      notes: newVisit.notes,
      createdAt: newVisit.created_at
    });
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({ error: 'Failed to create visit' });
  }
});

// PUT update visit
app.put('/api/visits/:id', async (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const { date, notes } = req.body;
    
    const existing = await dbGet('SELECT * FROM visits WHERE id = ?', [visitId]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    
    await dbRun(
      'UPDATE visits SET date = ?, notes = ? WHERE id = ?',
      [date || existing.date, notes !== undefined ? notes : existing.notes, visitId]
    );
    
    const updated = await dbGet('SELECT * FROM visits WHERE id = ?', [visitId]);
    
    res.json({
      id: updated.id,
      summitId: updated.summit_id,
      date: updated.date,
      notes: updated.notes,
      createdAt: updated.created_at
    });
  } catch (error) {
    console.error('Error updating visit:', error);
    res.status(500).json({ error: 'Failed to update visit' });
  }
});

// DELETE visit
app.delete('/api/visits/:id', async (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    
    const existing = await dbGet('SELECT * FROM visits WHERE id = ?', [visitId]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    
    await dbRun('DELETE FROM visits WHERE id = ?', [visitId]);
    
    res.json({ message: 'Visit deleted successfully' });
  } catch (error) {
    console.error('Error deleting visit:', error);
    res.status(500).json({ error: 'Failed to delete visit' });
  }
});

// ===== STATS ENDPOINT =====

app.get('/api/stats', async (req, res) => {
  try {
    const stats = {};
    
    // Total summits
    const summitCount = await dbGet('SELECT COUNT(*) as count FROM summits');
    stats.totalSummits = summitCount.count;
    
    // Total visits
    const visitCount = await dbGet('SELECT COUNT(*) as count FROM visits');
    stats.totalVisits = visitCount.count;
    
    // Years with visits
    const years = await dbAll(`
      SELECT DISTINCT strftime('%Y', date) as year 
      FROM visits 
      ORDER BY year DESC
    `);
    stats.years = years.map(y => y.year);
    
    // Visits by year
    const visitsByYear = await dbAll(`
      SELECT strftime('%Y', date) as year, COUNT(*) as count
      FROM visits
      GROUP BY year
      ORDER BY year
    `);
    stats.visitsByYear = visitsByYear.reduce((acc, item) => {
      acc[item.year] = item.count;
      return acc;
    }, {});
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ===== IMPORT/EXPORT ENDPOINTS =====

app.post('/api/import', async (req, res) => {
  try {
    const { summits, visits } = req.body;
    
    if (!summits && !visits) {
      return res.status(400).json({ error: 'No data to import' });
    }
    
    let importedSummits = 0;
    let importedVisits = 0;
    
    // Import summits
    if (summits && Array.isArray(summits)) {
      for (const summit of summits) {
        try {
          const createdAt = summit.createdAt || new Date().toISOString();
          await dbRun(
            `INSERT OR IGNORE INTO summits (id, name, latitude, longitude, elevation, wikipedia, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [summit.id, summit.name, summit.latitude, summit.longitude, summit.elevation, summit.wikipedia, createdAt, summit.updatedAt]
          );
          importedSummits++;
        } catch (err) {
          console.error('Error importing summit:', err);
        }
      }
    }
    
    // Import visits
    if (visits && Array.isArray(visits)) {
      for (const visit of visits) {
        try {
          const createdAt = visit.createdAt || new Date().toISOString();
          await dbRun(
            'INSERT OR IGNORE INTO visits (id, summit_id, date, notes, created_at) VALUES (?, ?, ?, ?, ?)',
            [visit.id, visit.summitId, visit.date, visit.notes, createdAt]
          );
          importedVisits++;
        } catch (err) {
          console.error('Error importing visit:', err);
        }
      }
    }
    
    res.json({
      message: 'Import completed',
      importedSummits,
      importedVisits
    });
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const summits = await dbAll('SELECT * FROM summits');
    const visits = await dbAll('SELECT * FROM visits');
    
    // Format for JSON export (camelCase)
    const exportData = {
      summits: summits.map(s => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        elevation: s.elevation,
        wikipedia: s.wikipedia,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      })),
      visits: visits.map(v => ({
        id: v.id,
        summitId: v.summit_id,
        date: v.date,
        notes: v.notes,
        createdAt: v.created_at
      })),
      exportedAt: new Date().toISOString()
    };
    
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
