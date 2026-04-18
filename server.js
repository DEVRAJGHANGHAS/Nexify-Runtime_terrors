/**
 * Blood Finder — Backend Server with SQLite Database
 * Handles user registration, login validation, and duplicate checking.
 */

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ─── Real-Time WebSocket Setup ────────────────────────────────
const activeUsers = new Map(); // socket.id -> { mobile, name, lat, lng }

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1); 
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}
function deg2rad(deg) { return deg * (Math.PI/180); }

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('update_location', (data) => {
    activeUsers.set(socket.id, { ...data, socketId: socket.id });
  });

  socket.on('publish_need', (data) => {
    // Broadcast to users in radius
    for (let [id, user] of activeUsers.entries()) {
      if (id !== socket.id && user.lat && user.lng) {
        let dist = getDistanceFromLatLonInKm(data.lat, data.lng, user.lat, user.lng);
        if (dist <= data.radius) {
          io.to(id).emit('blood_alert', { ...data, distance: dist.toFixed(1) });
        }
      }
    }
  });

  socket.on('publish_availability', (data) => {
    // Broadcast donor availability to users in radius
    for (let [id, user] of activeUsers.entries()) {
      if (id !== socket.id && user.lat && user.lng) {
        let dist = getDistanceFromLatLonInKm(data.lat, data.lng, user.lat, user.lng);
        if (dist <= data.radius) {
          io.to(id).emit('donor_available', { ...data, distance: dist.toFixed(1) });
        }
      }
    }
  });

  socket.on('chat_message', (data) => {
    // data: { toMobile, toName, message, fromName, fromMobile }
    for (let [id, user] of activeUsers.entries()) {
      if (user.mobile === data.toMobile || user.name === data.toName || user.name === data.toName) {
        io.to(id).emit('chat_received', data);
      }
    }
  });

  socket.on('disconnect', () => {
    activeUsers.delete(socket.id);
  });
});

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' })); // increased for chat history

// ─── SQLite Database Setup ───────────────────────────────────
const db = new Database(path.join(__dirname, 'bloodfinder.db'), { verbose: console.log });

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create users table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    mobile      TEXT    NOT NULL UNIQUE,
    email       TEXT    NOT NULL UNIQUE,
    blood_group TEXT    DEFAULT '',
    created_at  TEXT    DEFAULT (datetime('now'))
  );
`);

// Add extra profile columns (safe if already exist)
const extraCols = [
  { name: 'dob',                type: 'TEXT DEFAULT ""' },
  { name: 'address',            type: 'TEXT DEFAULT ""' },
  { name: 'last_donated',       type: 'TEXT DEFAULT ""' },
  { name: 'medical_conditions', type: 'TEXT DEFAULT ""' },
];
for (const col of extraCols) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type};`); }
  catch (e) { /* column already exists — ignore */ }
}

