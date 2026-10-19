/**
 * BusController: Real-Time GPS Geolocation Mobile Console & Driver Cockpit
 * Pure English Edition with 100% tactile responsive controls.
 */
class BusController {
  constructor() {
    this.busId = 'BUS-1';
    this.isTripActive = false;
    this.watchId = null;
    this.mapManager = null;
    this.lastPosition = null;
    this.tripStartTime = null;
    this.tripTimerInterval = null;
    this.voiceAnnouncementEnabled = true;
    this.isChecklistOpen = false;

    // Subscribe to state changes
    window.appState.subscribe((state, event) => {
      this.syncBusProfile();
      this.render();
    });
  }

  getBus() {
    let bus = window.appState.getBusById(this.busId);
    if (!bus && window.appState.buses && window.appState.buses.length > 0) {
      bus = window.appState.buses[0];
      this.busId = bus.id;
    }
    return bus;
  }

  init() {
    this.syncBusProfile();

    if (!this.mapManager) {
      this.mapManager = new MapManager('condMap', { zoom: 14 });
    }

    const bus = this.getBus();
    if (bus) {
      this.isTripActive = bus.isTripActive === true;
      const route = window.appState.getRouteById(bus.routeId);
      if (route && this.mapManager) {
        this.mapManager.clearStops();
        this.mapManager.renderRouteStops(route, [bus]);
        this.mapManager.updateBusMarker(bus, true, true);
        if (bus.lat && bus.lng) {
          this.mapManager.centerOnLocation(bus.lat, bus.lng, 14);
        }
      }
    }

    // If trip was already marked active, start live phone GPS and timer immediately
    if (this.isTripActive) {
      this.startTripTimer();
      this.startPhoneGps();
    }

    this.render();
    if (window.lucide) {
      setTimeout(() => lucide.createIcons(), 50);
    }
  }

  syncBusProfile() {
    const user = window.appState.currentUser;
    if (user && user.role === 'Bus') {
      const uBusId = user.busId || user.bus_id;
      if (uBusId) this.busId = uBusId;
      const nameEl = document.getElementById('condNameDisplay');
      if (nameEl) nameEl.textContent = user.name;
      const roleEl = document.getElementById('condRoleDisplay');
      if (roleEl) roleEl.textContent = `DUTY DRIVER • ID: ${(user.id || '').toUpperCase()}`;
    }

    const bus = this.getBus();
    if (bus) {
      if (this._hasExplicitTripState) {
        bus.isTripActive = this.isTripActive;
      } else {
        this.isTripActive = bus.isTripActive === true;
      }

      const badge = document.getElementById('condAssignedBusBadge');
      if (badge) badge.textContent = `BUS ${bus.busNumber}`;

      const route = window.appState.getRouteById(bus.routeId);
      if (route) {
        const routeName = document.getElementById('condRouteName');
        const stopsCount = document.getElementById('condStopsCount');
        if (routeName) routeName.textContent = route.name;
        if (stopsCount) stopsCount.textContent = `${route.stops ? route.stops.length : 0} Stops`;
      }
      
      const routeSelect = document.getElementById('condRouteSelect');
      if (routeSelect) {
        const assignedIds = bus.assignedRouteIds || (bus.routeId ? [bus.routeId] : []);
        routeSelect.innerHTML = assignedIds.map(rId => {
          const r = window.appState.getRouteById(rId);
          return r ? `<option value="${r.id}" ${r.id === bus.routeId ? 'selected' : ''}>${r.code} - ${r.name}</option>` : '';
        }).join('');
        routeSelect.disabled = this.isTripActive;
      }
    }
  }

  async changeActiveRoute() {
    if (this.isTripActive) return;
    const bus = this.getBus();
    const select = document.getElementById('condRouteSelect');
    if (bus && select) {
      bus.routeId = select.value;
      const route = window.appState.getRouteById(bus.routeId);
      if (route && route.stops && route.stops.length > 0) {
        bus.lat = route.stops[0].lat;
        bus.lng = route.stops[0].lng;
        bus.currentStopId = route.stops[0].id;
        bus.currentStopName = route.stops[0].name;
        bus.reachedStopIds = [route.stops[0].id];
        if (route.stops.length > 1) {
          bus.nextStopId = route.stops[1].id;
          bus.nextStopName = route.stops[1].name;
        } else {
          bus.nextStopId = route.stops[0].id;
          bus.nextStopName = route.stops[0].name;
        }
      }
      await window.appState.saveBus(bus);
      this.syncBusProfile();
      this.render();
      if (this.mapManager && route) {
        this.mapManager.clearStops();
        this.mapManager.renderRouteStops(route, [bus]);
        this.mapManager.updateBusMarker(bus, true, true);
        this.mapManager.centerOnLocation(bus.lat, bus.lng, 14);
      }
      window.app.showToast('Active route updated.', 'info');
    }
  }

