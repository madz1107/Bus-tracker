const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Paths
const dataFilePath = path.join(__dirname, 'data.json');
const publicDir = path.join(__dirname, 'public');

// In-Memory Database Store
let db = {
  routes: [],
  buses: [],
  users: []
};

// Helper: Load Data
function loadData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      let raw = fs.readFileSync(dataFilePath, 'utf8');
      // Strip UTF-8 BOM if present
      raw = raw.replace(/^\uFEFF/, '');
      db = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Warning: Could not read data.json, using current in-memory state.', err.message);
  }
  if (!Array.isArray(db.routes)) db.routes = [];
  if (!Array.isArray(db.buses)) db.buses = [];
  if (!Array.isArray(db.users)) db.users = [];
  return db;
}

// Helper: Save Data (safe for read-only serverless platforms like Vercel)
function saveData() {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    // On serverless environments (e.g. Vercel), disk is read-only. We silently maintain in-memory updates.
    console.warn('Notice: Disk write skipped or read-only filesystem (in-memory state updated):', err.message);
  }
}

// Initial Load
loadData();

// Serve Static Frontend Assets
app.use(express.static(publicDir));

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Full State Snapshot
app.get('/api/state', (req, res) => {
  res.json(db);
});

// 2. Authentication: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password, expectedRole } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const matched = db.users.find(u => 
    (u.email === email || u.id === email || u.busId === email) && u.password === password
  );

  if (!matched) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  if (expectedRole && matched.role !== expectedRole) {
    const expectedName = expectedRole.charAt(0).toUpperCase() + expectedRole.slice(1).toLowerCase();
    const actualName = matched.role.charAt(0).toUpperCase() + matched.role.slice(1).toLowerCase();
    return res.status(403).json({
      success: false,
      error: `Access Denied: This account is a ${actualName} account. Please select the ${actualName} tab to sign in.`
    });
  }

  res.json({
    success: true,
    user: {
      id: matched.id,
      name: matched.name,
      email: matched.email,
      role: matched.role,
      busId: matched.busId || null
    }
  });
});

// 2b. Authentication: Passenger Registration
app.post('/api/auth/register', (req, res) => {
  const { email, password, name, phone } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
  }

  const existing = db.users.find(u => u.email === email);
  if (existing) {
    return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
  }

  const newUser = {
    id: 'user-pass-' + Math.floor(100 + Math.random() * 9000),
    email,
    password,
    name,
    phone: phone || '',
    role: 'passenger'
  };

  db.users.push(newUser);
  saveData();

  res.json({ success: true, user: newUser });
});

// 3. Routes: Get All
app.get('/api/routes', (req, res) => {
  res.json(db.routes || []);
});

// 3b. Routes: Create / Update
app.post('/api/routes', (req, res) => {
  const routeData = req.body;
  if (!routeData.id) {
    routeData.id = 'route-' + Math.floor(10 + Math.random() * 90);
  }

  const existingIdx = db.routes.findIndex(r => r.id === routeData.id);
  if (existingIdx >= 0) {
    db.routes[existingIdx] = routeData;
  } else {
    db.routes.push(routeData);
  }
  saveData();
  res.json({ success: true, route: routeData });
});

// 3c. Routes: Delete
app.delete('/api/routes/:id', (req, res) => {
  const routeId = req.params.id;
  db.routes = db.routes.filter(r => r.id !== routeId);
  saveData();
  res.json({ success: true, message: 'Route deleted' });
});

// 3d. Routes: Add Stop
app.post('/api/routes/:id/stops', (req, res) => {
  const routeId = req.params.id;
  const stopData = req.body;
  const route = db.routes.find(r => r.id === routeId);

  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }

  if (!stopData.id) {
    stopData.id = `stop-${routeId}-${Math.floor(10 + Math.random() * 990)}`;
  }
  if (!Array.isArray(route.stops)) {
    route.stops = [];
  }
  route.stops.push(stopData);
  saveData();
  res.json({ success: true, stop: stopData });
});

// 3e. Routes: Delete Stop
app.delete('/api/routes/:id/stops/:stopId', (req, res) => {
  const { id: routeId, stopId } = req.params;
  const route = db.routes.find(r => r.id === routeId);

  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }

  if (Array.isArray(route.stops)) {
    route.stops = route.stops.filter(s => s.id !== stopId);
    saveData();
  }
  res.json({ success: true, message: 'Stop removed' });
});

// 4. Buses: Get All
app.get('/api/buses', (req, res) => {
  res.json(db.buses || []);
});

// 4b. Buses: Get Single Bus
app.get('/api/buses/:id', (req, res) => {
  const bus = db.buses.find(b => b.id === req.params.id);
  if (bus) {
    res.json(bus);
  } else {
    res.status(404).json({ error: 'Bus not found' });
  }
});