// Create user_progress table — stores chats & any extra JSON per user
db.exec(`
  CREATE TABLE IF NOT EXISTS user_progress (
    user_id     INTEGER PRIMARY KEY,
    chats       TEXT    DEFAULT '{}',
    extra_data  TEXT    DEFAULT '{}',
    updated_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

console.log('✅ SQLite database ready — users + user_progress tables initialized');

// ─── API: Check if user exists (by mobile or email) ─────────
app.post('/api/user/check', (req, res) => {
  const { mobile, email } = req.body;

  if (!mobile && !email) {
    return res.json({ success: false, message: 'Please provide mobile or email' });
  }

  let user = null;

  if (mobile) {
    user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
  }
  if (!user && email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  if (user) {
    return res.json({
      success: true,
      exists: true,
      user: { name: user.name, mobile: user.mobile, email: user.email, blood_group: user.blood_group }
    });
  }

  return res.json({ success: true, exists: false });
});

// ─── API: Register new user ─────────────────────────────────
app.post('/api/user/register', (req, res) => {
  const { name, dob, mobile, email, blood_group } = req.body;

  // Validate required fields
  if (!name || !mobile || !email) {
    return res.json({
      success: false,
      message: '⚠️ Name, Mobile Number, and Email are all required!'
    });
  }

  // Check if mobile already exists
  const existingMobile = db.prepare('SELECT id, mobile, email FROM users WHERE mobile = ?').get(mobile);
  if (existingMobile) {
    return res.json({
      success: false,
      message: '🚫 This mobile number is already registered! Please login instead.',
      duplicate: 'mobile'
    });
  }

  // Check if email already exists
  const existingEmail = db.prepare('SELECT id, mobile, email FROM users WHERE email = ?').get(email);
  if (existingEmail) {
    return res.json({
      success: false,
      message: '🚫 This email address is already registered! Please login instead.',
      duplicate: 'email'
    });
  }

  // Insert new user
  try {
    const stmt = db.prepare('INSERT INTO users (name, dob, mobile, email, blood_group) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(name, dob || '', mobile, email, blood_group || '');

    console.log(`✅ New user registered: ${name} | ${mobile} | ${email}`);

    return res.json({
      success: true,
      message: '✅ Account created successfully!',
      user: {
        id: result.lastInsertRowid,
        name, mobile, email, blood_group
      }
    });
  } catch (err) {
    // Catch UNIQUE constraint violation just in case
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.json({
        success: false,
        message: '🚫 This mobile number or email is already registered!'
      });
    }
    console.error('Registration error:', err);
    return res.json({ success: false, message: 'Server error during registration.' });
  }
});

// ─── API: Login check — verify user exists in DB ─────────────
app.post('/api/user/login', (req, res) => {
  const { mobile, email } = req.body;

  if (!mobile && !email) {
    return res.json({ success: false, message: 'Please provide mobile or email' });
  }

  let user = null;

  if (mobile) {
    user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
  }
  if (!user && email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  if (!user) {
    return res.json({
      success: false,
      exists: false,
      message: '❌ No account found with this information. Please create an account first!'
    });
  }

  // User exists — return user data for session
  return res.json({
    success: true,
    exists: true,
    message: '✅ Login successful!',
    user: {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      blood_group: user.blood_group
    }
  });
});

// ─── API: Get all users (debug/admin) ────────────────────────
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, name, mobile, email, blood_group, created_at FROM users').all();
  res.json({ success: true, count: users.length, users });
});

// ─── API: Check duplicate on the fly (real-time validation) ──
app.post('/api/user/check-duplicate', (req, res) => {
  const { field, value } = req.body;

  if (!field || !value) {
    return res.json({ success: false, message: 'field and value required' });
  }

  let exists = false;

  if (field === 'mobile') {
    exists = !!db.prepare('SELECT id FROM users WHERE mobile = ?').get(value);
  } else if (field === 'email') {
    exists = !!db.prepare('SELECT id FROM users WHERE email = ?').get(value);
  }

  return res.json({ success: true, exists, field });
});

// ─── API: Save user progress (called on logout & auto-sync) ──
app.post('/api/user/save-progress', (req, res) => {
  const { mobile, email, profile, chats } = req.body;

  if (!mobile && !email) {
    return res.json({ success: false, message: 'User identifier required' });
  }

  // Find the user
  let user = null;
  if (mobile) user = db.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile);
  if (!user && email) user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.json({ success: false, message: 'User not found in database' });
  }

  try {
    // Update profile fields in users table
    if (profile) {
      db.prepare(`
        UPDATE users SET
          name = COALESCE(?, name),
          blood_group = COALESCE(?, blood_group),
          address = COALESCE(?, address),
          last_donated = COALESCE(?, last_donated),
          medical_conditions = COALESCE(?, medical_conditions)
        WHERE id = ?
      `).run(
        profile.name || null,
        profile.blood_group || null,
        profile.address || null,
        profile.last_donated || null,
        profile.medical_conditions || null,
        user.id
      );
    }

    // Save chats & extra data in user_progress table (UPSERT)
    const chatsJson = JSON.stringify(chats || {});
    const existing = db.prepare('SELECT user_id FROM user_progress WHERE user_id = ?').get(user.id);

    if (existing) {
      db.prepare(`
        UPDATE user_progress SET chats = ?, updated_at = datetime('now') WHERE user_id = ?
      `).run(chatsJson, user.id);
    } else {
      db.prepare(`
        INSERT INTO user_progress (user_id, chats, updated_at) VALUES (?, ?, datetime('now'))
      `).run(user.id, chatsJson);
    }

    console.log(`💾 Progress saved for user #${user.id} (${mobile || email})`);
    return res.json({ success: true, message: '✅ All progress saved!' });

  } catch (err) {
    console.error('Save progress error:', err);
    return res.json({ success: false, message: 'Failed to save progress' });
  }
});

// ─── API: Load user progress (called on login) ──────────────
app.post('/api/user/load-progress', (req, res) => {
  const { mobile, email } = req.body;

  if (!mobile && !email) {
    return res.json({ success: false, message: 'User identifier required' });
  }

  // Find the user
  let user = null;
  if (mobile) user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
  if (!user && email) user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.json({ success: false, message: 'User not found' });
  }

  // Load progress from user_progress table
  const progress = db.prepare('SELECT chats, extra_data FROM user_progress WHERE user_id = ?').get(user.id);

  let chats = {};
  try { chats = JSON.parse(progress?.chats || '{}'); } catch (e) { chats = {}; }

  return res.json({
    success: true,
    profile: {
      name:               user.name,
      dob:                user.dob || '',
      mobile:             user.mobile,
      email:              user.email,
      blood_group:        user.blood_group,
      address:            user.address || '',
      last_donated:       user.last_donated || '',
      medical_conditions: user.medical_conditions || ''
    },
    chats: chats
  });
});

// ─── Static file serving (AFTER API routes) ─────────────────
app.use(express.static(path.join(__dirname)));

// ─── Fallback: serve index.html for unknown routes ───────────
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🩸 Blood Finder Server running at http://localhost:${PORT}`);
  console.log(`📂 SQLite DB: ${path.join(__dirname, 'bloodfinder.db')}`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser\n`);
});