  /**
   * Instantly and synchronously updates all trip HUD and duty indicators in DOM.
   */
  updateTripStatusUI(isActive) {
    this.isTripActive = Boolean(isActive);

    const dutyPill = document.getElementById('condDutyPill');
    const dutyText = document.getElementById('condDutyText');
    if (dutyPill && dutyText) {
      dutyPill.className = this.isTripActive ? 'cockpit-duty-pill active' : 'cockpit-duty-pill standby';
      dutyText.textContent = this.isTripActive ? 'LIVE ON DUTY' : 'OFF DUTY';
    }

    const btnStart = document.getElementById('btnCondStartTrip');
    const btnEnd = document.getElementById('btnCondEndTrip');
    if (btnStart) {
      btnStart.disabled = this.isTripActive;
    }
    if (btnEnd) {
      btnEnd.disabled = false;
      btnEnd.style.opacity = this.isTripActive ? '1' : '0.85';
      btnEnd.style.cursor = 'pointer';
    }

    const tripStatusBox = document.getElementById('condTripStatusBox');
    const statusTitle = document.getElementById('condTripStatusTitle');
    const statusSubtitle = document.getElementById('condTripStatusSubtitle');
    if (tripStatusBox && statusTitle && statusSubtitle) {
      if (this.isTripActive) {
        tripStatusBox.classList.add('active');
        statusTitle.textContent = 'Trip In Progress • Live GPS Active';
        statusSubtitle.textContent = 'Streaming coordinates to passengers & control room';
      } else {
        tripStatusBox.classList.remove('active');
        statusTitle.textContent = 'Trip Stopped / Off Duty';
        statusSubtitle.textContent = 'Press Start Trip to activate live phone GPS broadcast';
      }
    }
  }

