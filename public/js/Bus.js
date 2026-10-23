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
    this.lastPositionTime = null;
    this.wakeLock = null;
    this.gpsWatchdogInterval = null;
    this.bgAudioEl = null;
    this.bgWorker = null;
    this.isChecklistOpen = false;
    this._isGpsQueryPending = false;

    // Setup screen resume / visibility handlers immediately
    this.setupVisibilityHandlers();

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

    // Trips must ONLY start when the user explicitly clicks the "Start Trip" button.
    // Page load / refresh must always stay in standby / offline mode.
    this.isTripActive = false;
    this._hasExplicitTripState = true;

    const bus = this.getBus();
    if (bus) {
      bus.isTripActive = false;

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

    this.updateTripStatusUI(false);
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
      bus.isTripActive = this.isTripActive;

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
      dutyText.textContent = this.isTripActive ? 'LIVE ON DUTY' : 'OFFLINE';
    }

    const btnStart = document.getElementById('btnCondStartTrip');
    const btnEnd = document.getElementById('btnCondEndTrip');
    if (btnStart) {
      btnStart.disabled = this.isTripActive;
    }
    if (btnEnd) {
      btnEnd.disabled = !this.isTripActive;
      btnEnd.style.opacity = this.isTripActive ? '1' : '0.5';
      btnEnd.style.cursor = this.isTripActive ? 'pointer' : 'not-allowed';
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
        statusTitle.textContent = 'Trip Stopped / Offline';
        statusSubtitle.textContent = 'Bus is offline. Press Start Trip to activate live phone GPS broadcast';
      }
    }

    // Toggle active trip console panels vs offline standby notice
    const activeContent = document.getElementById('condActiveTripContent');
    const offlineNotice = document.getElementById('condOfflineNotice');
    if (activeContent) {
      activeContent.style.display = this.isTripActive ? 'block' : 'none';
    }
    if (offlineNotice) {
      offlineNotice.style.display = this.isTripActive ? 'none' : 'flex';
    }

    // Refresh map viewport when activating
    if (this.isTripActive && this.mapManager && this.mapManager.map) {
      setTimeout(() => {
        try {
          this.mapManager.map.invalidateSize();
          const bus = this.getBus();
          if (bus && bus.lat && bus.lng) {
            this.mapManager.centerOnLocation(bus.lat, bus.lng, 15);
          }
        } catch (e) {}
      }, 150);
    }
  }

  /**
   * Starts trip and activates Real Device GPS Geolocation
   */
  startTrip() {
    this.isTripActive = true;
    this._hasExplicitTripState = true;
    try {
      localStorage.setItem('citybus_active_trip_' + this.busId, 'true');
    } catch (e) {}

    this.updateTripStatusUI(true);
    this.requestWakeLock();
    this.startBackgroundMediaService();
    this.startBackgroundWorker();
    this.startGpsWatchdog();

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
        body: JSON.stringify({ isTripActive: true, status: 'Running' }),
        keepalive: true
      });
    } catch (e) {}

    // 1. Direct Native Android Background Service (Rock-solid foreground service with persistent status bar notification)
    if (window.AndroidGpsService && typeof window.AndroidGpsService.startGps === 'function') {
      try {
        window.AndroidGpsService.startGps(this.busId);
        console.log('🚀 Direct Native AndroidGpsService.startGps called for bus:', this.busId);
      } catch (nativeErr) {
        console.warn('AndroidGpsService error:', nativeErr);
      }
    }

    // 2. Capacitor native plugin invocation
    if (window.Capacitor?.nativePromise) {
      window.Capacitor.nativePromise('BackgroundLocation', 'start', { busId: this.busId }).catch(() => {});
    }
    if (window.Capacitor?.Plugins?.BackgroundLocation) {
      try {
        window.Capacitor.Plugins.BackgroundLocation.removeAllListeners();
        window.Capacitor.Plugins.BackgroundLocation.start({ busId: this.busId });
        window.Capacitor.Plugins.BackgroundLocation.addListener('onLocation', (loc) => {
          if (!this.isTripActive) return;
          this.processNewCoordinates(loc.lat, loc.lng, loc.speed, loc.bearing);
        });
      } catch (e) {}
    }

    try {
      this.startPhoneGps();
    } catch (e) {
      console.warn('GPS init warning:', e);
    }

    this.playChime();
    this.render();
    window.app.showToast('Trip Started! Screen will stay awake and live GPS is broadcasting in background.', 'success');
  }

  /**
   * Ends trip and stops GPS Geolocation
   * Transitions immediately to Offline state.
   */
  endTrip() {
    this.isTripActive = false;
    this._hasExplicitTripState = true;
    try {
      localStorage.removeItem('citybus_active_trip_' + this.busId);
    } catch (e) {}

    // 1. Immediately terminate browser GPS streams and workers to drop any in-flight reads
    this.stopPhoneGps();
    this.stopGpsWatchdog();
    this.stopBackgroundWorker();
    this.stopBackgroundMediaService();
    this.releaseWakeLock();

    // 2. Stop Direct Native Android Foreground Service & purge location queue
    if (window.AndroidGpsService && typeof window.AndroidGpsService.stopGps === 'function') {
      try {
        window.AndroidGpsService.stopGps();
        console.log('🛑 Direct Native AndroidGpsService.stopGps called');
      } catch (e) {}
    }

    // 3. Capacitor plugin stop and listener cleanup
    if (window.Capacitor?.nativePromise) {
      window.Capacitor.nativePromise('BackgroundLocation', 'stop', {}).catch(() => {});
    }
    if (window.Capacitor?.Plugins?.BackgroundLocation) {
      try {
        window.Capacitor.Plugins.BackgroundLocation.removeAllListeners();
        window.Capacitor.Plugins.BackgroundLocation.stop();
      } catch (e) {}
    }

    this.updateTripStatusUI(false);

    // 4. Update in-memory state & notify local state listeners (Passenger, Admin, Bus)
    const bus = this.getBus();
    if (bus) {
      bus.isTripActive = false;
      bus.status = 'Offline';
      bus.speed = 0;
      window.appState.updateBusLocation(this.busId, { isTripActive: false, status: 'Offline', speed: 0 });
    }

    // 5. Direct Supabase real-time cloud broadcast via CloudDB
    if (window.CloudDB && typeof window.CloudDB.updateBusLocation === 'function') {
      window.CloudDB.updateBusLocation(this.busId, { isTripActive: false, status: 'Offline', speed: 0 });
    }

    // 6. Direct HTTPS PATCH to Supabase REST endpoint for 100% guaranteed delivery
    try {
      const SUPABASE_URL = 'https://yvjfcmjmlcuzxscvuzhm.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2amZjbWptbGN1enhzY3Z1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMjU3MzUsImV4cCI6MjEwNzgwMTczNX0.dZ7IL_sySbvIYApMWVkWJZN4gMKkufbIZqOicO9uIXQ';
      fetch(`${SUPABASE_URL}/rest/v1/buses?id=eq.${encodeURIComponent(this.busId)}`, {
        method: 'POST',
        headers: {
          'X-HTTP-Method-Override': 'PATCH',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: 'Offline',
          is_trip_active: false,
          speed: 0,
          last_updated: new Date().toISOString()
        }),
        keepalive: true
      }).catch(() => {});
    } catch (e) {}

    // 7. Express backend sync if reachable
    try {
      fetch(`/api/buses/${this.busId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTripActive: false, status: 'Offline', speed: 0 }),
        keepalive: true
      }).catch(() => {});
    } catch (e) {}

    this.playChime();
    this.render();
    window.app.showToast('Trip Ended. Bus is now Offline.', 'info');
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

  changePassengerCount(delta) {}

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
   * Automatically handles phone screen wake-up / tab foregrounding / backgrounding
   * Keeps GPS streaming active whether screen is manually locked or browser is minimized.
   */
  setupVisibilityHandlers() {
    const handleVisibilityOrFocus = () => {
      if (!this.isTripActive) return;

      if (document.visibilityState === 'visible') {
        console.log('📱 Phone screen turned on / tab focused: force-refreshing GPS streams');
        this.requestWakeLock();
        
        // Ensure background audio keep-alive is running
        if (this.bgAudioEl && this.bgAudioEl.paused) {
          this.bgAudioEl.play().catch(() => {});
        }
        
        // Ensure background worker is running
        if (!this.bgWorker) {
          this.startBackgroundWorker();
        }

        // CRITICAL FIX: Kill stale/frozen watchPosition and start a fresh OS listener
        this.stopPhoneGps();
        this.startPhoneGps();

        // Immediate direct hardware ping with 3s maxAge for instant unfreeze
        this.queryHardwareGps();

        this.render();

        if (this.mapManager && this.mapManager.map) {
          setTimeout(() => {
            try { this.mapManager.map.invalidateSize(); } catch (e) {}
          }, 100);
        }
      } else {
        console.log('📱 Tab hidden / screen off: reinforcing background keep-alive services');
        if (this.bgAudioEl && this.bgAudioEl.paused) {
          this.bgAudioEl.play().catch(() => {});
        }
        if (!this.bgWorker) {
          this.startBackgroundWorker();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);
  }

  /**
   * Screen Wake Lock API: Keeps phone screen awake & bright while on duty
   */
  async requestWakeLock() {
    if ('wakeLock' in navigator && this.isTripActive) {
      try {
        if (!this.wakeLock || this.wakeLock.released) {
          this.wakeLock = await navigator.wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
          });
          console.log('💡 Screen Wake Lock acquired (screen will stay awake while on duty)');
        }
      } catch (err) {
        console.warn('Wake Lock request warning:', err);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }
  }

  /**
   * HTML5 Audio & MediaSession API Foreground Service:
   * Keeps the tab registered in Android OS / iOS as an active Media Foreground Service.
   * This prevents mobile browsers from freezing JS execution when:
   * 1. The phone power button is pressed (screen manually locked)
   * 2. The driver navigates away from the browser (WhatsApp, Google Maps, Home screen)
   */
  startBackgroundMediaService() {
    try {
      if (!this.bgAudioEl) {
        let el = document.getElementById('bgTrackerAudio');
        if (!el) {
          el = document.createElement('audio');
          el.id = 'bgTrackerAudio';
          el.src = '/silence.wav';
          el.loop = true;
          el.preload = 'auto';
          el.setAttribute('playsinline', '');
          el.setAttribute('webkit-playsinline', '');
          el.style.position = 'fixed';
          el.style.bottom = '-9999px';
          el.style.left = '-9999px';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          document.body.appendChild(el);
        }
        this.bgAudioEl = el;
      }

      // Start playing silence (authorized by Start Trip touch gesture)
      const playPromise = this.bgAudioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio service autoplay deferred, will resume on user touch:', err);
        });
      }

      // Configure MediaSession API for OS-level foreground service status
      if ('mediaSession' in navigator) {
        const bus = this.getBus();
        const busNum = bus ? bus.busNumber : '1';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `Bus ${busNum} GPS Broadcasting`,
          artist: 'CityBus Real-Time Tracking',
          album: 'Live Location Streaming • Active'
        });
        navigator.mediaSession.playbackState = 'playing';

        // Keep active even if user interacts with media controls in lock screen
        navigator.mediaSession.setActionHandler('play', () => {
          if (this.bgAudioEl) this.bgAudioEl.play().catch(() => {});
          navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          // Re-trigger play immediately to prevent OS sleep
          if (this.isTripActive && this.bgAudioEl) {
            this.bgAudioEl.play().catch(() => {});
            navigator.mediaSession.playbackState = 'playing';
          }
        });
      }

      // Also start Web Audio keep-alive as secondary fallback
      this.startSilentAudioKeepAlive();
    } catch (e) {
      console.warn('Background media service init warning:', e);
    }
  }

  stopBackgroundMediaService() {
    try {
      if (this.bgAudioEl) {
        this.bgAudioEl.pause();
        this.bgAudioEl.currentTime = 0;
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      this.stopSilentAudioKeepAlive();
    } catch (e) {
      console.warn('Background media service stop error:', e);
    }
  }

  /**
   * Silent Web Audio Keep-Alive Loop: Secondary audio subsystem insurance
   */
  startSilentAudioKeepAlive() {
    try {
      if (!this.keepAliveAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.keepAliveAudioCtx = new AudioCtx();
          // Generate imperceptible 15Hz sub-audible tone (amplitude 0.0001)
          // Prevents Chrome on Android from detecting silence and suspending the audio sink
          const sampleRate = this.keepAliveAudioCtx.sampleRate;
          const buffer = this.keepAliveAudioCtx.createBuffer(1, sampleRate * 2, sampleRate);
          const channelData = buffer.getChannelData(0);
          for (let i = 0; i < channelData.length; i++) {
            channelData[i] = Math.sin(2 * Math.PI * 15 * (i / sampleRate)) * 0.0001;
          }
          const source = this.keepAliveAudioCtx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(this.keepAliveAudioCtx.destination);
          source.start(0);
          this.keepAliveSource = source;
        }
      }
      if (this.keepAliveAudioCtx && this.keepAliveAudioCtx.state === 'suspended') {
        this.keepAliveAudioCtx.resume();
      }
    } catch (e) {}
  }

  stopSilentAudioKeepAlive() {
    try {
      if (this.keepAliveSource) {
        this.keepAliveSource.stop();
        this.keepAliveSource = null;
      }
      if (this.keepAliveAudioCtx) {
        this.keepAliveAudioCtx.close();
        this.keepAliveAudioCtx = null;
      }
    } catch (e) {}
  }

  /**
   * Background Web Worker:
   * Timers in the main window get throttled to once a minute or paused when a tab is hidden.
   * Web Workers run in an isolated OS background thread that is NOT throttled when the tab
   * is kept alive via the Foreground Media Service.
   * Ticks every 3 seconds to trigger fresh hardware GPS readings.
   */
  startBackgroundWorker() {
    this.stopBackgroundWorker();
    try {
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(function() {
              self.postMessage('tick');
            }, 3000);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
            timer = null;
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.bgWorker = new Worker(workerUrl);

      this.bgWorker.onmessage = (e) => {
        if (e.data === 'tick' && this.isTripActive) {
          this.queryHardwareGps();
        }
      };

      this.bgWorker.postMessage('start');
      console.log('⚡ Background Web Worker started for continuous GPS broadcast');
    } catch (err) {
      console.warn('Web Worker creation failed, fallback to watchdog:', err);
    }
  }

  stopBackgroundWorker() {
    if (this.bgWorker) {
      try {
        this.bgWorker.postMessage('stop');
        this.bgWorker.terminate();
      } catch (e) {}
      this.bgWorker = null;
    }
  }

  /**
   * Direct Hardware GPS Query:
   * Pings device GPS chip directly with maximumAge: 3000 to rapidly retrieve fresh fused coordinates.
   */
  queryHardwareGps() {
    if (!this.isTripActive || !navigator.geolocation) return;
    if (this._isGpsQueryPending) return;
    this._isGpsQueryPending = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this._isGpsQueryPending = false;
        this.handlePositionUpdate(pos);
      },
      (err) => {
        this._isGpsQueryPending = false;
        console.debug('Direct GPS query notice:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 3000
      }
    );
  }

  /**
   * GPS Watchdog: Checks if coordinates are stalling, and forces a hardware ping
   */
  startGpsWatchdog() {
    this.stopGpsWatchdog();
    this.gpsWatchdogInterval = setInterval(() => {
      if (!this.isTripActive) return;

      const now = Date.now();
      const lastUpdateAge = this.lastPositionTime ? (now - this.lastPositionTime) : Infinity;

      // If no GPS coordinate arrived in the last 6 seconds, ping the GPS hardware directly
      if (lastUpdateAge > 6000) {
        this.queryHardwareGps();

        // If watchPosition went completely dead for more than 12s, restart stream
        if (lastUpdateAge > 12000) {
          this.startPhoneGps();
        }
      }
    }, 4000);
  }

  stopGpsWatchdog() {
    if (this.gpsWatchdogInterval) {
      clearInterval(this.gpsWatchdogInterval);
      this.gpsWatchdogInterval = null;
    }
  }

  /**
   * Unified GPS update handler for both watchPosition and instant watchdog pings
   */
  handlePositionUpdate(position) {
    if (!this.isTripActive || !position || !position.coords) return;
    this.lastPositionTime = Date.now();
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
      time: position.timestamp || Date.now()
    };

    const badge = document.getElementById('condGpsStatusBadge');
    if (badge && this.isTripActive) badge.innerHTML = '<span class="dot green"></span> GPS TRACKING LIVE';

    this.processNewCoordinates(latitude, longitude, calculatedSpeed, calculatedHeading);
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

    // Check & request native Android GPS permission if running in Capacitor
    if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.Geolocation) {
      try {
        window.Capacitor.Plugins.Geolocation.requestPermissions().catch(() => {});
      } catch (e) {}
    }

    const badge = document.getElementById('condGpsStatusBadge');
    if (badge) badge.innerHTML = '<span class="dot green"></span> GPS TRACKING LIVE';

    // Immediate direct reading with 3s maxAge for instant satellite/fused lock
    navigator.geolocation.getCurrentPosition(
      (pos) => this.handlePositionUpdate(pos),
      (err) => console.warn('Initial GPS lock notice:', err.message),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 3000 }
    );

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position),
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
        if (document.visibilityState === 'visible') {
          window.app.showToast(errorMsg, 'error');
        }

        const badge = document.getElementById('condGpsStatusBadge');
        if (badge && this.isTripActive) badge.innerHTML = '<span class="dot red"></span> GPS WAITING LOCK';
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
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
    if (!this.isTripActive) return;
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
      // 1. Check Geofence for stops and instantly register reached status
      let directHitIdx = -1;
      route.stops.forEach((stop, index) => {
        const geofence = GeoEngine.checkGeofence(lat, lng, stop.lat, stop.lng);
        if (geofence.status === 'Reached') {
          directHitIdx = index;
          if (!reachedStopIds.includes(stop.id)) {
            reachedStopIds.push(stop.id);
            this.playChime();
            this.speakAnnouncement(`Arrived at stop ${stop.name}.`);
            window.app.showToast(`Reached Stop #${stop.sequence}: ${stop.name} ✅`, 'success');
          }
          // Mark all previous stops up to this stop as reached as well
          for (let p = 0; p <= index; p++) {
            if (!reachedStopIds.includes(route.stops[p].id)) {
              reachedStopIds.push(route.stops[p].id);
            }
          }
        }
      });

      // 2. Determine last confirmed reached stop
      let lastReachedIdx = -1;
      for (let i = route.stops.length - 1; i >= 0; i--) {
        if (reachedStopIds.includes(route.stops[i].id)) {
          lastReachedIdx = i;
          break;
        }
      }

      if (directHitIdx !== -1) {
        // Bus is at a stop right now
        currentStop = route.stops[directHitIdx];
        nextStop = route.stops[directHitIdx + 1] || route.stops[directHitIdx];
      } else if (lastReachedIdx !== -1) {
        // Bus has left lastReachedIdx and is en-route towards the upcoming stop
        currentStop = route.stops[lastReachedIdx];
        nextStop = route.stops[lastReachedIdx + 1] || route.stops[lastReachedIdx];
      } else {
        // Bus hasn't reached the first stop yet; approaching stop 0
        currentStop = route.stops[0];
        nextStop = route.stops[0];
      }

      const etaObj = GeoEngine.calculateETA(lat, lng, speed, nextStop);
      distToNextKm = GeoEngine.getDistanceKm(lat, lng, nextStop.lat, nextStop.lng);
      etaMinutes = etaObj.minutes;

      // Calculate approximate route completion percentage
      const currentIdx = currentStop ? route.stops.findIndex((s) => s.id === currentStop.id) : 0;
      progressPct = route.stops.length > 1 ? Math.round((Math.max(0, currentIdx) / (route.stops.length - 1)) * 100) : 0;
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
      if (document.visibilityState === 'visible') {
        this.mapManager.centerOnLocation(lat, lng, 15);
      }
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
