require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Paths
const dataFilePath = path.join(__dirname, 'data.json');
const publicDir = path.join(__dirname, 'public');

// Initialize Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yvjfcmjmlcuzxscvuzhm.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2amZjbWptbGN1enhzY3Z1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMjU3MzUsImV4cCI6MjEwNzgwMTczNX0.dZ7IL_sySbvIYApMWVkWJZN4gMKkufbIZqOicO9uIXQ';

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase connected:', SUPABASE_URL);
  } catch (err) {
    console.warn('⚠️ Supabase initialization skipped:', err.message);
  }
}

// In-Memory Database Store (with JSON file fallback)
let db = {
  routes: [],
  buses: [],
  users: []
};

// Helper: Convert Postgres snake_case row to App camelCase bus model
function rowToBus(row) {
  if (!row) return null;
  return {
    id: row.id,
    busNumber: row.bus_number,
    regNumber: row.reg_number,
    BusName: row.bus_name,
    name: row.bus_name,
    routeId: row.route_id,
    assignedRouteIds: row.assigned_route_ids || [],
    conductorId: row.conductor_id,
    conductorName: row.conductor_name,
    conductorPhone: row.conductor_phone,
    status: row.status,
    lat: Number(row.lat),
    lng: Number(row.lng),
    speed: Number(row.speed || 0),
    bearing: Number(row.bearing || 0),
    currentStopId: row.current_stop_id,
    currentStopName: row.current_stop_name,
    nextStopId: row.next_stop_id,
    nextStopName: row.next_stop_name,
    distanceToNextKm: Number(row.distance_to_next_km || 0),
    etaMinutes: Number(row.eta_minutes || 0),
    routeProgress: Number(row.route_progress || 0),
    reachedStopIds: row.reached_stop_ids || [],
    crowdLevel: row.crowd_level || 'Moderate',
    isTripActive: Boolean(row.is_trip_active),
    isVetriPayanam: Boolean(row.is_vetri_payanam !== undefined ? row.is_vetri_payanam : row.isVetriPayanam),
    simulatorIndex: Number(row.simulator_index || 0),
    lastUpdated: row.last_updated
  };
}

// Helper: Convert App camelCase bus model to Postgres snake_case row
function busToRow(bus) {
  const row = {};
  if (bus.id !== undefined) row.id = bus.id;
  if (bus.busNumber !== undefined) row.bus_number = bus.busNumber;
  if (bus.regNumber !== undefined) row.reg_number = bus.regNumber;
  if (bus.BusName !== undefined || bus.name !== undefined) row.bus_name = bus.BusName || bus.name;
  
  if (bus.routeId !== undefined) {
    const routeExists = db.routes && db.routes.some(r => r.id === bus.routeId);
    row.route_id = routeExists ? bus.routeId : null;
  }
  
  if (bus.assignedRouteIds !== undefined) row.assigned_route_ids = bus.assignedRouteIds;
  if (bus.conductorId !== undefined) row.conductor_id = bus.conductorId;
  if (bus.conductorName !== undefined) row.conductor_name = bus.conductorName;
  if (bus.conductorPhone !== undefined) row.conductor_phone = bus.conductorPhone;
  if (bus.status !== undefined) row.status = bus.status;
  if (bus.lat !== undefined) row.lat = Number(bus.lat);
  if (bus.lng !== undefined) row.lng = Number(bus.lng);
  if (bus.speed !== undefined) row.speed = Number(bus.speed);
  if (bus.bearing !== undefined) row.bearing = Number(bus.bearing);
  if (bus.currentStopId !== undefined) row.current_stop_id = bus.currentStopId;
  if (bus.currentStopName !== undefined) row.current_stop_name = bus.currentStopName;
  if (bus.nextStopId !== undefined) row.next_stop_id = bus.nextStopId;
  if (bus.nextStopName !== undefined) row.next_stop_name = bus.nextStopName;
  if (bus.distanceToNextKm !== undefined) row.distance_to_next_km = Number(bus.distanceToNextKm);
  if (bus.etaMinutes !== undefined) row.eta_minutes = Number(bus.etaMinutes);
  if (bus.routeProgress !== undefined) row.route_progress = Number(bus.routeProgress);
  if (bus.reachedStopIds !== undefined) row.reached_stop_ids = bus.reachedStopIds;
  if (bus.crowdLevel !== undefined) row.crowd_level = bus.crowdLevel;
  if (bus.isTripActive !== undefined) row.is_trip_active = Boolean(bus.isTripActive);
  if (bus.isVetriPayanam !== undefined) row.is_vetri_payanam = Boolean(bus.isVetriPayanam);
  if (bus.simulatorIndex !== undefined) row.simulator_index = Number(bus.simulatorIndex);
  row.last_updated = new Date().toISOString();
  return row;
}

