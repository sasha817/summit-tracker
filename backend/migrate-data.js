const fs = require('fs').promises;
const path = require('path');

// Migration script to convert old format to new format
async function migrateData() {
  const oldFile = path.join(__dirname, 'data', 'summits.json');
  const summitsFile = path.join(__dirname, 'data', 'summits.json.new');
  const visitsFile = path.join(__dirname, 'data', 'visits.json');
  
  try {
    // Read old data
    const oldData = await fs.readFile(oldFile, 'utf-8');
    const oldSummits = JSON.parse(oldData);
    
    console.log(`Found ${oldSummits.length} summits to migrate...`);
    
    const newSummits = [];
    const visits = [];
    
    oldSummits.forEach((oldSummit, index) => {
      // Create summit (without date)
      const summit = {
        id: oldSummit.id,
        name: oldSummit.name,
        latitude: oldSummit.latitude,
        longitude: oldSummit.longitude,
        elevation: oldSummit.elevation || null,
        wikipedia: oldSummit.wikipedia || null,
        createdAt: oldSummit.createdAt || new Date().toISOString()
      };
      newSummits.push(summit);
      
      // Create a visit for each old summit
      const visit = {
        id: oldSummit.id + 1000000, // Ensure unique ID
        summitId: oldSummit.id,
        date: oldSummit.date,
        notes: null,
        createdAt: oldSummit.createdAt || new Date().toISOString()
      };
      visits.push(visit);
      
      console.log(`✓ Migrated: ${summit.name} (visit on ${visit.date})`);
    });
    
    // Write new files
    await fs.writeFile(summitsFile, JSON.stringify(newSummits, null, 2), 'utf-8');
    await fs.writeFile(visitsFile, JSON.stringify(visits, null, 2), 'utf-8');
    
    // Backup old file
    await fs.copyFile(oldFile, oldFile + '.backup');
    
    console.log('\n✅ Migration complete!');
    console.log(`Created: ${summitsFile}`);
    console.log(`Created: ${visitsFile}`);
    console.log(`Backup: ${oldFile}.backup`);
    console.log('\nTo apply the migration:');
    console.log('1. Stop your backend server');
    console.log('2. Run: mv backend/data/summits.json.new backend/data/summits.json');
    console.log('3. Restart your backend server');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateData();