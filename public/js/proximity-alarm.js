/**
 * ProximityAlarmController: "Wake Me Up" / Bus Approaching & Departing Stop Alerts
 * Allows passengers to set smart arrival & departure alerts for Boarding and Departing/Destination stops.
 * Supports Web Audio melodic notification chime, Departing stop chime, Browser Notifications, and Vibration.
 */
class ProximityAlarmController {
  constructor() {
    this.activeAlarm = null;
    this.audioCtx = null;
    this.soundLoopInterval = null;
    this.isPlayingAudio = false;
    this.currentStopMode = 'boarding'; // 'boarding' or 'departing'
    this.lastObservedStopId = null;

    // Load any saved alarm from localStorage
    try {
      const saved = localStorage.getItem('citybus_proximity_alarm');
      if (saved) {
        this.activeAlarm = JSON.parse(saved);
        if (this.activeAlarm) {
          this.activeAlarm.isTriggered = false;
          if (!this.activeAlarm.notifiedDepartures) {
            this.activeAlarm.notifiedDepartures = [];
          }
        }
      }
    } catch (e) {
      console.warn('Could not read saved alarm', e);
    }

    // Subscribe to state changes (GPS updates)
    if (window.appState) {
      window.appState.subscribe((state, event) => {
        this.onStateUpdated(state, event);
      });
    }
  }

  init() {
    this.renderFloatingWidget();
  }

  /**
   * Initializes or gets the Web Audio API context
   */
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Plays a pleasant, attention-grabbing melodic arrival notification chime
   */
  playMelodicChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Melodic arpeggio: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        // Envelope: soft attack, gentle decay
        gain.gain.setValueAtTime(0.001, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.28, now + idx * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.48);
      });
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  /**
   * Plays a distinct, brisk 2-tone chime when a bus departs a stop
   */
  playDepartureChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Rising departure alert: F5 (698.46) -> A5 (880.00)
      const notes = [698.46, 880.00];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0.001, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.15 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.38);
      });
    } catch (e) {
      console.warn('Departure chime error', e);
    }
  }

  /**
   * Starts looping alarm sound until dismissed
   */
  startLoopingAlarm() {
    this.stopLoopingAlarm();
    this.isPlayingAudio = true;
    this.playMelodicChime();
    this.soundLoopInterval = setInterval(() => {
      if (this.isPlayingAudio) {
        this.playMelodicChime();
      }
    }, 1800);
  }

  stopLoopingAlarm() {
    this.isPlayingAudio = false;
    if (this.soundLoopInterval) {
      clearInterval(this.soundLoopInterval);
      this.soundLoopInterval = null;
    }
  }

  /**
   * Test the notification sound chime so user knows what it sounds like
   */
  testChime() {
    this.playMelodicChime();
    if (window.app && window.app.showToast) {
      window.app.showToast('🔔 Playing notification sound...', 'info');
    }
  }

  /**
   * Native browser push notification
   */
  showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'bus-proximity-alarm',
          renotify: true
        });
      } catch (e) {
        console.warn('Notification error', e);
      }
    }
  }

  /**
   * Vibrates device if supported
   */
  vibrate() {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([400, 200, 400, 200, 500]);
      } catch (e) {}
    }
  }

  /**
   * Selects whether the alarm is for Boarding (Pickup) or Departing (Destination/Drop-off) stop
   */
  selectStopMode(mode) {
    this.currentStopMode = mode;
    const btnBoarding = document.getElementById('btnAlarmModeBoarding');
    const btnDeparting = document.getElementById('btnAlarmModeDeparting');
    const label = document.getElementById('alarmStopLabel');

    if (btnBoarding && btnDeparting) {
      if (mode === 'boarding') {
        btnBoarding.className = 'btn btn-xs btn-primary';
        btnDeparting.className = 'btn btn-xs btn-outline';
        if (label) label.textContent = 'Your Boarding Stop (Pickup)';
      } else {
        btnBoarding.className = 'btn btn-xs btn-outline';
        btnDeparting.className = 'btn btn-xs btn-primary';
        if (label) label.textContent = 'Your Departing / Destination Stop (Drop-off)';
      }
    }

    // Refresh stop options with preferred choice for this mode
    const busSelect = document.getElementById('alarmBusSelect');
    if (busSelect) {
      this.onAlarmBusChanged(busSelect.value);
    }
  }

  /**
   * Opens the Proximity Alarm Configuration Modal
   * @param {string} busId 
   * @param {string} defaultStopId 
   */
  openAlarmModal(busId = null, defaultStopId = null) {
    const modal = document.getElementById('proximityAlarmModal');
    if (!modal) return;

    // Check notification permission if not asked yet
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Determine target bus
    let targetBusId = busId || (window.appState ? window.appState.selectedBusId : null);
    if (!targetBusId && window.appState && window.appState.buses.length > 0) {
      const runningBus = window.appState.buses.find(b => b.isTripActive || b.status === 'Running');
      targetBusId = runningBus ? runningBus.id : window.appState.buses[0].id;
    }

    // Populate Bus select
    const busSelect = document.getElementById('alarmBusSelect');
    if (busSelect && window.appState) {
      busSelect.innerHTML = window.appState.buses.map(b => `
        <option value="${b.id}" ${b.id === targetBusId ? 'selected' : ''}>
          BUS ${b.busNumber} (${b.regNumber}) - ${b.status}
        </option>
      `).join('');
    }

    // Check if an alarm already exists to restore its mode
    if (this.activeAlarm && this.activeAlarm.busId === targetBusId) {
      this.currentStopMode = this.activeAlarm.stopMode || 'boarding';
    } else {
      // Default to boarding unless passenger currently has a destination selected
      this.currentStopMode = (window.passenger && window.passenger.selectedDestId) ? 'departing' : 'boarding';
    }

    this.selectStopMode(this.currentStopMode);
    this.onAlarmBusChanged(targetBusId, defaultStopId);

    // If there is already an active alarm for this bus, populate its values
    if (this.activeAlarm && this.activeAlarm.busId === targetBusId) {
      const typeSelect = document.getElementById('alarmTriggerType');
      const valInput = document.getElementById('alarmTriggerValue');
      const soundCheck = document.getElementById('alarmSoundCheck');
      const pushCheck = document.getElementById('alarmPushCheck');
      const departingCheck = document.getElementById('alarmDepartingCheck');

      if (typeSelect) typeSelect.value = this.activeAlarm.triggerType || 'distance';
      if (valInput) valInput.value = this.activeAlarm.triggerValue || 500;
      if (soundCheck) soundCheck.checked = this.activeAlarm.soundEnabled !== false;
      if (pushCheck) pushCheck.checked = this.activeAlarm.pushEnabled !== false;
      if (departingCheck) departingCheck.checked = this.activeAlarm.notifyDeparted !== false;
      this.updateTriggerUnitLabel();
    }

    modal.classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  closeAlarmModal() {
    const modal = document.getElementById('proximityAlarmModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Called when the bus selector in the modal changes
   */
  onAlarmBusChanged(busId = null, preferredStopId = null) {
    const busSelect = document.getElementById('alarmBusSelect');
    const selectedBusId = busId || (busSelect ? busSelect.value : null);
    const bus = window.appState ? window.appState.getBusById(selectedBusId) : null;
    const stopSelect = document.getElementById('alarmStopSelect');
    const busInfoBadge = document.getElementById('alarmBusInfoBadge');

    if (!stopSelect) return;

    if (!bus) {
      stopSelect.innerHTML = '<option value="">No bus selected</option>';
      return;
    }

    const route = window.appState.getRouteById(bus.routeId);
    if (busInfoBadge) {
      busInfoBadge.textContent = `${route ? route.name : 'Route'} • Current: ${bus.currentStopName || 'En route'}`;
    }

    if (!route || !route.stops || route.stops.length === 0) {
      stopSelect.innerHTML = '<option value="">No stops found for this route</option>';
      return;
    }

    // Determine default target stop depending on mode
    let defaultTarget = preferredStopId;
    if (!defaultTarget) {
      if (this.currentStopMode === 'departing') {
        // Preferred: passenger destination, or last stop on route
        defaultTarget = (window.passenger ? window.passenger.selectedDestId : null) || 
          route.stops[route.stops.length - 1].id;
      } else {
        // Preferred: passenger boarding stop, or stop #2
        defaultTarget = (window.passenger ? window.passenger.selectedStopId : null) || 
          route.stops[Math.min(1, route.stops.length - 1)].id;
      }
    }

    stopSelect.innerHTML = route.stops.map(s => `
      <option value="${s.id}" ${s.id === defaultTarget ? 'selected' : ''}>
        Stop #${s.sequence}: ${s.name}
      </option>
    `).join('');
  }

  onTargetStopChanged() {
    // Optional change handler
  }

  /**
   * Updates placeholder & helper text based on selected trigger type
   */
  updateTriggerUnitLabel() {
    const typeSelect = document.getElementById('alarmTriggerType');
    const valInput = document.getElementById('alarmTriggerValue');
    const unitBadge = document.getElementById('alarmTriggerUnit');
    const helpText = document.getElementById('alarmTriggerHelp');
    if (!typeSelect || !valInput) return;

    const type = typeSelect.value;
    if (type === 'distance') {
      if (unitBadge) unitBadge.textContent = 'Meters';
      if (helpText) helpText.textContent = 'Recommended: 300m - 1000m (e.g., 500 meters away).';
      if (valInput.value === '1' || valInput.value === '2' || valInput.value === '5') valInput.value = 500;
    } else if (type === 'stops') {
      if (unitBadge) unitBadge.textContent = 'Stops Before';
      if (helpText) helpText.textContent = 'Alarms when bus is 1, 2, or 3 stops away from your stop.';
      if (valInput.value === '500' || valInput.value === '1000') valInput.value = 2;
    } else if (type === 'eta') {
      if (unitBadge) unitBadge.textContent = 'Minutes ETA';
      if (helpText) helpText.textContent = 'Alarms when estimated arrival time is within this many minutes.';
      if (valInput.value === '500' || valInput.value === '2') valInput.value = 5;
    }
  }

  /**
   * Sets and activates the alarm
   */
  setAlarm(e) {
    if (e) e.preventDefault();

    const busSelect = document.getElementById('alarmBusSelect');
    const stopSelect = document.getElementById('alarmStopSelect');
    const typeSelect = document.getElementById('alarmTriggerType');
    const valInput = document.getElementById('alarmTriggerValue');
    const soundCheck = document.getElementById('alarmSoundCheck');
    const pushCheck = document.getElementById('alarmPushCheck');
    const vibrateCheck = document.getElementById('alarmVibrateCheck');
    const departingCheck = document.getElementById('alarmDepartingCheck');

    if (!busSelect || !stopSelect || !typeSelect || !valInput) return;

    const busId = busSelect.value;
    const stopId = stopSelect.value;
    const triggerType = typeSelect.value;
    const triggerValue = parseFloat(valInput.value) || 500;

    const bus = window.appState.getBusById(busId);
    if (!bus) {
      window.app.showToast('Please select a valid bus.', 'error');
      return;
    }

    const route = window.appState.getRouteById(bus.routeId);
    const stop = route ? route.stops.find(s => s.id === stopId) : null;
    if (!stop) {
      window.app.showToast('Please select a valid target stop.', 'error');
      return;
    }

    this.activeAlarm = {
      active: true,
      busId,
      busNumber: bus.busNumber,
      stopId,
      stopName: stop.name,
      stopMode: this.currentStopMode, // 'boarding' or 'departing'
      routeId: bus.routeId,
      triggerType,
      triggerValue,
      soundEnabled: soundCheck ? soundCheck.checked : true,
      pushEnabled: pushCheck ? pushCheck.checked : true,
      vibrateEnabled: vibrateCheck ? vibrateCheck.checked : true,
      notifyDeparted: departingCheck ? departingCheck.checked : true,
      notifiedDepartures: [],
      isTriggered: false,
      createdAt: new Date().toISOString()
    };

    this.lastObservedStopId = bus.currentStopId;

    // Save to localStorage
    try {
      localStorage.setItem('citybus_proximity_alarm', JSON.stringify(this.activeAlarm));
    } catch (e) {}

    this.closeAlarmModal();
    this.renderFloatingWidget();

    // Unlock AudioContext via user gesture
    this.getAudioContext();

    const modeText = this.currentStopMode === 'departing' ? 'Departing / Drop-off' : 'Boarding';
    window.app.showToast(
      `🔔 Alarm Active: We will alert you when BUS ${bus.busNumber} is near ${stop.name} (${modeText} stop)!`,
      'success'
    );

    // Initial check
    this.checkProximity(bus);
  }

  /**
   * Cancels any active alarm
   */
  cancelAlarm() {
    this.stopLoopingAlarm();
    this.activeAlarm = null;
    try {
      localStorage.removeItem('citybus_proximity_alarm');
    } catch (e) {}

    this.renderFloatingWidget();
    if (window.app && window.app.showToast) {
      window.app.showToast('Proximity Alarm cancelled.', 'info');
    }
  }

  /**
   * Called on state changes or live GPS updates
   */
  onStateUpdated(state, event) {
    if (!this.activeAlarm || !this.activeAlarm.active) {
      return;
    }

    const bus = window.appState.getBusById(this.activeAlarm.busId);
    if (!bus) return;

    this.checkProximity(bus);
    this.renderFloatingWidget();
  }

  /**
   * Calculates proximity and tests trigger criteria (Approaching + Departing)
   */
  checkProximity(bus) {
    if (!this.activeAlarm || !this.activeAlarm.active || this.activeAlarm.isTriggered) {
      return;
    }

    const route = window.appState.getRouteById(bus.routeId);
    if (!route || !route.stops) return;

    const targetStop = route.stops.find(s => s.id === this.activeAlarm.stopId);
    if (!targetStop) return;

    const targetStopIdx = route.stops.findIndex(s => s.id === targetStop.id);

    // 1. Check for Stop Departure Alert (e.g. Bus just departed previous stop)
    if (this.activeAlarm.notifyDeparted && bus.currentStopId && bus.currentStopId !== this.lastObservedStopId) {
      const prevStop = route.stops.find(s => s.id === this.lastObservedStopId);
      const prevStopIdx = prevStop ? route.stops.findIndex(s => s.id === prevStop.id) : -1;

      if (prevStop && prevStopIdx < targetStopIdx) {
        if (!this.activeAlarm.notifiedDepartures.includes(prevStop.id)) {
          this.activeAlarm.notifiedDepartures.push(prevStop.id);

          // Play brisk departure chime
          if (this.activeAlarm.soundEnabled) {
            this.playDepartureChime();
          }

          // Show departure toast & push notification
          const depMsg = `BUS ${bus.busNumber} has departed ${prevStop.name} and is en route to ${targetStop.name}!`;
          if (window.app && window.app.showToast) {
            window.app.showToast(`🚀 ${depMsg}`, 'info');
          }
          if (this.activeAlarm.pushEnabled) {
            this.showNotification(`🚀 Bus Departed ${prevStop.name}`, depMsg);
          }
        }
      }
      this.lastObservedStopId = bus.currentStopId;
    }

    // 2. Distance in meters to target stop
    const distMeters = window.GeoEngine.getDistanceMeters(bus.lat, bus.lng, targetStop.lat, targetStop.lng);

    // 3. Remaining stops on route sequence
    let currentStopIdx = -1;
    if (bus.currentStopId) {
      currentStopIdx = route.stops.findIndex(s => s.id === bus.currentStopId);
    }

    let remainingStops = 0;
    if (currentStopIdx !== -1 && targetStopIdx !== -1) {
      remainingStops = Math.max(0, targetStopIdx - currentStopIdx);
    } else {
      let minD = Infinity;
      let closestIdx = 0;
      route.stops.forEach((s, idx) => {
        const d = window.GeoEngine.getDistanceMeters(bus.lat, bus.lng, s.lat, s.lng);
        if (d < minD) {
          minD = d;
          closestIdx = idx;
        }
      });
      remainingStops = Math.max(0, targetStopIdx - closestIdx);
    }

    // 4. ETA in minutes
    const etaObj = window.GeoEngine.calculateETA(bus.lat, bus.lng, bus.speed || 25, targetStop);
    const etaMinutes = etaObj ? etaObj.minutes : Math.ceil(distMeters / 450);

    // Cache metrics for UI
    this.activeAlarm.currentDistanceMeters = Math.round(distMeters);
    this.activeAlarm.remainingStops = remainingStops;
    this.activeAlarm.currentEtaMinutes = etaMinutes;

    // Evaluate trigger condition
    let shouldTrigger = false;
    const val = this.activeAlarm.triggerValue;

    if (this.activeAlarm.triggerType === 'distance') {
      if (distMeters <= val) {
        shouldTrigger = true;
      }
    } else if (this.activeAlarm.triggerType === 'stops') {
      if (remainingStops <= val) {
        shouldTrigger = true;
      }
    } else if (this.activeAlarm.triggerType === 'eta') {
      if (etaMinutes <= val) {
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      this.triggerAlarm(bus, targetStop, { distMeters, remainingStops, etaMinutes });
    }
  }

  /**
   * Fires the alarm!
   */
  triggerAlarm(bus, targetStop, metrics) {
    this.activeAlarm.isTriggered = true;

    // 1. Notification sound chime loop
    if (this.activeAlarm.soundEnabled) {
      this.startLoopingAlarm();
    }

    // 2. Vibration
    if (this.activeAlarm.vibrateEnabled) {
      this.vibrate();
    }

    // 3. Browser Push Notification
    if (this.activeAlarm.pushEnabled) {
      const isDepartingMode = this.activeAlarm.stopMode === 'departing';
      const title = isDepartingMode 
        ? `🛑 Departing Stop Approaching: ${targetStop.name}!` 
        : `🚨 BUS ${bus.busNumber} Approaching!`;
      const body = isDepartingMode
        ? `BUS ${bus.busNumber} is within ${Math.round(metrics.distMeters)}m of your drop-off stop (${targetStop.name}). Get ready to alight!`
        : `BUS ${bus.busNumber} is within ${Math.round(metrics.distMeters)}m of ${targetStop.name} (ETA: ${metrics.etaMinutes} min). Time to board!`;

      this.showNotification(title, body);
    }

    // 4. Open Triggered Wake-Up Screen
    this.showTriggeredModal(bus, targetStop, metrics);
    this.renderFloatingWidget();
  }

  /**
   * Shows high-priority Wake Up Alert Modal
   */
  showTriggeredModal(bus, targetStop, metrics) {
    const modal = document.getElementById('proximityAlarmTriggeredModal');
    if (!modal) return;

    const busTitle = document.getElementById('triggeredAlarmBusTitle');
    const stopTitle = document.getElementById('triggeredAlarmStopTitle');
    const badge = document.getElementById('triggeredAlarmCategoryBadge');
    const desc = document.getElementById('triggeredAlarmDesc');
    const distanceVal = document.getElementById('triggeredAlarmDistanceVal');
    const etaVal = document.getElementById('triggeredAlarmEtaVal');
    const stopsVal = document.getElementById('triggeredAlarmStopsVal');

    const isDepartingMode = this.activeAlarm && this.activeAlarm.stopMode === 'departing';

    if (badge) {
      badge.textContent = isDepartingMode ? '🛬 Departing Stop Approaching!' : '🔔 Bus Approaching Boarding Stop!';
    }
    if (busTitle) busTitle.textContent = `BUS ${bus.busNumber}`;
    if (stopTitle) stopTitle.textContent = targetStop.name;
    if (desc) {
      desc.innerHTML = isDepartingMode
        ? `is arriving at your destination stop: <strong style="color: #0f172a;">${targetStop.name}</strong>! Please prepare to alight.`
        : `is approaching <strong style="color: #0f172a;">${targetStop.name}</strong>! Get ready to board.`;
    }
    if (distanceVal) distanceVal.textContent = `${Math.round(metrics.distMeters)} meters`;
    if (etaVal) etaVal.textContent = `~${metrics.etaMinutes} min`;
    if (stopsVal) stopsVal.textContent = `${metrics.remainingStops} stop${metrics.remainingStops === 1 ? '' : 's'}`;

    modal.classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Dismiss the ringing alarm
   */
  dismissTriggeredAlarm() {
    this.stopLoopingAlarm();
    const modal = document.getElementById('proximityAlarmTriggeredModal');
    if (modal) modal.classList.remove('active');

    if (this.activeAlarm) {
      this.activeAlarm.active = false;
      try {
        localStorage.removeItem('citybus_proximity_alarm');
      } catch (e) {}
    }
    this.renderFloatingWidget();

    if (window.app && window.app.showToast) {
      window.app.showToast('Alarm dismissed. Have a safe journey!', 'success');
    }
  }

  /**
   * Navigates to Where Is My Bus to track the bus right now
   */
  viewBusFromAlarm() {
    this.dismissTriggeredAlarm();
    if (this.activeAlarm && this.activeAlarm.busId) {
      if (window.passenger) {
        window.passenger.trackSelectedBus(this.activeAlarm.busId);
      }
    }
  }

  /**
   * Renders the persistent floating proximity countdown badge
   */
  renderFloatingWidget() {
    let widget = document.getElementById('activeProximityAlarmWidget');
    if (!widget) return;

    if (!this.activeAlarm || !this.activeAlarm.active) {
      widget.style.display = 'none';
      return;
    }

    widget.style.display = 'flex';

    const bus = window.appState ? window.appState.getBusById(this.activeAlarm.busId) : null;
    const isOffline = bus ? !bus.isTripActive && bus.status === 'Offline' : true;

    const busNum = this.activeAlarm.busNumber || 'Bus';
    const stopName = this.activeAlarm.stopName || 'Your Stop';
    const modeBadge = this.activeAlarm.stopMode === 'departing' 
      ? '<span style="background: rgba(239, 68, 68, 0.25); color: #fca5a5; padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-weight:700;">🛬 Drop-off</span>' 
      : '<span style="background: rgba(34, 197, 94, 0.25); color: #86efac; padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-weight:700;">🛫 Pickup</span>';

    const distText = this.activeAlarm.currentDistanceMeters 
      ? `${this.activeAlarm.currentDistanceMeters}m away` 
      : 'Monitoring GPS...';
    const etaText = this.activeAlarm.currentEtaMinutes 
      ? `ETA: ~${this.activeAlarm.currentEtaMinutes}m` 
      : '';
    const stopsText = this.activeAlarm.remainingStops !== undefined 
      ? `${this.activeAlarm.remainingStops} stops away` 
      : '';

    let triggerCondText = '';
    if (this.activeAlarm.triggerType === 'distance') {
      triggerCondText = `Triggers < ${this.activeAlarm.triggerValue}m`;
    } else if (this.activeAlarm.triggerType === 'stops') {
      triggerCondText = `Triggers < ${this.activeAlarm.triggerValue} stops`;
    } else {
      triggerCondText = `Triggers < ${this.activeAlarm.triggerValue} min`;
    }

    widget.innerHTML = `
      <div class="alarm-widget-content">
        <div class="alarm-bell-pulsing">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
          </svg>
        </div>
        <div class="alarm-widget-info">
          <div class="alarm-widget-title">
            <strong>BUS ${busNum}</strong>
            <span class="alarm-stop-badge">→ ${stopName}</span>
            ${modeBadge}
          </div>
          <div class="alarm-widget-countdown">
            ${isOffline ? '<span style="color:#ef4444;font-weight:600;">Bus is currently Offline</span>' : `
              <span class="alarm-metric"><strong>${distText}</strong></span>
              <span class="alarm-separator">•</span>
              <span class="alarm-metric">${stopsText}</span>
              <span class="alarm-separator">•</span>
              <span class="alarm-metric" style="color: #10b981; font-weight:700;">${etaText}</span>
            `}
            <span class="alarm-target-pill">${triggerCondText}</span>
          </div>
        </div>
      </div>
      <div class="alarm-widget-actions">
        <button class="btn btn-xs btn-outline" style="border-color: rgba(255,255,255,0.4); color: white;" onclick="window.proximityAlarm.openAlarmModal('${this.activeAlarm.busId}', '${this.activeAlarm.stopId}')" title="Configure Alarm">
          Edit
        </button>
        <button class="btn btn-xs btn-danger" onclick="window.proximityAlarm.cancelAlarm()" title="Cancel Alarm">
          Cancel
        </button>
      </div>
    `;
  }
}

// Global singleton instance
window.proximityAlarm = new ProximityAlarmController();
document.addEventListener('DOMContentLoaded', () => {
  if (window.proximityAlarm) {
    window.proximityAlarm.init();
  }
});
