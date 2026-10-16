/**
 * BusController: Pure Real-Time GPS Geolocation Mobile Console
 * Uses device GPS (navigator.geolocation) to stream live bus location to passengers & admin
 */
class BusController {
  constructor() {
    this.busId = 'BUS-101';
    this.isTripActive = false;
    this.watchId = null;
    this.mapManager = null;
    this.lastPosition = null;

    // Subscribe to state changes
    window.appState.subscribe((state, event) => {
      this.syncBusProfile();
    });
  }

  init() {
    this.syncBusProfile();

    if (!this.mapManager) {
      this.mapManager = new MapManager('condMap', { zoom: 14 });
    }

    const bus = window.appState.getBusById(this.busId);
    if (bus) {
      this.isTripActive = bus.isTripActive === true;
      const route = window.appState.getRouteById(bus.routeId);
      if (route && this.mapManager) {
        this.mapManager.clearStops();
        this.mapManager.renderRouteStops(route, [bus]);
        this.mapManager.updateBusMarker(bus, true, true);
        this.mapManager.centerOnLocation(bus.lat, bus.lng, 14);
      }
    }

    // If trip was already marked active, start live phone GPS immediately
    if (this.isTripActive) {
      this.startPhoneGps();
    }

    this.render();
  }

  syncBusProfile() {
    const user = window.appState.currentUser;
    if (user && user.role === 'Bus') {
      if (user.busId) this.busId = user.busId;
      const nameEl = document.getElementById('condNameDisplay');
      if (nameEl) nameEl.textContent = user.name;
      const roleEl = document.getElementById('condRoleDisplay');
      if (roleEl) roleEl.textContent = `Duty Bus • ID: ${user.id.toUpperCase()}`;
    }

    const bus = window.appState.getBusById(this.busId);
    if (bus) {
      this.isTripActive = bus.isTripActive === true;

      const badge = document.getElementById('condAssignedBusBadge');
      if (badge) badge.textContent = `BUS ${bus.busNumber}`;

      const route = window.appState.getRouteById(bus.routeId);
      if (route) {
        const routeName = document.getElementById('condRouteName');
        const stopsCount = document.getElementById('condStopsCount');
        if (routeName) routeName.textContent = route.name;
      }
      
      const routeSelect = document.getElementById('condRouteSelect');
      if (routeSelect) {
        const assignedIds = bus.assignedRouteIds || (bus.routeId ? [bus.routeId] : []);
        routeSelect.innerHTML = assignedIds.map(rId => {
          const r = window.appState.getRouteById(rId);
          return r ? `<option value="${r.id}" ${r.id === bus.routeId ? 'selected' : ''} style="color: black;">${r.code} - ${r.name}</option>` : '';
        }).join('');
        routeSelect.disabled = this.isTripActive;
      }
    }
  }

  async changeActiveRoute() {
    if (this.isTripActive) return;
    const bus = window.appState.getBusById(this.busId);
    const select = document.getElementById('condRouteSelect');
    if (bus && select) {
      bus.routeId = select.value;
      const route = window.appState.getRouteById(bus.routeId);
      if (route && route.stops && route.stops.length > 0) {
        bus.lat = route.stops[0].lat;
        bus.lng = route.stops[0].lng;
        bus.currentStopId = route.stops[0].id;
        bus.currentStopName = route.stops[0].name;
        if (route.stops.length > 1) {
          bus.nextStopId = route.stops[1].id;
          bus.nextStopName = route.stops[1].name;
        }
      }
      await window.appState.saveBus(bus);
      this.syncBusProfile();
      window.app.showToast('Active route updated.', 'info');
    }
  }

  /**
   * Starts trip and activates Real Device GPS Geolocation
   */
  startTrip() {
    this.isTripActive = true;
    const bus = window.appState.getBusById(this.busId);
    if (bus) {
      bus.isTripActive = true;
      bus.status = 'Running';
      window.appState.updateBusLocation(this.busId, { isTripActive: true, status: 'Running' });
    }

    this.startPhoneGps();
    this.render();
    window.app.showToast('Trip Started! Live GPS location is now streaming to passengers and admin.', 'success');
  }

  /**
   * Ends trip and stops GPS Geolocation
   */
  endTrip() {
    this.isTripActive = false;
    this.stopPhoneGps();

    const bus = window.appState.getBusById(this.busId);
    if (bus) {
      bus.isTripActive = false;
      bus.status = 'Offline';
      bus.speed = 0;
      window.appState.updateBusLocation(this.busId, { isTripActive: false, status: 'Offline', speed: 0 });
    }

    this.render();
    window.app.showToast('Trip Ended. GPS location streaming stopped.', 'info');
  }

