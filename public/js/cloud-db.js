/**
 * CloudDB: Supabase & Firebase Real-Time Cloud Integration
 * Provides live PostgreSQL persistence and instant WebSocket synchronization.
 */
(function() {
  const SUPABASE_URL = 'https://yvjfcmjmlcuzxscvuzhm.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2amZjbWptbGN1enhzY3Z1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMjU3MzUsImV4cCI6MjEwNzgwMTczNX0.dZ7IL_sySbvIYApMWVkWJZN4gMKkufbIZqOicO9uIXQ';

  // 1. Initialize Supabase Client
  let supabaseClient = null;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.supabaseClient = supabaseClient;
      console.log('✅ Supabase Client initialized successfully.');
    } catch (err) {
      console.warn('⚠️ Supabase initialization skipped:', err.message);
    }
  }

  // 2. Firebase Configuration
  const firebaseConfig = {
    apiKey: "AIzaSyANCHkg4s37uUx4Nu5iXvtDidRXVbTh2Wk",
    authDomain: "nellai72-2aeb8.firebaseapp.com",
    projectId: "nellai72-2aeb8",
    storageBucket: "nellai72-2aeb8.firebasestorage.app",
    messagingSenderId: "485293954337",
    appId: "1:485293954337:web:53f9b9f019b2a675ac1a60",
    measurementId: "G-KE7X06QWFD"
  };
  window.firebaseConfig = firebaseConfig;

  let firebaseApp = null;
  let firebaseAnalytics = null;
  let firebaseAuth = null;

  if (window.firebase && typeof window.firebase.initializeApp === 'function') {
    try {
      firebaseApp = window.firebase.initializeApp(firebaseConfig);
      window.firebaseApp = firebaseApp;
      if (typeof window.firebase.analytics === 'function') {
        firebaseAnalytics = window.firebase.analytics();
        window.firebaseAnalytics = firebaseAnalytics;
      }
      if (typeof window.firebase.auth === 'function') {
        firebaseAuth = window.firebase.auth();
        window.firebaseAuth = firebaseAuth;
      }
      console.log('✅ Firebase initialized for project: nellai72-2aeb8');
    } catch (err) {
      console.warn('⚠️ Firebase init skipped or already active:', err.message);
    }
  }

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
      assignedRouteIds: Array.isArray(row.assigned_route_ids)
        ? row.assigned_route_ids
        : (Array.isArray(row.assignedRouteIds)
            ? row.assignedRouteIds
            : (() => {
                const local = window.appState && typeof window.appState.getBusById === 'function' ? window.appState.getBusById(row.id) : null;
                if (local && Array.isArray(local.assignedRouteIds)) return local.assignedRouteIds;
                return row.route_id ? [row.route_id] : [];
              })()),
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
      isVetriPayanam: (() => {
        if (row.is_vetri_payanam !== undefined && row.is_vetri_payanam !== null) {
          return Boolean(row.is_vetri_payanam);
        }
        if (row.isVetriPayanam !== undefined && row.isVetriPayanam !== null) {
          return Boolean(row.isVetriPayanam);
        }
        const local = window.appState && typeof window.appState.getBusById === 'function' ? window.appState.getBusById(row.id) : null;
        if (local && local.isVetriPayanam !== undefined) {
          return Boolean(local.isVetriPayanam);
        }
        return false;
      })(),
      simulatorIndex: Number(row.simulator_index || 0),
      lastUpdated: row.last_updated
    };
  }

  // 3. Setup Supabase Realtime Channel for Instant Bus GPS streaming
  function setupSupabaseRealtime() {
    if (!supabaseClient) return;

    try {
      // 1. Live Buses Channel (GPS, Create, Update, Delete)
      supabaseClient
        .channel('realtime:public:buses')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'buses' },
          (payload) => {
            if (!window.appState) return;

            if (payload.eventType === 'DELETE') {
              const deletedId = payload.old ? payload.old.id : null;
              if (deletedId) {
                window.appState.buses = window.appState.buses.filter(b => b.id !== deletedId);
                window.appState.notify({ type: 'BUS_DELETED', busId: deletedId });
                window.appState.notify({ type: 'FLEET_UPDATED' });
              }
            } else if (payload.eventType === 'INSERT') {
              const freshRow = payload.new;
              if (freshRow && freshRow.id) {
                const newBus = rowToBus(freshRow);
                if (!window.appState.getBusById(newBus.id)) {
                  window.appState.buses.push(newBus);
                }
                window.appState.notify({ type: 'FLEET_UPDATED' });
              }
            } else if (payload.eventType === 'UPDATE') {
              const freshRow = payload.new;
              if (freshRow && freshRow.id) {
                const local = window.appState.getBusById(freshRow.id);
                const updatedBus = rowToBus(freshRow);
                if (local) {
                  if (freshRow.is_vetri_payanam === undefined && local.isVetriPayanam !== undefined) {
                    updatedBus.isVetriPayanam = local.isVetriPayanam;
                  }
                  if (Array.isArray(freshRow.assigned_route_ids)) {
                    updatedBus.assignedRouteIds = freshRow.assigned_route_ids;
                  } else if (Array.isArray(freshRow.assignedRouteIds)) {
                    updatedBus.assignedRouteIds = freshRow.assignedRouteIds;
                  } else if (local.assignedRouteIds) {
                    updatedBus.assignedRouteIds = local.assignedRouteIds;
                  }
                  const routesChanged = JSON.stringify(local.assignedRouteIds || []) !== JSON.stringify(updatedBus.assignedRouteIds || []);
                  const vetriChanged = Boolean(local.isVetriPayanam) !== Boolean(updatedBus.isVetriPayanam);
                  
                  Object.assign(local, updatedBus);
                  window.appState.notify({
                    type: 'BUS_LOCATION_UPDATE',
                    source: 'supabase_realtime',
                    busId: updatedBus.id,
                    locationData: updatedBus
                  });
                  if (routesChanged || vetriChanged) {
                    window.appState.notify({ type: 'FLEET_UPDATED' });
                  }
                } else {
                  window.appState.buses.push(updatedBus);
                  window.appState.notify({ type: 'FLEET_UPDATED' });
                }
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('⚡ Connected to Supabase Realtime channel for live bus tracking.');
          }
        });

      // 2. Live Routes & Stops Channel (Create, Update, Stops change, Delete)
      supabaseClient
        .channel('realtime:public:routes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'routes' },
          (payload) => {
            if (!window.appState) return;

            if (payload.eventType === 'DELETE') {
              const deletedId = payload.old ? payload.old.id : null;
              if (deletedId) {
                window.appState.routes = window.appState.routes.filter(r => r.id !== deletedId);
                window.appState.notify({ type: 'ROUTES_UPDATED', routeId: deletedId });
              }
            } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const freshRoute = payload.new;
              if (freshRoute && freshRoute.id) {
                const idx = window.appState.routes.findIndex(r => r.id === freshRoute.id);
                if (idx >= 0) {
                  const existingMatrix = window.appState.routes[idx].fareMatrix;
                  if (!freshRoute.fareMatrix && !freshRoute.fare_matrix && existingMatrix) {
                    freshRoute.fareMatrix = existingMatrix;
                  }
                  window.appState.routes[idx] = freshRoute;
                } else {
                  window.appState.routes.push(freshRoute);
                }
                window.appState.notify({ type: 'ROUTES_UPDATED', route: freshRoute });
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('⚡ Connected to Supabase Realtime channel for live routes & stops.');
          }
        });
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  }

  // Expose CloudDB utility methods
  window.CloudDB = {
    supabase: supabaseClient,
    firebase: firebaseApp,
    rowToBus,

    init() {
      setupSupabaseRealtime();
    },

    // Broadcast GPS location directly to Supabase
    async updateBusLocation(busId, updateData) {
      if (!supabaseClient) return false;
      try {
        const payload = {
          last_updated: new Date().toISOString()
        };
        if (updateData.lat !== undefined) payload.lat = Number(updateData.lat);
        if (updateData.lng !== undefined) payload.lng = Number(updateData.lng);
        if (updateData.speed !== undefined) payload.speed = Number(updateData.speed);
        if (updateData.bearing !== undefined) payload.bearing = Number(updateData.bearing);
        if (updateData.status !== undefined) payload.status = String(updateData.status);
        if (updateData.isTripActive !== undefined) payload.is_trip_active = Boolean(updateData.isTripActive);
        if (updateData.crowdLevel !== undefined) payload.crowd_level = String(updateData.crowdLevel);
        if (updateData.currentStopId !== undefined) payload.current_stop_id = String(updateData.currentStopId);
        if (updateData.currentStopName !== undefined) payload.current_stop_name = String(updateData.currentStopName);
        if (updateData.nextStopId !== undefined) payload.next_stop_id = String(updateData.nextStopId);
        if (updateData.nextStopName !== undefined) payload.next_stop_name = String(updateData.nextStopName);
        if (updateData.etaMinutes !== undefined) payload.eta_minutes = Number(updateData.etaMinutes);
        if (updateData.distanceToNextKm !== undefined) payload.distance_to_next_km = Number(updateData.distanceToNextKm);
        if (updateData.routeProgress !== undefined) payload.route_progress = Number(updateData.routeProgress);

        const { error } = await supabaseClient
          .from('buses')
          .update(payload)
          .eq('id', busId);

        return !error;
      } catch (err) {
        return false;
      }
    }
  };

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.CloudDB.init());
  } else {
    window.CloudDB.init();
  }
})();