// Helper: Load Data from local JSON fallback
function loadData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      let raw = fs.readFileSync(dataFilePath, 'utf8');
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

// Helper: Save Data to local JSON (safe for serverless read-only disk)
function saveData() {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    // Disk write skipped on read-only environments
  }
}

// Refresh data from Supabase Cloud
async function syncFromSupabase() {
  if (!supabase) return;
  try {
    const [routesRes, busesRes, usersRes] = await Promise.all([
      supabase.from('routes').select('*').order('code', { ascending: true }),
      supabase.from('buses').select('*').order('bus_number', { ascending: true }),
      supabase.from('users').select('*')
    ]);

    if (!routesRes.error && Array.isArray(routesRes.data)) {
      db.routes = routesRes.data;
    }
    if (!busesRes.error && Array.isArray(busesRes.data)) {
      db.buses = busesRes.data.map(rowToBus);
    }
    if (!usersRes.error && Array.isArray(usersRes.data) && usersRes.data.length > 0) {
      db.users = usersRes.data;
    }
    saveData();
    console.log(`📡 Synced from Supabase: ${db.routes.length} routes, ${db.buses.length} buses, ${db.users.length} users.`);
  } catch (e) {
    console.warn('Supabase sync warning, using local state:', e.message);
  }
}

// Initial bootstrap
loadData();
syncFromSupabase();

// Serve Static Frontend Assets
app.use(express.static(publicDir));

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Full State Snapshot
app.get('/api/state', async (req, res) => {
  if (supabase) {
    try {
      const [r, b, u] = await Promise.all([
        supabase.from('routes').select('*').order('code', { ascending: true }),
        supabase.from('buses').select('*').order('bus_number', { ascending: true }),
        supabase.from('users').select('*')
      ]);
      if (!r.error && Array.isArray(r.data)) db.routes = r.data;
      if (!b.error && Array.isArray(b.data)) db.buses = b.data.map(rowToBus);
      if (!u.error && Array.isArray(u.data) && u.data.length > 0) db.users = u.data;
    } catch (e) {}
  }
  res.json(db);
});

// 2. Authentication: Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password, expectedRole } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  let matched = null;

  // Check Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${email},id.eq.${email},bus_id.eq.${email}`)
        .eq('password', password)
        .limit(1);

      if (!error && data && data.length > 0) {
        matched = data[0];
      }
    } catch (e) {}
  }

  // Fallback to in-memory db
  if (!matched) {
    matched = db.users.find(u => 
      (u.email === email || u.id === email || u.busId === email) && u.password === password
    );
  }

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
      busId: matched.busId || matched.bus_id || null
    }
  });
});

// 2b. Authentication: Passenger Registration
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, phone } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
  }

  const newUser = {
    id: 'user-pass-' + Math.floor(100 + Math.random() * 9000),
    email,
    password,
    name,
    phone: phone || '',
    role: 'passenger'
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('users').insert([newUser]);
      if (error && error.code === '23505') {
        return res.status(409).json({ success: false, error: 'An account with this email already exists in Supabase.' });
      }
    } catch (e) {}
  }

  db.users.push(newUser);
  saveData();

  res.json({ success: true, user: newUser });
});

// 3. Routes: Get All
app.get('/api/routes', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('routes').select('*').order('code', { ascending: true });
      if (!error && Array.isArray(data)) {
        db.routes = data;
      }
    } catch (e) {}
  }
  res.json(db.routes || []);
});