  /**
   * Connects to device GPS hardware via navigator.geolocation.watchPosition
   */
  startPhoneGps() {
    if (!navigator.geolocation) {
      window.app.showToast('GPS Geolocation is not supported by your browser.', 'error');
      return;
    }

    this.stopPhoneGps();

    const badge = document.getElementById('condGpsStatusBadge');
    if (badge) badge.innerHTML = '<span class="dot green"></span> GPS TRACKING LIVE';

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, heading } = position.coords;
        
        let calculatedSpeed = 0;
        if (speed !== null && !isNaN(speed)) {
          calculatedSpeed = Math.round(speed * 3.6); // Convert m/s to km/h
        } else if (this.lastPosition) {
          const distMeters = GeoEngine.getDistanceMeters(this.lastPosition.lat, this.lastPosition.lng, latitude, longitude);
          const timeSec = (position.timestamp - this.lastPosition.time) / 1000;
          if (timeSec > 0) {
            calculatedSpeed = Math.round((distMeters / timeSec) * 3.6);
          }
        }

        let calculatedHeading = heading || 0;
        if (!heading && this.lastPosition) {
          calculatedHeading = GeoEngine.getBearing(this.lastPosition.lat, this.lastPosition.lng, latitude, longitude);
        }

        this.lastPosition = {
          lat: latitude,
          lng: longitude,
          time: position.timestamp
        };

