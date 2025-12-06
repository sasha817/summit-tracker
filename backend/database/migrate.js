#!/usr/bin/env node

/**
 * Migration Script: JSON to SQLite
 * Migrates existing summits.json and visits.json to SQLite database
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const SUMMITS_JSON = path.join(DATA_DIR, 'summits.json');
const VISITS_JSON = path.join(DATA_DIR, 'visits.json');
const DB_PATH = path.join(DATA_DIR, 'summits.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');

// Promisify db methods
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Main migration function
async function runMigration() {
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  console.log('=== Summit Tracker: JSON to SQLite Migration ===\n');

  // Step 1: Backup existing JSON files
  console.log('Step 1: Creating backups...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (fs.existsSync(SUMMITS_JSON)) {
    const backupPath = path.join(BACKUP_DIR, `summits_${timestamp}.json`);
    fs.copyFileSync(SUMMITS_JSON, backupPath);
    console.log(`  ✓ Backed up summits.json to ${backupPath}`);
  }

  if (fs.existsSync(VISITS_JSON)) {
    const backupPath = path.join(BACKUP_DIR, `visits_${timestamp}.json`);
    fs.copyFileSync(VISITS_JSON, backupPath);
    console.log(`  ✓ Backed up visits.json to ${backupPath}`);
  }

  // Step 2: Read JSON data
  console.log('\nStep 2: Reading JSON data...');
  let summits = [];
  let visits = [];

  try {
    if (fs.existsSync(SUMMITS_JSON)) {
      summits = JSON.parse(fs.readFileSync(SUMMITS_JSON, 'utf-8'));
      console.log(`  ✓ Read ${summits.length} summits`);
    } else {
      console.log('  ⚠ No summits.json found - starting with empty data');
    }

    if (fs.existsSync(VISITS_JSON)) {
      visits = JSON.parse(fs.readFileSync(VISITS_JSON, 'utf-8'));
      console.log(`  ✓ Read ${visits.length} visits`);
    } else {
      console.log('  ⚠ No visits.json found - starting with empty data');
    }
  } catch (error) {
    console.error('  ✗ Error reading JSON files:', error.message);
    process.exit(1);
  }

  // Step 3: Handle existing database
  console.log('\nStep 3: Preparing SQLite database...');
  if (fs.existsSync(DB_PATH)) {
    console.log('  ⚠ Database already exists!');
    console.log('  Creating backup and removing old database...');
    const dbBackupPath = path.join(BACKUP_DIR, `summits_${timestamp}.db`);
    fs.copyFileSync(DB_PATH, dbBackupPath);
    fs.unlinkSync(DB_PATH);
    console.log(`  ✓ Backed up existing database to ${dbBackupPath}`);
  }

  // Step 4: Create database
  console.log('\nStep 4: Creating new database...');
  const db = new sqlite3.Database(DB_PATH);
  
  // Enable foreign keys
  await dbRun(db, 'PRAGMA foreign_keys = ON');
  console.log('  ✓ Database created successfully');

  // Step 5: Create schema
  console.log('\nStep 5: Creating database schema...');
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      await dbRun(db, statement);
    }
    
    console.log(`  ✓ Executed ${statements.length} schema statements`);
  } catch (error) {
    console.error('  ✗ Error creating schema:', error.message);
    db.close();
    process.exit(1);
  }

  // Step 6: Migrate summits
  console.log('\nStep 6: Migrating summits...');
  let summitsInserted = 0;
  let summitsErrors = 0;

  for (const summit of summits) {
    try {
      await dbRun(
        db,
        `INSERT INTO summits (id, name, latitude, longitude, elevation, wikipedia, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          summit.id,
          summit.name,
          summit.latitude,
          summit.longitude,
          summit.elevation || null,
          summit.wikipedia || null,
          summit.createdAt,
          summit.updatedAt || null
        ]
      );
      summitsInserted++;
    } catch (error) {
      console.error(`  ✗ Error inserting summit ${summit.name}:`, error.message);
      summitsErrors++;
    }
  }

  console.log(`  ✓ Inserted ${summitsInserted} summits`);
  if (summitsErrors > 0) {
    console.log(`  ⚠ ${summitsErrors} errors occurred`);
  }

  // Step 7: Migrate visits
  console.log('\nStep 7: Migrating visits...');
  let visitsInserted = 0;
  let visitsErrors = 0;

  for (const visit of visits) {
    try {
      await dbRun(
        db,
        `INSERT INTO visits (id, summit_id, date, notes, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          visit.id,
          visit.summitId,
          visit.date,
          visit.notes || null,
          visit.createdAt
        ]
      );
      visitsInserted++;
    } catch (error) {
      console.error(`  ✗ Error inserting visit:`, error.message);
      visitsErrors++;
    }
  }

  console.log(`  ✓ Inserted ${visitsInserted} visits`);
  if (visitsErrors > 0) {
    console.log(`  ⚠ ${visitsErrors} errors occurred`);
  }

  // Step 8: Verify migration
  console.log('\nStep 8: Verifying migration...');

  try {
    const summitCount = await dbGet(db, 'SELECT COUNT(*) as count FROM summits');
    console.log(`  ✓ Database contains ${summitCount.count} summits`);

    const visitCount = await dbGet(db, 'SELECT COUNT(*) as count FROM visits');
    console.log(`  ✓ Database contains ${visitCount.count} visits`);

    // Close database
    db.close((err) => {
      if (err) {
        console.error('\n✗ Error closing database:', err.message);
      } else {
        console.log('\n=== Migration completed successfully! ===');
        console.log(`\nDatabase location: ${DB_PATH}`);
        console.log(`Backups location: ${BACKUP_DIR}`);
        console.log('\nNext steps:');
        console.log('1. Test the new database by starting the server');
        console.log('2. If everything works, you can archive the JSON files');
        console.log('3. Update your .env file with DB_PATH if needed');
      }
    });
  } catch (error) {
    console.error('  ✗ Error verifying data:', error.message);
    db.close();
    process.exit(1);
  }
}

// Run migration
runMigration().catch(err => {
  console.error('\n✗ Migration failed:', err.message);
  process.exit(1);
});