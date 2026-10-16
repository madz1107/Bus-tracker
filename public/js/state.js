/**
 * AppState: Global Real-Time State Store & Cross-Tab Synchronizer
 */
class StateManager {
  constructor() {
    this.routes = [];
    this.buses = [];
    this.users = [];
    this.currentUser = JSON.parse(localStorage.getItem('citybus_user') || 'null');
    this.selectedRouteId = 'route-1';
    this.selectedStopId = null;
    this.selectedBusId = 'BUS-101';
    this.listeners = new Set();
    
    // Cross-tab Instant Sync Channel
    this.channel = new BroadcastChannel('citybus_realtime_channel');
    this.channel.onmessage = (event) => {
      if (event.data && event.data.type) {
        this.handleRemoteEvent(event.data);
      }
    };

    // Initialize state
    this.init();
  }

  async init() {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        this.routes = data.routes || [];
        this.buses = data.buses || [];
        this.users = data.users || [];
        this.notify();
      }
    } catch (e) {
      console.warn('Backend fetch fallback to cached state', e);
    }

    // Start live polling for real-time GPS location accuracy across devices
    this.startLivePolling();
  }

  /**
   * Polls /api/buses every 3 seconds so passenger and admin maps always show
   * the conductor's actual GPS position (even from a different device/phone).
   */
  startLivePolling() {
    if (this._pollInterval) clearInterval(this._pollInterval);
    this._pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/buses');
        if (!res.ok) return;
        const freshBuses = await res.json();

        let hasChange = false;
        const changedBusIds = [];
        freshBuses.forEach((freshBus) => {
          const local = this.getBusById(freshBus.id);
          if (local) {
            // Check if any position, telemetry, crowd, or status attribute changed
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
      } catch (e) {
        // Silently ignore polling errors (offline, server restart, etc.)
      }
    }, 2000); // Poll every 2 seconds for smooth real-time cross-device accuracy
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
  }

  getRouteById(routeId) {
    return this.routes.find((r) => r.id === routeId);
  }

  getBusById(busId) {
    return this.buses.find((b) => b.id === busId);
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

    // Sync to backend asynchronously
    try {
      fetch(`/api/buses/${busId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData)
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
      const res = await fetch('/api/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(busData)
      });
      if (res.ok) {
        await this.init();
        this.channel.postMessage({ type: 'FLEET_UPDATED' });
        return true;
      }
    } catch (e) {}
    return false;
  }

  async deleteBus(busId) {
    try {
      const res = await fetch(`/api/buses/${busId}`, { method: 'DELETE' });
      if (res.ok) {
        await this.init();
        this.channel.postMessage({ type: 'FLEET_UPDATED' });
        return true;
      }
    } catch (e) {}
    return false;
  }

  async saveRoute(routeData) {
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData)
      });
      if (res.ok) {
        await this.init();
        this.channel.postMessage({ type: 'FLEET_UPDATED' });
        return true;
      }
    } catch (e) {}
    return false;
  }
}

window.appState = new StateManager();