        this.processNewCoordinates(latitude, longitude, calculatedSpeed, calculatedHeading);
      },
      (error) => {
        console.warn('GPS Geolocation error:', error);
        let errorMsg = 'Could not get GPS lock.';
        if (error.code === 1) {
          errorMsg = 'Location permission denied. Please allow GPS access in your browser settings.';
        } else if (error.code === 2) {
          errorMsg = 'GPS position unavailable. Ensure device GPS/Location is turned on.';
        } else if (error.code === 3) {
          errorMsg = 'GPS request timed out. Retrying location lock...';
        }
        window.app.showToast(errorMsg, 'error');

        const badge = document.getElementById('condGpsStatusBadge');
        if (badge) badge.innerHTML = '<span class="dot red"></span> GPS WAITING LOCK';
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000
      }
    );
  }

  stopPhoneGps() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    const badge = document.getElementById('condGpsStatusBadge');
    if (badge) badge.innerHTML = '<span class="dot amber"></span> GPS STANDBY';
  }

  /**
   * Ingests Real GPS Coordinates, Checks Stop Geofences, and Broadcasts Telemetry
   */
  processNewCoordinates(lat, lng, speed, bearing) {
    const bus = window.appState.getBusById(this.busId);
    if (!bus) return;

    const route = window.appState.getRouteById(bus.routeId);
    const hasStops = route && route.stops && route.stops.length > 0;

    let currentStop = null;
    let nextStop = null;
    let etaMinutes = 0;
    let distToNextKm = 0;
    let progressPct = 0;
    let reachedStopIds = Array.isArray(bus.reachedStopIds) ? [...bus.reachedStopIds] : [];

    if (hasStops) {
      // Check Geofence for stops
      route.stops.forEach((stop, index) => {
        const geofence = GeoEngine.checkGeofence(lat, lng, stop.lat, stop.lng);
        if (geofence.status === 'Reached') {
          if (!reachedStopIds.includes(stop.id)) {
            reachedStopIds.push(stop.id);
            window.app.showToast(`Reached Stop #${stop.sequence}: ${stop.name} ✅`, 'success');
          }
          currentStop = stop;
          nextStop = route.stops[index + 1] || route.stops[index];
        }
      });

      // If no direct geofence hit, identify closest approaching stop
      if (!currentStop) {
        let minDistance = Infinity;
        let closestIdx = 0;
        route.stops.forEach((stop, idx) => {
          const dist = GeoEngine.getDistanceMeters(lat, lng, stop.lat, stop.lng);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = idx;
          }
        });
        currentStop = route.stops[closestIdx];
        nextStop = route.stops[closestIdx + 1] || route.stops[route.stops.length - 1];
      }

      const etaObj = GeoEngine.calculateETA(lat, lng, speed, nextStop);
      distToNextKm = GeoEngine.getDistanceKm(lat, lng, nextStop.lat, nextStop.lng);
      etaMinutes = etaObj.minutes;

      // Calculate approximate route completion percentage
      const currentIdx = route.stops.findIndex((s) => s.id === currentStop.id);
      progressPct = route.stops.length > 1 ? Math.round((currentIdx / (route.stops.length - 1)) * 100) : 0;
    }

    const updatePayload = {
      lat,
      lng,
      speed: Math.max(0, speed),
      bearing: Math.round(bearing),
      isTripActive: true,
      currentStopId: currentStop ? currentStop.id : null,
      currentStopName: currentStop ? currentStop.name : 'En Route',
      nextStopId: nextStop ? nextStop.id : null,
      nextStopName: nextStop ? nextStop.name : 'Destination',
      distanceToNextKm: Math.round(distToNextKm * 10) / 10,
      etaMinutes,
      routeProgress: progressPct,
      reachedStopIds,
      status: speed > 2 ? 'Running' : 'Stopped'
    };

    // Broadcast through global state
    window.appState.updateBusLocation(this.busId, updatePayload);

    // Update Bus Mini Map
    if (this.mapManager) {
      this.mapManager.updateBusMarker(Object.assign({}, bus, updatePayload), true, true);
      this.mapManager.centerOnLocation(lat, lng, 15);
    }

    this.render();

  }

  setCrowdLevel(level) {
    const bus = window.appState.getBusById(this.busId);
    if (!bus) return;

    window.appState.updateBusCrowd(this.busId, level);
    this.render();

    const crowdLabels = {
      'Low': '🟢 Low Crowd (Seats Available)',
      'Moderate': '🟡 Moderate Crowd (Standing Only)',
      'Heavy': '🔴 Heavy Crowd (Bus Full/Packed)'
    };
    window.app.showToast(`Bus Occupancy updated: ${crowdLabels[level] || level}`, 'success');
  }

  render() {
    const bus = window.appState.getBusById(this.busId);
    if (!bus) return;

    const activeTripContent = document.getElementById('condActiveTripContent');
    if (activeTripContent) {
      activeTripContent.style.display = bus.isTripActive ? 'block' : 'none';
    }

    // Bus Telemetry Strip
    const liveSpeed = document.getElementById('condLiveSpeed');
    const currentStop = document.getElementById('condCurrentStop');
    const nextStop = document.getElementById('condNextStop');
    const nextEta = document.getElementById('condNextEta');
    const tripStatusBox = document.getElementById('condTripStatusBox');
    const statusTitle = document.getElementById('condTripStatusTitle');
    const statusSubtitle = document.getElementById('condTripStatusSubtitle');
    const radarTitle = document.getElementById('condGeofenceTitle');
    const crowdBadge = document.getElementById('condCurrentCrowdBadge');

    if (liveSpeed) liveSpeed.innerHTML = `${bus.speed || 0} <small>km/h</small>`;
    if (currentStop) currentStop.textContent = bus.currentStopName || 'On Route';
    if (nextStop) nextStop.textContent = bus.nextStopName || 'Destination';
    if (nextEta) nextEta.textContent = `${bus.etaMinutes || 0} min (${bus.distanceToNextKm || 0} km)`;

    // Bus Crowd Buttons Highlight
    const currentCrowd = bus.crowdLevel || 'Moderate';
    ['Low', 'Moderate', 'Heavy'].forEach((lvl) => {
      const btn = document.getElementById(`btnCrowd${lvl}`);
      if (btn) {
        if (currentCrowd === lvl) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    if (crowdBadge) {
      const crowdClass = currentCrowd === 'Low' ? 'green' : (currentCrowd === 'Heavy' ? 'red' : 'amber');
      crowdBadge.innerHTML = `<span class="dot ${crowdClass}"></span> ${currentCrowd} Crowd`;
    }

    if (tripStatusBox && statusTitle && statusSubtitle) {
      if (this.isTripActive) {
        tripStatusBox.className = 'trip-status-indicator';
        statusTitle.textContent = 'Trip In Progress (Real GPS Active)';
        statusSubtitle.textContent = 'Streaming live phone GPS coordinates to passengers & control room';
      } else {
        tripStatusBox.className = 'trip-status-indicator stopped';
        statusTitle.textContent = 'Trip Stopped / Off Duty';
        statusSubtitle.textContent = 'Press Start Trip to activate live phone GPS broadcast';
      }
    }

    if (radarTitle) {
      radarTitle.textContent = `Approaching ${bus.nextStopName || 'Next Stop'} (${bus.etaMinutes || 0} min)`;
    }
  }
}

window.Bus = new BusController();
