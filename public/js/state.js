/**
 * AppState: Global Real-Time State Store & Cross-Tab Synchronizer
 */
class StateManager {
  constructor() {
    this.routes = [];
    this.buses = [];
    this.users = [];
    this.currentUser = JSON.parse(localStorage.getItem('citybus_user') || 'null');
    this.selectedRouteId = null;
    this.selectedStopId = null;
    this.selectedBusId = null;
    this.listeners = new Set();
    
    // Cross-tab Instant Sync Channel
    this.channel = new BroadcastChannel('citybus_realtime_channel');
    this.channel.onmessage = (event) => {
      if (event.data && event.data.type) {
        this.handleRemoteEvent(event.data);
      }
    };

    // Auto-fetch fresh locations as soon as device screen turns on or tab focuses
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.pollBusesOnce();
      }
    });
    window.addEventListener('focus', () => this.pollBusesOnce());
    window.addEventListener('pageshow', () => this.pollBusesOnce());

    // Initialize state
    this.init();
  }

  async init() {
    let loaded = false;
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        this.routes = data.routes || [];
        this.buses = data.buses || [];
        this.users = data.users || [];
        loaded = (this.routes.length > 0 || this.buses.length > 0);
      }
    } catch (e) {
      console.warn('Backend fetch fallback to cached state', e);
    }

    // 2. Direct Supabase Fallback (Crucial for Capacitor native app when standalone)
    if (!loaded && window.supabaseClient) {
      try {
        const [busesRes, routesRes, usersRes] = await Promise.all([
          window.supabaseClient.from('buses').select('*'),
          window.supabaseClient.from('routes').select('*'),
          window.supabaseClient.from('users').select('*')
        ]);
        if (busesRes.data && busesRes.data.length > 0) {
          this.buses = busesRes.data.map(r => window.CloudDB ? window.CloudDB.rowToBus(r) : r);
        }
        if (routesRes.data && routesRes.data.length > 0) {
          this.routes = routesRes.data.map(remoteRoute => {
            const local = this.routes.find(r => r.id === remoteRoute.id);
            return {
              ...remoteRoute,
              fareMatrix: remoteRoute.fareMatrix || remoteRoute.fare_matrix || (local ? local.fareMatrix : null) || {}
            };
          });
        }
        if (usersRes.data && usersRes.data.length > 0) {
          this.users = usersRes.data;
        }
        loaded = (this.routes.length > 0 || this.buses.length > 0);
      } catch (sbErr) {
        console.warn('Supabase direct query fallback notice:', sbErr);
      }
    }

    // 3. Bundled data.json fallback
    if (!loaded) {
      try {
        const djRes = await fetch('data.json');
        if (djRes.ok) {
          const dj = await djRes.json();
          this.routes = dj.routes || [];
          this.buses = dj.buses || [];
          this.users = dj.users || [];
        }
      } catch (djErr) {}
    }

    if ((!this.selectedRouteId || !this.getRouteById(this.selectedRouteId)) && this.routes.length > 0) {
      this.selectedRouteId = this.routes[0].id;
    }
    if ((!this.selectedBusId || !this.getBusById(this.selectedBusId)) && this.buses.length > 0) {
      this.selectedBusId = this.buses[0].id;
    }
    this.notify();

    // Start live polling for real-time GPS location accuracy across devices
    this.startLivePolling();

    // Auto-resume polling immediately whenever screen wakes up or tab is focused
    const handleScreenWake = () => {
      if (document.visibilityState === 'visible') {
        this.pollBusesOnce();
        this.startLivePolling();
      }
    };
    document.addEventListener('visibilitychange', handleScreenWake);
    window.addEventListener('focus', handleScreenWake);
    window.addEventListener('pageshow', handleScreenWake);
  }

  /**
   * Polls /api/buses every 3 seconds so passenger and admin maps always show
   * the conductor's actual GPS position (even from a different device/phone).
   */
  startLivePolling() {
    if (this._pollInterval) clearInterval(this._pollInterval);
    let pollCount = 0;
    this._pollInterval = setInterval(async () => {
      try {
        pollCount++;
        // 1. Poll Buses (every 2s)
        const res = await fetch('/api/buses');
        if (res.ok) {
          const freshBuses = await res.json();
          if (Array.isArray(freshBuses)) {
            // If fleet count changed or IDs differ (e.g., bus added or deleted), sync immediately
            if (freshBuses.length !== this.buses.length || freshBuses.some(fb => !this.getBusById(fb.id))) {
              this.buses = freshBuses;
              this.notify({ type: 'FLEET_UPDATED' });
            } else {
              let hasChange = false;
              const changedBusIds = [];
              freshBuses.forEach((freshBus) => {
                const local = this.getBusById(freshBus.id);
                if (local) {
                  // Trip State Protection: Prevent background poll from clearing active trip if local bus has fresh live heartbeat
                  if (local.isTripActive && !freshBus.isTripActive) {
                    const localTime = new Date(local.lastUpdated || 0).getTime();
                    const isConductorActive = localStorage.getItem('citybus_active_trip_' + local.id) === 'true';
                    if (isConductorActive || (Date.now() - localTime < 45000)) {
                      freshBus.isTripActive = true;
                      freshBus.status = local.status || 'Running';
                    }
                  }

                  const hasBusChanged = (
                    local.lat !== freshBus.lat ||
                    local.lng !== freshBus.lng ||
                    local.speed !== freshBus.speed ||
                    local.bearing !== freshBus.bearing ||
                    local.status !== freshBus.status ||
                    local.crowdLevel !== freshBus.crowdLevel ||
                    local.nextStopName !== freshBus.nextStopName ||
                    local.isTripActive !== freshBus.isTripActive ||
                    local.etaMinutes !== freshBus.etaMinutes ||
                    local.distanceToNextKm !== freshBus.distanceToNextKm ||
                    local.routeProgress !== freshBus.routeProgress ||
                    local.lastUpdated !== freshBus.lastUpdated
                  );

                  if (hasBusChanged) {
                    Object.assign(local, freshBus);
                    changedBusIds.push(freshBus.id);
                    hasChange = true;
                  }
                }
              });

              if (hasChange) {
                this.notify({ type: 'BUS_LOCATION_UPDATE', source: 'poll', changedBusIds });
              }
            }
          }
        }

        // 2. Poll Routes & Stops (every 6s / 3 ticks) for automatic background database sync
        if (pollCount % 3 === 0) {
          const rRes = await fetch('/api/routes');
          if (rRes.ok) {
            const freshRoutes = await rRes.json();
            if (Array.isArray(freshRoutes)) {
              const mergedRoutes = freshRoutes.map(remoteRoute => {
                const local = this.routes.find(r => r.id === remoteRoute.id);
                return {
                  ...remoteRoute,
                  fareMatrix: (remoteRoute.fareMatrix && Object.keys(remoteRoute.fareMatrix).length > 0)
                    ? remoteRoute.fareMatrix
                    : (remoteRoute.fare_matrix && Object.keys(remoteRoute.fare_matrix).length > 0)
                      ? remoteRoute.fare_matrix
                      : (local && local.fareMatrix ? local.fareMatrix : {})
                };
              });
              const routesDiffer = JSON.stringify(mergedRoutes) !== JSON.stringify(this.routes);
              if (routesDiffer) {
                this.routes = mergedRoutes;
                this.notify({ type: 'ROUTES_UPDATED' });
              }
            }
          }
        }
      } catch (e) {
        // Silently ignore polling errors
      }
    }, 2000);
  }

  /**
   * One-shot instant bus location fetch when device screen wakes up or tab focuses
   */
  async pollBusesOnce() {
    try {
      const res = await fetch(`/api/buses?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const freshBuses = await res.json();
        if (Array.isArray(freshBuses)) {
          let hasChange = false;
          const changedBusIds = [];
          freshBuses.forEach((freshBus) => {
            const local = this.getBusById(freshBus.id);
            if (local) {
              if (local.isTripActive && !freshBus.isTripActive) {
                const localTime = new Date(local.lastUpdated || 0).getTime();
                const isConductorActive = localStorage.getItem('citybus_active_trip_' + local.id) === 'true';
                if (isConductorActive || (Date.now() - localTime < 45000)) {
                  freshBus.isTripActive = true;
                  freshBus.status = local.status || 'Running';
                }
              }

              const changed = (
                local.lat !== freshBus.lat ||
                local.lng !== freshBus.lng ||
                local.speed !== freshBus.speed ||
                local.status !== freshBus.status ||
                local.isTripActive !== freshBus.isTripActive ||
                local.nextStopName !== freshBus.nextStopName
              );
              if (changed) {
                Object.assign(local, freshBus);
                changedBusIds.push(freshBus.id);
                hasChange = true;
              }
            }
          });
          if (hasChange) {
            this.notify({ type: 'BUS_LOCATION_UPDATE', source: 'resume', changedBusIds });
          }
        }
      }
    } catch (e) {}
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(eventPayload = null) {
    this.listeners.forEach((fn) => {
      try {
        fn(this, eventPayload);
      } catch (err) {
        console.error('Listener notification error:', err);
      }
    });
    if (window.app && typeof window.app.updateActiveBusesBadge === 'function') {
      window.app.updateActiveBusesBadge();
    }
  }

  getRouteById(routeId) {
    return this.routes.find((r) => r.id === routeId);
  }

  getBusById(busId) {
    if (!busId) return null;
    const search = String(busId).trim().toLowerCase();
    return this.buses.find((b) => 
      b.id === busId ||
      b.id.toLowerCase() === search ||
      (b.busNumber && b.busNumber.toLowerCase() === search) ||
      (b.busNumber && `bus-${b.busNumber}`.toLowerCase() === search)
    );
  }

  getBusesForRoute(routeId) {
    return this.buses.filter((b) => {
      // Check if it's assigned to this route or currently running this route
      const isAssigned = b.assignedRouteIds && b.assignedRouteIds.includes(routeId);
      const isCurrentRoute = b.routeId === routeId;
      return isAssigned || isCurrentRoute;
    });
  }

  /**
   * Broadcasts a live GPS location update for a bus
   */
  async updateBusLocation(busId, locationData) {
    const bus = this.getBusById(busId);
    if (!bus) return;

    // Mutate local state
    Object.assign(bus, locationData, {
      lastUpdated: new Date().toISOString()
    });

    const payload = {
      type: 'BUS_LOCATION_UPDATE',
      busId,
      locationData: bus
    };

    // Broadcast across browser tabs instantly
    this.channel.postMessage(payload);
    this.notify(payload);

    // Direct real-time cloud broadcast via Supabase
    if (window.CloudDB && typeof window.CloudDB.updateBusLocation === 'function') {
      window.CloudDB.updateBusLocation(busId, locationData);
    }

    // Sync to backend asynchronously
    try {
      fetch(`/api/buses/${busId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData),
        keepalive: true
      });
    } catch (e) {}
  }

  /**
   * Conductor updates the live crowd status (Low / Moderate / Heavy)
   */
  async updateBusCrowd(busId, crowdLevel) {
    const bus = this.getBusById(busId);
    if (!bus) return;

    bus.crowdLevel = crowdLevel;
    bus.lastUpdated = new Date().toISOString();

    const payload = {
      type: 'BUS_LOCATION_UPDATE',
      busId,
      locationData: { crowdLevel }
    };

    // Broadcast across browser tabs instantly
    this.channel.postMessage(payload);
    this.notify(payload);

    // Direct real-time cloud broadcast via Supabase
    if (window.CloudDB && typeof window.CloudDB.updateBusLocation === 'function') {
      window.CloudDB.updateBusLocation(busId, { crowdLevel });
    }

    try {
      fetch(`/api/buses/${busId}/crowd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crowdLevel })
      });
    } catch (e) {}
  }

  /**
   * Handles remote synchronization messages from other tabs / conductor
   */
  handleRemoteEvent(event) {
    if (event.type === 'BUS_LOCATION_UPDATE') {
      const bus = this.getBusById(event.busId);
      if (bus && event.locationData) {
        Object.assign(bus, event.locationData);
        this.notify(event);
      }
    } else if (event.type === 'FLEET_UPDATED') {
      this.init();
    }
  }

  setCurrentUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('citybus_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('citybus_user');
    }
    this.notify({ type: 'AUTH_CHANGED', user });
  }

  async saveBus(busData) {
    try {
      // 1. Optimistic immediate local update
      const existingIdx = this.buses.findIndex(b => b.id === busData.id);
      if (existingIdx >= 0) {
        this.buses[existingIdx] = busData;
      } else {
        this.buses.push(busData);
      }
      this.notify({ type: 'BUS_UPDATED', bus: busData });
      this.notify({ type: 'FLEET_UPDATED' });

      // 2. Direct Supabase save if connected in browser
      if (window.CloudDB && window.CloudDB.supabase) {
        try {
          const row = {
            id: busData.id,
            bus_number: busData.busNumber,
            reg_number: busData.regNumber,
            bus_name: busData.BusName || busData.name,
            route_id: busData.routeId,
            assigned_route_ids: busData.assignedRouteIds || (busData.routeId ? [busData.routeId] : []),
            conductor_id: busData.conductorId,
            conductor_name: busData.conductorName,
            conductor_phone: busData.conductorPhone,
            status: busData.status || 'Stopped',
            lat: Number(busData.lat || 8.7139),
            lng: Number(busData.lng || 77.7285),
            speed: Number(busData.speed || 0),
            bearing: Number(busData.bearing || 0),
            crowd_level: busData.crowdLevel || 'Moderate',
            is_trip_active: Boolean(busData.isTripActive),
            last_updated: new Date().toISOString()
          };

          // Try upsert with is_vetri_payanam; fallback without it if column is not yet present in Supabase table
          const res = await window.CloudDB.supabase.from('buses').upsert({
            ...row,
            is_vetri_payanam: Boolean(busData.isVetriPayanam)
          });

          if (res.error && res.error.code === 'PGRST204') {
            await window.CloudDB.supabase.from('buses').upsert(row);
          }
        } catch (sErr) {
          console.warn('Direct Supabase saveBus warning:', sErr);
        }
      }

      // 3. Backend API save
      const res = await fetch('/api/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(busData)
      });
      if (res.ok) {
        this.channel.postMessage({ type: 'FLEET_UPDATED' });
        return true;
      }
    } catch (e) {
      console.error('saveBus error:', e);
    }
    return false;
  }

  async deleteBus(busId) {
    try {
      // 1. Optimistic immediate removal from local state & UI
      this.buses = this.buses.filter(b => b.id !== busId);
      this.notify({ type: 'BUS_DELETED', busId });
      this.notify({ type: 'FLEET_UPDATED' });

      // 2. Direct Supabase deletion if connected in browser
      if (window.CloudDB && window.CloudDB.supabase) {
        try {
          await window.CloudDB.supabase.from('buses').delete().eq('id', busId);
        } catch (sErr) {
          console.warn('Direct Supabase delete bus:', sErr);
        }
      }

      // 3. Backend API delete
      const res = await fetch(`/api/buses/${busId}`, { method: 'DELETE' });
      if (res.ok) {
        this.channel.postMessage({ type: 'FLEET_UPDATED' });
        return true;
      }
    } catch (e) {
      console.error('Delete bus error:', e);
    }
    return false;
  }

  async saveRoute(routeData) {
    try {
      // 1. Optimistic immediate local update
      const existingIdx = this.routes.findIndex(r => r.id === routeData.id);
      if (existingIdx >= 0) {
        this.routes[existingIdx] = routeData;
      } else {
        this.routes.push(routeData);
      }
      this.notify({ type: 'ROUTES_UPDATED', route: routeData });

      // 2. Direct Supabase save if connected in browser
      if (window.CloudDB && window.CloudDB.supabase) {
        try {
          const rowPayload = {
            id: routeData.id,
            name: routeData.name,
            code: routeData.code,
            color: routeData.color || '#2563EB',
            stops: routeData.stops || [],
            roadway: routeData.roadway || []
          };
          const { error: sErr } = await window.CloudDB.supabase.from('routes').upsert({
            ...rowPayload,
            fare_matrix: routeData.fareMatrix || {}
          });
          if (sErr) {
            await window.CloudDB.supabase.from('routes').upsert(rowPayload);
          }
        } catch (sErr) {
          try {
            await window.CloudDB.supabase.from('routes').upsert({
              id: routeData.id,
              name: routeData.name,
              code: routeData.code,
              color: routeData.color || '#2563EB',
              stops: routeData.stops || [],
              roadway: routeData.roadway || []
            });
          } catch (_) {}
        }
      }

      // 3. Backend API save
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData)
      });
      if (res.ok) {
        this.channel.postMessage({ type: 'FLEET_UPDATED' });
        return true;
      }
    } catch (e) {
      console.error('saveRoute error:', e);
    }
    return false;
  }

  async deleteRoute(routeId) {
    try {
      // 1. Optimistic removal
      this.routes = this.routes.filter(r => r.id !== routeId);
      if (this.selectedRouteId === routeId) {
        this.selectedRouteId = this.routes.length > 0 ? this.routes[0].id : null;
      }
      this.notify({ type: 'ROUTES_UPDATED', routeId });

      // 2. Direct Supabase delete
      if (window.CloudDB && window.CloudDB.supabase) {
        try {
          await window.CloudDB.supabase.from('routes').delete().eq('id', routeId);
        } catch (sErr) {
          console.warn('Direct Supabase delete route warning:', sErr);
        }
      }

      // 3. Backend API delete
      const res = await fetch(`/api/routes/${routeId}`, { method: 'DELETE' });
      if (res.ok) {
        this.channel.postMessage({ type: 'FLEET_UPDATED' });
        return true;
      }
    } catch (e) {
      console.error('deleteRoute error:', e);
    }
    return false;
  }
}

window.appState = new StateManager();
