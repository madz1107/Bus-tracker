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

  // 2. Initialize Firebase (Optional / Configurable)
  let firebaseApp = null;
  if (window.firebase && window.firebaseConfig && window.firebaseConfig.apiKey) {
    try {
      firebaseApp = window.firebase.initializeApp(window.firebaseConfig);
      window.firebaseApp = firebaseApp;
      console.log('✅ Firebase initialized successfully.');
    } catch (err) {
      console.warn('⚠️ Firebase init skipped:', err.message);
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
      simulatorIndex: Number(row.simulator_index || 0),
      lastUpdated: row.last_updated
    };
  }

  // 3. Setup Supabase Realtime Channel for Instant Bus GPS streaming
  function setupSupabaseRealtime() {
    if (!supabaseClient) return;

    try {
      const channel = supabaseClient
        .channel('realtime:public:buses')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'buses' },
          (payload) => {
            const freshRow = payload.new;
            if (!freshRow || !freshRow.id || !window.appState) return;

            const updatedBus = rowToBus(freshRow);
            const local = window.appState.getBusById(updatedBus.id);

            if (local) {
              Object.assign(local, updatedBus);
              window.appState.notify({
                type: 'BUS_LOCATION_UPDATE',
                source: 'supabase_realtime',
                busId: updatedBus.id,
                locationData: updatedBus
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('⚡ Connected to Supabase Realtime channel for live bus GPS tracking.');
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