  /**
   * Starts trip and activates Real Device GPS Geolocation
   */
  startTrip() {
    this.isTripActive = true;
    this._hasExplicitTripState = true;
    this.updateTripStatusUI(true);

    const bus = this.getBus();
    if (bus) {
      bus.isTripActive = true;
      bus.status = 'Running';
      window.appState.updateBusLocation(this.busId, { isTripActive: true, status: 'Running' });
    }

    try {
      fetch(`/api/buses/${this.busId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTripActive: true, status: 'Running' })
      });
    } catch (e) {}

    try {
      this.startPhoneGps();
    } catch (e) {
      console.warn('GPS init warning:', e);
    }

    this.playChime();
    this.render();
    window.app.showToast('Trip Started! Live GPS location is streaming to passengers.', 'success');
  }

  /**
   * Ends trip and stops GPS Geolocation
   * ALWAYS clickable and works smoothly.
   */
  endTrip() {
    this.isTripActive = false;
    this._hasExplicitTripState = true;
    this.updateTripStatusUI(false);
    this.stopPhoneGps();

    const bus = this.getBus();
    if (bus) {
      bus.isTripActive = false;
      bus.status = 'Offline';
      bus.speed = 0;
      window.appState.updateBusLocation(this.busId, { isTripActive: false, status: 'Offline', speed: 0 });
    }

    try {
      fetch(`/api/buses/${this.busId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTripActive: false, status: 'Offline', speed: 0 })
      });
    } catch (e) {}

    this.playChime();
    this.render();
    window.app.showToast('Trip Ended. GPS broadcast stopped.', 'info');
  }

  startTripTimer() {}
  stopTripTimer() {}
  reachNextStop() {}

  /**
   * Jump directly to any stop from the timeline
   */
  jumpToStop(stopId) {
    const bus = this.getBus();
    if (!bus) return;
    const route = window.appState.getRouteById(bus.routeId);
    if (!route || !route.stops) return;

    const stopIdx = route.stops.findIndex(s => s.id === stopId);
    if (stopIdx === -1) return;

    const currentStop = route.stops[stopIdx];
    const nextStop = route.stops[stopIdx + 1] || route.stops[stopIdx];
    let reachedStopIds = Array.isArray(bus.reachedStopIds) ? [...bus.reachedStopIds] : [];
    
    // Mark all prior stops as reached too
    for (let i = 0; i <= stopIdx; i++) {
      if (!reachedStopIds.includes(route.stops[i].id)) {
        reachedStopIds.push(route.stops[i].id);
      }
    }

    const progressPct = route.stops.length > 1 ? Math.round((stopIdx / (route.stops.length - 1)) * 100) : 100;
    const distToNextKm = GeoEngine.getDistanceKm(currentStop.lat, currentStop.lng, nextStop.lat, nextStop.lng);
    const etaObj = GeoEngine.calculateETA(currentStop.lat, currentStop.lng, bus.speed || 30, nextStop);

    const updatePayload = {
      lat: currentStop.lat,
      lng: currentStop.lng,
      currentStopId: currentStop.id,
      currentStopName: currentStop.name,
      nextStopId: nextStop.id,
      nextStopName: nextStop.name,
      distanceToNextKm: Math.round(distToNextKm * 10) / 10,
      etaMinutes: etaObj.minutes,
      routeProgress: progressPct,
      reachedStopIds
    };

    window.appState.updateBusLocation(this.busId, updatePayload);
    this.playChime();
    window.app.showToast(`Updated location to ${currentStop.name}`, 'info');

    if (this.mapManager) {
      this.mapManager.updateBusMarker(Object.assign({}, bus, updatePayload), true, true);
      this.mapManager.centerOnLocation(currentStop.lat, currentStop.lng, 15);
    }
    this.render();
  }

  toggleVoiceAnnouncement() {}

  playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  speakAnnouncement(text) {}

  changePassengerCount(delta) {
    const bus = this.getBus();
    if (!bus) return;
    const current = bus.passengerCount || 0;
    const nextCount = Math.max(0, current + delta);
    bus.passengerCount = nextCount;
    window.appState.updateBusLocation(this.busId, { passengerCount: nextCount });
    const countEl = document.getElementById('condPassengerCount');
    if (countEl) countEl.textContent = nextCount;
  }

  broadcastDelay(alertText) {
    const bus = this.getBus();
    if (!bus) return;
    bus.delayAlert = alertText;
    window.appState.updateBusLocation(this.busId, { delayAlert: alertText });
    this.render();
    window.app.showToast(`Passenger Alert broadcast: ${alertText}`, 'success');
  }

  clearDelayAlert() {
    const bus = this.getBus();
    if (!bus) return;
    bus.delayAlert = '';
    window.appState.updateBusLocation(this.busId, { delayAlert: '' });
    this.render();
    window.app.showToast('Delay notice cleared. Service running on time.', 'info');
  }

  toggleStopsChecklist() {
    this.isChecklistOpen = !this.isChecklistOpen;
    const wrapper = document.getElementById('condStopsTimelineWrapper');
    const chevron = document.getElementById('stopsChevron');
    const toggleText = document.getElementById('checklistToggleText');
    if (wrapper) wrapper.style.display = this.isChecklistOpen ? 'block' : 'none';
    if (chevron) chevron.style.transform = this.isChecklistOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    if (toggleText) toggleText.textContent = this.isChecklistOpen ? 'Collapse' : 'View All';
  }

  centerMapOnBus() {
    const bus = this.getBus();
    if (bus && bus.lat && bus.lng && this.mapManager) {
      this.mapManager.centerOnLocation(bus.lat, bus.lng, 15);
      window.app.showToast('Centered map on bus position', 'info');
    }
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
    const bus = this.getBus();
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
            this.playChime();
            this.speakAnnouncement(`Arrived at stop ${stop.name}.`);
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
    const bus = this.getBus();
    if (!bus) return;

    window.appState.updateBusCrowd(this.busId, level);
    this.render();

    const crowdLabels = {
      'Low': '🟢 Low Crowd (Seats Available)',
      'Moderate': '🟡 Moderate Crowd (Standing Only)',
      'Heavy': '🔴 Heavy Crowd (Bus Full)'
    };
    window.app.showToast(`Bus Occupancy updated: ${crowdLabels[level] || level}`, 'success');
  }

  render() {
    this.updateTripStatusUI(this.isTripActive);

    const bus = this.getBus();
    if (!bus) return;
    const route = window.appState.getRouteById(bus.routeId);

    // Next Stop Hopper
    const nextStopBtnName = document.getElementById('condNextStopBtnName');
    const currentStopEl = document.getElementById('condCurrentStop');
    const nextStopEl = document.getElementById('condNextStop');
    const nextEtaEl = document.getElementById('condNextEta');

    if (nextStopBtnName) {
      nextStopBtnName.textContent = bus.nextStopName ? bus.nextStopName : (bus.currentStopName || 'Select Route');
    }
    if (currentStopEl) currentStopEl.textContent = bus.currentStopName || 'Origin / En Route';
    if (nextStopEl) nextStopEl.textContent = bus.nextStopName || 'Terminus';
    if (nextEtaEl) nextEtaEl.textContent = `${bus.etaMinutes || 0} min (${bus.distanceToNextKm || 0} km)`;

    // Speedometer
    const liveSpeed = document.getElementById('condLiveSpeed');
    const speedBar = document.getElementById('condSpeedBar');
    const curSpeed = bus.speed || 0;
    if (liveSpeed) liveSpeed.textContent = curSpeed;
    if (speedBar) {
      const pct = Math.min(100, Math.round((curSpeed / 80) * 100));
      speedBar.style.width = `${pct}%`;
    }

    // Passenger Count
    const passengerCountEl = document.getElementById('condPassengerCount');
    if (passengerCountEl) {
      passengerCountEl.textContent = bus.passengerCount || 0;
    }

    // Geofence Radar Box
    const radarTitle = document.getElementById('condGeofenceTitle');
    if (radarTitle) {
      radarTitle.textContent = `Approaching ${bus.nextStopName || 'Next Stop'} (${bus.etaMinutes || 0} min)`;
    }

    // Crowd Buttons Highlight
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

    const crowdBadge = document.getElementById('condCurrentCrowdBadge');
    if (crowdBadge) {
      const crowdClass = currentCrowd === 'Low' ? 'green' : (currentCrowd === 'Heavy' ? 'red' : 'amber');
      crowdBadge.innerHTML = `<span class="dot ${crowdClass}"></span> ${currentCrowd} Crowd`;
    }

    // Delay Alert Notice
    const delayNotice = document.getElementById('condActiveDelayNotice');
    if (delayNotice) {
      if (bus.delayAlert) {
        delayNotice.style.display = 'flex';
        delayNotice.innerHTML = `⚠️ <span>Active Notice: <strong>${bus.delayAlert}</strong></span>`;
      } else {
        delayNotice.style.display = 'none';
      }
    }

    // Render Stops Checklist
    this.renderStopsChecklist(route, bus);
  }

  renderStopsChecklist(route, bus) {
    const listEl = document.getElementById('condStopsTimeline');
    const badgeEl = document.getElementById('condProgressBadge');
    if (!listEl) return;

    if (!route || !route.stops || route.stops.length === 0) {
      listEl.innerHTML = '<div style="color: #94a3b8; font-size: 0.8rem; padding: 10px;">No stops assigned to this route.</div>';
      if (badgeEl) badgeEl.textContent = '0 / 0';
      return;
    }

    const reachedIds = Array.isArray(bus.reachedStopIds) ? bus.reachedStopIds : [];
    if (badgeEl) {
      badgeEl.textContent = `${reachedIds.length} / ${route.stops.length} Reached`;
    }

    listEl.innerHTML = route.stops.map((stop, idx) => {
      const isReached = reachedIds.includes(stop.id);
      const isCurrent = stop.id === bus.currentStopId;
      const isNext = stop.id === bus.nextStopId;

      let itemClass = 'upcoming';
      let tagText = 'Upcoming';
      if (isReached) {
        itemClass = 'reached';
        tagText = '✓ Reached';
      } else if (isCurrent) {
        itemClass = 'current';
        tagText = '📍 Current';
      } else if (isNext) {
        itemClass = 'upcoming';
        tagText = '⏳ Next';
      }

      return `
        <div class="stop-checklist-item ${itemClass}" onclick="Bus.jumpToStop('${stop.id}')" title="Tap to mark reached">
          <div class="stop-seq-badge">${isReached ? '✓' : (idx + 1)}</div>
          <div class="stop-item-name">${stop.name}</div>
          <span class="stop-status-tag">${tagText}</span>
        </div>
      `;
    }).join('');
  }
}

window.Bus = new BusController();
