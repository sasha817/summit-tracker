const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { dbRun, dbGet, dbAll } = require('./db');

const SALT_ROUNDS = 10;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Create a new user
 */
async function createUser(username, password, email = null) {
  try {
    // Check if username already exists
    const existing = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) {
      throw new Error('Username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const createdAt = new Date().toISOString();

    await dbRun(
      'INSERT INTO users (username, password_hash, email, created_at) VALUES (?, ?, ?, ?)',
      [username, passwordHash, email, createdAt]
    );

    const user = await dbGet('SELECT id, username, email, created_at FROM users WHERE username = ?', [username]);
    return user;
  } catch (error) {
    throw error;
  }
}

/**
 * Verify user credentials
 */
async function verifyUser(username, password) {
  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return null;
    }

    // Update last login
    await dbRun('UPDATE users SET last_login = ? WHERE id = ?', [new Date().toISOString(), user.id]);

    // Return user without password hash
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Create a session for a user
 */
async function createSession(userId) {
  try {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();

    await dbRun(
      'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, userId, createdAt, expiresAt]
    );

    return sessionId;
  } catch (error) {
    throw error;
  }
}

/**
 * Verify session and return user
 */
async function verifySession(sessionId) {
  try {
    const session = await dbGet(
      `SELECT s.*, u.id as user_id, u.username, u.email 
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > ?`,
      [sessionId, new Date().toISOString()]
    );

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      user: {
        id: session.user_id,
        username: session.username,
        email: session.email
      }
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Delete a session (logout)
 */
async function deleteSession(sessionId) {
  try {
    await dbRun('DELETE FROM sessions WHERE id = ?', [sessionId]);
  } catch (error) {
    throw error;
  }
}

/**
 * Clean up expired sessions
 */
async function cleanupSessions() {
  try {
    await dbRun('DELETE FROM sessions WHERE expires_at < ?', [new Date().toISOString()]);
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
}

/**
 * Authentication middleware
 */
function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  verifySession(sessionId)
    .then(session => {
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      req.user = session.user;
      req.sessionId = session.sessionId;
      next();
    })
    .catch(error => {
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Authentication error' });
    });
}

/**
 * Optional auth middleware (doesn't fail if not authenticated)
 */
function optionalAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

  if (!sessionId) {
    return next();
  }

  verifySession(sessionId)
    .then(session => {
      if (session) {
        req.user = session.user;
        req.sessionId = session.sessionId;
      }
      next();
    })
    .catch(error => {
      console.error('Auth error:', error);
      next();
    });
}

// Clean up expired sessions every hour
setInterval(cleanupSessions, 60 * 60 * 1000);

module.exports = {
  createUser,
  verifyUser,
  createSession,
  verifySession,
  deleteSession,
  requireAuth,
  optionalAuth
};