// 3b. Routes: Create / Update
app.post('/api/routes', async (req, res) => {
  const routeData = req.body;
  if (!routeData.id) {
    routeData.id = 'route-' + Math.floor(10 + Math.random() * 90);
  }

  if (supabase) {
    try {
      await supabase.from('routes').upsert({
        id: routeData.id,
        name: routeData.name,
        code: routeData.code,
        color: routeData.color || '#2563EB',
        stops: routeData.stops || [],
        roadway: routeData.roadway || []
      });
    } catch (e) {}
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
app.delete('/api/routes/:id', async (req, res) => {
  const routeId = req.params.id;
  if (supabase) {
    try {
      await supabase.from('routes').delete().eq('id', routeId);
    } catch (e) {}
  }
  db.routes = db.routes.filter(r => r.id !== routeId);
  saveData();
  res.json({ success: true, message: 'Route deleted' });
});

// 3d. Routes: Add Stop
app.post('/api/routes/:id/stops', async (req, res) => {
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

  if (supabase) {
    try {
      await supabase.from('routes').update({ stops: route.stops }).eq('id', routeId);
    } catch (e) {}
  }

  res.json({ success: true, stop: stopData });
});

// 3e. Routes: Delete Stop
app.delete('/api/routes/:id/stops/:stopId', async (req, res) => {
  const { id: routeId, stopId } = req.params;
  const route = db.routes.find(r => r.id === routeId);

  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }

  if (Array.isArray(route.stops)) {
    route.stops = route.stops.filter(s => s.id !== stopId);
    saveData();
    if (supabase) {
      try {
        await supabase.from('routes').update({ stops: route.stops }).eq('id', routeId);
      } catch (e) {}
    }
  }
  res.json({ success: true, message: 'Stop removed' });
});

// 4. Buses: Get All
app.get('/api/buses', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('buses').select('*').order('bus_number', { ascending: true });
      if (!error && Array.isArray(data)) {
        db.buses = data.map(rowToBus);
      }
    } catch (e) {}
  }
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
app.post('/api/buses/:id/location', async (req, res) => {
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

  // Async sync to Supabase PostgreSQL & Realtime
  if (supabase) {
    supabase.from('buses').update(busToRow(bus)).eq('id', busId).then().catch(() => {});
  }

  res.json({ success: true, bus });
});

// 4d. Buses: Crowd Level Broadcast
app.post('/api/buses/:id/crowd', async (req, res) => {
  const bus = db.buses.find(b => b.id === req.params.id);
  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  if (req.body.crowdLevel) {
    bus.crowdLevel = String(req.body.crowdLevel);
  }
  bus.lastUpdated = new Date().toISOString();
  saveData();

  if (supabase) {
    supabase.from('buses').update({ crowd_level: bus.crowdLevel, last_updated: bus.lastUpdated }).eq('id', bus.id).then().catch(() => {});
  }

  res.json({ success: true, bus });
});

// 4e. Buses: Trip Control (Start / End Trip)
app.post('/api/buses/:id/trip', async (req, res) => {
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

  if (supabase) {
    supabase.from('buses').update({
      is_trip_active: bus.isTripActive,
      status: bus.status,
      speed: bus.speed,
      last_updated: bus.lastUpdated
    }).eq('id', bus.id).then().catch(() => {});
  }

  res.json({ success: true, bus });
});

// 4f. Buses: Create / Update Bus (Admin)
app.post('/api/buses', async (req, res) => {
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
      bus_id: newBus.id,
      busId: newBus.id
    };

    if (existingUserIdx >= 0) {
      db.users[existingUserIdx] = busUser;
    } else {
      db.users.push(busUser);
    }

    if (supabase) {
      supabase.from('users').upsert({
        id: busUser.id,
        email: busUser.email,
        password: busUser.password,
        name: busUser.name,
        role: 'Bus',
        bus_id: newBus.id
      }).then().catch(() => {});
    }
  }

  delete newBus.loginPassword;

  const existingIdx = db.buses.findIndex(b => b.id === newBus.id);
  if (existingIdx >= 0) {
    db.buses[existingIdx] = newBus;
  } else {
    db.buses.push(newBus);
  }

  saveData();

  if (supabase) {
    try {
      await supabase.from('buses').upsert(busToRow(newBus));
    } catch (e) {}
  }

  res.json({ success: true, bus: newBus });
});

// 4g. Buses: Delete Bus
app.delete('/api/buses/:id', async (req, res) => {
  const busId = req.params.id;
  db.buses = db.buses.filter(b => b.id !== busId);
  saveData();

  if (supabase) {
    try {
      await supabase.from('buses').delete().eq('id', busId);
    } catch (e) {}
  }

  res.json({ success: true, message: 'Bus removed' });
});

// 5. Favorite Commutes API
app.get('/api/favorites/:userId', async (req, res) => {
  const { userId } = req.params;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('favorite_commutes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return res.json({ success: true, favorites: data });
      }
    } catch (e) {}
  }
  res.json({ success: true, favorites: [] });
});

app.post('/api/favorites', async (req, res) => {
  const favData = req.body;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('favorite_commutes')
        .insert([{
          user_id: favData.userId,
          route_id: favData.routeId,
          stop_id: favData.stopId,
          dest_id: favData.destId,
          bus_id: favData.busId,
          route_name: favData.routeName,
          stop_name: favData.stopName,
          dest_name: favData.destName,
          bus_number: favData.busNumber
        }])
        .select();

      if (!error && data && data.length > 0) {
        return res.json({ success: true, favorite: data[0] });
      }
    } catch (e) {}
  }
  res.json({ success: true, favorite: favData });
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