// 4c. Buses: GPS Location Broadcast
app.post('/api/buses/:id/location', (req, res) => {
  const busId = req.params.id;
  const body = req.body;
  const bus = db.buses.find(b => b.id === busId);

  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  if (body.lat !== undefined) bus.lat = Number(body.lat);
  if (body.lng !== undefined) bus.lng = Number(body.lng);
  if (body.speed !== undefined) bus.speed = Number(body.speed);
  if (body.bearing !== undefined) bus.bearing = Number(body.bearing);
  if (body.status !== undefined) bus.status = String(body.status);
  if (body.routeProgress !== undefined) bus.routeProgress = Number(body.routeProgress);
  if (body.currentStopId !== undefined) bus.currentStopId = String(body.currentStopId);
  if (body.currentStopName !== undefined) bus.currentStopName = String(body.currentStopName);
  if (body.nextStopId !== undefined) bus.nextStopId = String(body.nextStopId);
  if (body.nextStopName !== undefined) bus.nextStopName = String(body.nextStopName);
  if (body.distanceToNextKm !== undefined) bus.distanceToNextKm = Number(body.distanceToNextKm);
  if (body.etaMinutes !== undefined) bus.etaMinutes = Number(body.etaMinutes);
  if (body.reachedStopIds !== undefined) bus.reachedStopIds = body.reachedStopIds;
  if (body.isTripActive !== undefined) bus.isTripActive = Boolean(body.isTripActive);
  if (body.simulatorIndex !== undefined) bus.simulatorIndex = Number(body.simulatorIndex);
  if (body.crowdLevel !== undefined) bus.crowdLevel = String(body.crowdLevel);

  bus.lastUpdated = new Date().toISOString();
  saveData();

  res.json({ success: true, bus });
});

// 4d. Buses: Crowd Level Broadcast
app.post('/api/buses/:id/crowd', (req, res) => {
  const bus = db.buses.find(b => b.id === req.params.id);
  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  if (req.body.crowdLevel) {
    bus.crowdLevel = String(req.body.crowdLevel);
  }
  bus.lastUpdated = new Date().toISOString();
  saveData();

  res.json({ success: true, bus });
});

// 4e. Buses: Trip Control (Start / End Trip)
app.post('/api/buses/:id/trip', (req, res) => {
  const bus = db.buses.find(b => b.id === req.params.id);
  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  const isActive = Boolean(req.body.isActive);
  bus.isTripActive = isActive;
  bus.status = isActive ? 'Running' : 'Offline';
  if (!isActive) {
    bus.speed = 0;
  }
  bus.lastUpdated = new Date().toISOString();
  saveData();

  res.json({ success: true, bus });
});

// 4f. Buses: Create / Update Bus (Admin)
app.post('/api/buses', (req, res) => {
  const newBus = req.body;
  if (!newBus.id) {
    newBus.id = 'BUS-' + Math.floor(100 + Math.random() * 900);
  }
  newBus.lastUpdated = new Date().toISOString();

  // Upsert bus driver/conductor login if provided
  if (newBus.loginEmail) {
    const existingUserIdx = db.users.findIndex(u => u.busId === newBus.id || u.email === newBus.loginEmail);
    const existingPassword = existingUserIdx >= 0 ? db.users[existingUserIdx].password : 'pass123';
    const passwordToSet = newBus.loginPassword || existingPassword;

    const busUser = {
      id: existingUserIdx >= 0 ? db.users[existingUserIdx].id : 'bus-user-' + Math.floor(100 + Math.random() * 900),
      email: newBus.loginEmail,
      password: passwordToSet,
      name: newBus.BusName || 'Bus Driver',
      role: 'Bus',
      busId: newBus.id
    };

    if (existingUserIdx >= 0) {
      db.users[existingUserIdx] = busUser;
    } else {
      db.users.push(busUser);
    }
  }

  // Remove password from bus payload before saving
  delete newBus.loginPassword;

  const existingIdx = db.buses.findIndex(b => b.id === newBus.id);
  if (existingIdx >= 0) {
    db.buses[existingIdx] = newBus;
  } else {
    db.buses.push(newBus);
  }

  saveData();
  res.json({ success: true, bus: newBus });
});

// 4g. Buses: Delete Bus
app.delete('/api/buses/:id', (req, res) => {
  const busId = req.params.id;
  db.buses = db.buses.filter(b => b.id !== busId);
  saveData();
  res.json({ success: true, message: 'Bus removed' });
});

// Fallback route: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start Server if run directly (Standalone Node, Localhost, Render, etc.)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Smart Bus Tracking Server running at http://localhost:${PORT}/`);
  });
}

// Export for Vercel Serverless Functions
module.exports = app;
