/**
 * WhereIsMyBusController: The "Where Is My Train"-Style Live Tracking & Journey Experience
 */
class WhereIsMyBusController {
  constructor() {
    this.mapManager = null;
    this.currentBusId = null;
    this.isFollowing = true;
    this.freshnessInterval = null;

    // Subscribe to state updates (GPS polling, BroadcastChannel, and fleet updates)
    window.appState.subscribe((state, event) => {
      this.populateBusSelector();
      this.syncLiveBusPositions();
      this.render();
    });
  }

  init() {
    if (!this.mapManager) {
      this.mapManager = new MapManager('wimbMap', { zoom: 13 });
    }

    if ((!this.currentBusId || !window.appState.getBusById(this.currentBusId)) && window.appState.buses.length > 0) {
      this.currentBusId = window.appState.buses[0].id;
    }

    this.populateBusSelector();
    if (this.currentBusId || window.appState.selectedBusId) {
      this.loadBus(window.appState.selectedBusId || this.currentBusId);
    }

    // Ensure map container renders properly after DOM display transitions
    setTimeout(() => {
      if (this.mapManager) {
        this.mapManager.invalidateSize();
      }
    }, 200);

    // Freshness timer tick
    if (this.freshnessInterval) clearInterval(this.freshnessInterval);
    this.freshnessInterval = setInterval(() => this.updateFreshnessTimer(), 2000);
  }

  populateBusSelector() {
    const select = document.getElementById('wimbBusSelector');
    if (!select) return;

    select.innerHTML = window.appState.buses.map((b) => `
      <option value="${b.id}" ${b.id === this.currentBusId ? 'selected' : ''}>
        BUS ${b.busNumber} (${b.regNumber})
      </option>
    `).join('');
  }

  onBusSelected(busId) {
    this.loadBus(busId);
  }

  loadBus(busId) {
    this.currentBusId = busId;
    window.appState.selectedBusId = busId;
    
    const bus = window.appState.getBusById(busId);
    if (!bus) return;

    const route = window.appState.getRouteById(bus.routeId);
    if (!route) return;

    // Update Top HUD
    const numBadge = document.getElementById('wimbBusNumberBadge');
    const routeTitle = document.getElementById('wimbBusRouteTitle');
    const busReg = document.getElementById('wimbBusReg');
    const busSelector = document.getElementById('wimbBusSelector');

    // Check passenger gender mode for Vetri Payanam Scheme
    const currentGender = localStorage.getItem('citybus_passenger_gender') || 'male';
    const vpBanner = document.getElementById('wimbVetriPayanamBanner');
    const vpTextElem = document.getElementById('wimbVetriPayanamText');
    if (vpBanner) {
      if (currentGender === 'female' && bus.isVetriPayanam) {
        vpBanner.style.display = 'flex';
        const bannerMsg = window.I18n ? window.I18n.t('wimbVetriBanner') : 'Vetri Payanam Scheme Bus — Free Travel for Women Passengers';
        if (vpTextElem) {
          vpTextElem.textContent = bannerMsg;
        } else {
          vpBanner.textContent = bannerMsg;
        }
      } else {
        vpBanner.style.display = 'none';
      }
    }

    if (numBadge) numBadge.textContent = `BUS ${bus.busNumber}`;
    if (routeTitle) routeTitle.textContent = window.I18n ? window.I18n.getRouteName(route.name) : route.name;
    if (busReg) {
      const vpText = (currentGender === 'female' && bus.isVetriPayanam) ? (window.I18n ? ' ' + window.I18n.t('wimbVetriSubtitle') : ' • Vetri Payanam: Free for Women') : '';
      const crowdLabel = window.I18n ? window.I18n.t('crowd' + (bus.crowdLevel || 'Moderate'), bus.crowdLevel || 'Moderate') : (bus.crowdLevel || 'Moderate');
      const crowdWord = window.I18n ? window.I18n.t('crowd') : 'Crowd';
      if (bus.isTripActive) {
        busReg.textContent = `Reg: ${bus.regNumber} • Bus: ${bus.BusName || bus.busNumber} • ${crowdWord}: ${crowdLabel}${vpText}`;
      } else {
        busReg.textContent = `Reg: ${bus.regNumber} • Bus: ${bus.BusName || bus.busNumber}${vpText}`;
      }
    }
    if (busSelector) busSelector.value = busId;

    const wimbLiveContent = document.getElementById('wimbLiveContent');
    const wimbOfflineMessage = document.getElementById('wimbOfflineMessage');
    const wimbHudStats = document.getElementById('wimbHudStats');

    if (wimbLiveContent && wimbOfflineMessage) {
      if (bus.isTripActive) {
        wimbLiveContent.style.display = 'grid';
        wimbOfflineMessage.style.display = 'none';
        if (wimbHudStats) wimbHudStats.style.display = 'flex';
      } else {
        wimbLiveContent.style.display = 'none';
        wimbOfflineMessage.style.display = 'block';
        if (wimbHudStats) wimbHudStats.style.display = 'none';
      }
    }

    // Render Map Route & Stops
    if (this.mapManager) {
      const activeBusesOnRoute = window.appState.getBusesForRoute(route.id);
      this.mapManager.clearStops();
      this.mapManager.renderRouteStops(route, activeBusesOnRoute);
      this.mapManager.updateBusMarker(bus, true, true);
      
      if (this.isFollowing) {
        this.mapManager.setFollowBus(bus.id);
        this.mapManager.centerOnLocation(bus.lat, bus.lng, 14);
      } else {
        this.mapManager.fitBoundsToRoute(route);
      }
      this.mapManager.invalidateSize();
      setTimeout(() => {
        if (this.mapManager) this.mapManager.invalidateSize();
      }, 200);
    }

    this.render();
  }

  toggleFollowBus() {
    this.isFollowing = !this.isFollowing;
    const btnText = document.getElementById('followBusBtnText');
    const btn = document.getElementById('btnFollowBus');

    if (this.isFollowing) {
      if (btnText) btnText.textContent = window.I18n && window.I18n.getLanguage() === 'ta' ? 'பின்தொடர்கிறது' : 'Following Bus';
      if (btn) {
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');
      }
      if (this.mapManager) {
        this.mapManager.setFollowBus(this.currentBusId);
        const bus = window.appState.getBusById(this.currentBusId);
        if (bus) this.mapManager.centerOnLocation(bus.lat, bus.lng, 15);
      }
    } else {
      if (btnText) btnText.textContent = window.I18n ? window.I18n.t('wimbFollowBus') : 'Follow Bus';
      if (btn) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
      }
      if (this.mapManager) {
        this.mapManager.setFollowBus(null);
      }
    }
  }

  fitFullRoute() {
    this.isFollowing = false;
    const btnText = document.getElementById('followBusBtnText');
    const btn = document.getElementById('btnFollowBus');
    if (btnText) btnText.textContent = window.I18n ? window.I18n.t('wimbFollowBus') : 'Follow Bus';
    if (btn) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline');
    }

    const bus = window.appState.getBusById(this.currentBusId);
    if (bus) {
      const route = window.appState.getRouteById(bus.routeId);
      if (this.mapManager && route) {
        this.mapManager.fitBoundsToRoute(route);
      }
    }
  }

  centerOnBus() {
    const bus = window.appState.getBusById(this.currentBusId);
    if (bus && this.mapManager) {
      this.mapManager.centerOnLocation(bus.lat, bus.lng, 15);
    }
  }

  zoomIn() {
    if (this.mapManager && this.mapManager.map) this.mapManager.map.zoomIn();
  }

  zoomOut() {
    if (this.mapManager && this.mapManager.map) this.mapManager.map.zoomOut();
  }

  /**
   * Synchronizes moving bus positions directly on the Leaflet map
   */
  syncLiveBusPositions() {
    if (!this.mapManager) return;

    const bus = window.appState.getBusById(this.currentBusId);
    if (!bus) return;

    // Update the tracked bus marker on map with highlight/Rank 1 styling
    this.mapManager.updateBusMarker(bus, true, true);

    // Also update any other active buses on this same route
    const route = window.appState.getRouteById(bus.routeId);
    if (route) {
      const activeBusesOnRoute = window.appState.getBusesForRoute(route.id);
      activeBusesOnRoute.forEach((otherBus) => {
        if (otherBus.id !== bus.id) {
          this.mapManager.updateBusMarker(otherBus, false, false);
        }
      });
    }

    // Follow bus camera panning if enabled
    if (this.isFollowing && bus.lat != null && bus.lng != null && bus.isTripActive) {
      this.mapManager.setFollowBus(bus.id);
    }
  }

  renderBusUpdate(bus) {
    this.syncLiveBusPositions();
    this.render();
  }

  render() {
    const bus = window.appState.getBusById(this.currentBusId);
    if (!bus) return;

    const route = window.appState.getRouteById(bus.routeId);
    if (!route) return;

    // Dynamically toggle online/offline state
    const wimbLiveContent = document.getElementById('wimbLiveContent');
    const wimbOfflineMessage = document.getElementById('wimbOfflineMessage');
    const wimbHudStats = document.getElementById('wimbHudStats');

    if (wimbLiveContent && wimbOfflineMessage) {
      if (bus.isTripActive) {
        wimbLiveContent.style.display = 'grid';
        wimbOfflineMessage.style.display = 'none';
        if (wimbHudStats) wimbHudStats.style.display = 'flex';
      } else {
        wimbLiveContent.style.display = 'none';
        wimbOfflineMessage.style.display = 'block';
        if (wimbHudStats) wimbHudStats.style.display = 'none';
      }
    }

    // Always ensure live map marker is synced
    if (this.mapManager) {
      this.syncLiveBusPositions();
    }

    // Update Telemetry Badges
    const liveStatus = document.getElementById('wimbLiveStatus');
    const liveSpeed = document.getElementById('wimbLiveSpeed');
    const nextStop = document.getElementById('wimbNextStop');
    const nextEta = document.getElementById('wimbNextEta');
    const liveCrowd = document.getElementById('wimbLiveCrowd');
    const bearingTip = document.getElementById('wimbMapBearingTip');
    const smartCrowdBox = document.getElementById('wimbSmartCrowdAlert');

    if (liveStatus) {
      if (!bus.isTripActive) {
        liveStatus.className = 'hud-value status-pill red';
        liveStatus.textContent = window.I18n ? window.I18n.t('wimbStatusOffline') : '🔴 Trip Ended (GPS Off)';
      } else {
        const isRunning = bus.status === 'Running';
        liveStatus.className = `hud-value status-pill ${isRunning ? 'green' : (bus.status === 'Stopped' ? 'amber' : 'red')}`;
        liveStatus.textContent = isRunning
          ? (window.I18n ? window.I18n.t('wimbStatusRunning') : '🟢 Running')
          : (bus.status === 'Stopped' ? (window.I18n ? window.I18n.t('wimbStatusStopped') : '🟡 Stopped') : `🟡 ${bus.status}`);
      }
    }

    const currentCrowd = bus.crowdLevel || 'Moderate';
    if (liveCrowd) {
      const crowdClass = currentCrowd.toLowerCase();
      const crowdLabel = window.I18n ? window.I18n.t('crowd' + currentCrowd, currentCrowd) : currentCrowd;
      const crowdWord = window.I18n ? window.I18n.t('crowd') : 'Crowd';
      liveCrowd.innerHTML = `
        <span class="crowd-pill ${crowdClass}">
          <span class="dot" style="background: currentColor;"></span> ${crowdLabel} ${crowdWord}
        </span>
      `;
    }

    // Smart Low-Crowd Alternative Recommendation for Same Route
    if (smartCrowdBox) {
      const routeBuses = window.appState.getBusesForRoute(bus.routeId).filter((b) => b.id !== bus.id && b.status === 'Running');
      const lowCrowdAlt = routeBuses.find((b) => (b.crowdLevel || 'Moderate').toLowerCase() === 'low');

      if (lowCrowdAlt && currentCrowd.toLowerCase() !== 'low') {
        smartCrowdBox.innerHTML = `
          <div class="smart-crowd-alert" style="margin-bottom: 1rem;">
            <div class="smart-crowd-alert-left">
              <div class="smart-crowd-badge-icon">
                <i data-lucide="sparkles"></i>
              </div>
              <div>
                <div class="smart-crowd-title">
                  <span>Smart Alternative: BUS ${lowCrowdAlt.busNumber} has Low Crowd!</span>
                </div>
                <div class="smart-crowd-desc">
                  This current bus (${bus.busNumber}) is <strong>${currentCrowd}</strong>. <strong>BUS ${lowCrowdAlt.busNumber}</strong> on this same route is <strong>🟢 Low Crowd (Seats Available)</strong> — Next stop in ${lowCrowdAlt.etaMinutes || 3} min.
                </div>
              </div>
            </div>
            <button class="smart-crowd-btn" onclick="wimb.loadBus('${lowCrowdAlt.id}')">
              <i data-lucide="refresh-cw"></i> Switch to BUS ${lowCrowdAlt.busNumber}
            </button>
          </div>
        `;
      } else {
        smartCrowdBox.innerHTML = '';
      }
    }

    if (liveSpeed) liveSpeed.textContent = `${bus.speed || 0} km/h`;
    if (nextStop) nextStop.textContent = bus.nextStopName ? (window.I18n ? window.I18n.getStopName(bus.nextStopName) : bus.nextStopName) : 'N/A';
    if (nextEta) {
      const isArrivingNext = bus.etaMinutes <= 1 || (bus.distanceToNextKm != null && bus.distanceToNextKm <= 0.45);
      const arrivingNowText = window.I18n && window.I18n.getLanguage() === 'ta' ? 'இப்போது வந்தடைகிறது ⚡' : 'Arriving Now ⚡';
      const minText = window.I18n && window.I18n.getLanguage() === 'ta' ? 'நிமிடம்' : 'min';
      if (isArrivingNext && bus.isTripActive) {
        nextEta.innerHTML = `<span style="color: #2563eb; font-weight: 800;">${arrivingNowText}</span> (${bus.distanceToNextKm || 0} km)`;
      } else {
        nextEta.textContent = `${bus.etaMinutes || 0} ${minText} (${bus.distanceToNextKm || 0} km)`;
      }
    }
    if (bearingTip) bearingTip.textContent = `Heading: ${Math.round(bus.bearing || 0)}° • Speed: ${bus.speed || 0} km/h • Crowd: ${currentCrowd}`;

    // Progress Bar
    const progressFill = document.getElementById('wimbProgressBarFill');
    const progressPct = document.getElementById('wimbProgressPct');
    const pct = Math.round(bus.routeProgress || 0);
    const completeText = window.I18n && window.I18n.getLanguage() === 'ta' ? 'முடிந்தது' : 'Complete';
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressPct) progressPct.textContent = `${pct}% ${completeText}`;

    // Render Vertical Timeline ("Where Is My Train" Style)
    this.renderTimeline(route, bus);
    this.renderEtaTable(route, bus);
    this.updateFreshnessTimer();

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  renderTimeline(route, bus) {
    const container = document.getElementById('wimbStopsTimeline');
    if (!container) return;

    const reachedStopIds = Array.isArray(bus.reachedStopIds) ? [...bus.reachedStopIds] : [];

    // Instant physical proximity check: if bus enters within geofence, register reached at that exact second
    route.stops.forEach((stop) => {
      const dMeters = GeoEngine.getDistanceMeters(bus.lat, bus.lng, stop.lat, stop.lng);
      if (dMeters <= GeoEngine.GEOFENCE_RADIUS_METERS) {
        if (!reachedStopIds.includes(stop.id)) {
          reachedStopIds.push(stop.id);
          if (Array.isArray(bus.reachedStopIds) && !bus.reachedStopIds.includes(stop.id)) {
            bus.reachedStopIds.push(stop.id);
          }
        }
      }
    });

    let currentStopIdx = -1;
    for (let i = route.stops.length - 1; i >= 0; i--) {
      if (reachedStopIds.includes(route.stops[i].id)) {
        currentStopIdx = i;
        break;
      }
    }

    // Determine upcoming target stop index
    let targetStopIdx = route.stops.findIndex((s) => !reachedStopIds.includes(s.id));
    if (targetStopIdx === -1 && route.stops.length > 0) {
      targetStopIdx = route.stops.length - 1; // Destination reached
    }

    const htmlParts = [];

    route.stops.forEach((stop, index) => {
      const distMeters = GeoEngine.getDistanceMeters(bus.lat, bus.lng, stop.lat, stop.lng);
      const isPhysicallyReached = distMeters <= GeoEngine.GEOFENCE_RADIUS_METERS;
      const isReached = reachedStopIds.includes(stop.id) || (currentStopIdx !== -1 && index <= currentStopIdx) || isPhysicallyReached;
      const isNextTarget = (index === targetStopIdx);

      // Distance and ETA to this stop
      const etaObj = GeoEngine.calculateETA(bus.lat, bus.lng, bus.speed, stop, Math.max(0, index - (currentStopIdx !== -1 ? currentStopIdx : 0)));
      const distKm = Math.round(GeoEngine.getDistanceKm(bus.lat, bus.lng, stop.lat, stop.lng) * 10) / 10;
      const isArriving = isNextTarget && !isReached && (etaObj.isArriving || distMeters <= GeoEngine.APPROACHING_RADIUS_METERS || distKm <= 0.45);

      // "Where Is My Train" Style Live Bus Indicator on Route Track:
      // Insert directly on the track approaching the target stop
      const stopName = window.I18n ? window.I18n.getStopName(stop.name) : stop.name;

      if (isNextTarget && bus.isTripActive && !isPhysicallyReached) {
        const badgeDistText = isArriving
          ? (window.I18n && window.I18n.getLanguage() === 'ta' ? '⚡ இப்போது வந்தடைகிறது' : '⚡ Arriving Now')
          : `${distKm} km to ${stopName}`;
        htmlParts.push(`
          <div class="timeline-in-transit-row">
            <div class="transit-track-col">
              <div class="transit-track-line-top"></div>
              <div class="transit-bus-beacon" title="BUS ${bus.busNumber} • ${bus.speed || 0} km/h">
                <i data-lucide="bus"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg></i>
              </div>
              <div class="transit-track-line-bottom"></div>
            </div>
            <div class="transit-pill-col">
              <div class="transit-live-badge">
                <span class="live-pulse-dot"></span>
                <span class="badge-bus-num">BUS ${bus.busNumber}</span>
                <span class="badge-sep">•</span>
                <span class="badge-speed">${bus.speed || 0} km/h</span>
                <span class="badge-sep">•</span>
                <span class="badge-dist">${badgeDistText}</span>
              </div>
            </div>
          </div>
        `);
      }

      let nodeClass = 'stop-timeline-node';
      if (isReached) nodeClass += ' reached';
      if (isNextTarget) nodeClass += ' next-target';

      let indicatorContent = stop.sequence;
      if (isReached) {
        indicatorContent = '<i data-lucide="check" style="width: 18px; height: 18px; stroke-width: 3;"></i>';
      } else if (isNextTarget) {
        indicatorContent = '<i data-lucide="map-pin" style="width: 18px; height: 18px;"></i>';
      }

      let badgeHtml = '';
      if (isReached) {
        const reachedText = window.I18n && window.I18n.getLanguage() === 'ta' ? 'அடைந்தது ✅' : 'Reached ✅';
        badgeHtml = `<span class="stop-eta-badge reached">${reachedText}</span>`;
      } else if (isArriving) {
        const arrivingText = window.I18n && window.I18n.getLanguage() === 'ta' ? '⚡ இப்போது வந்தடைகிறது' : '⚡ Arriving Now';
        badgeHtml = `<span class="stop-eta-badge arriving">${arrivingText}</span>`;
      } else {
        badgeHtml = `<span class="stop-eta-badge upcoming">${etaObj.text}</span>`;
      }

      const stopLabel = window.I18n && window.I18n.getLanguage() === 'ta' ? 'நிறுத்தம்' : 'Stop';
      const kmAwayText = window.I18n && window.I18n.getLanguage() === 'ta' ? 'கி.மீ தொலைவில்' : 'km away';
      const nextApproachingText = window.I18n ? window.I18n.t('wimbNextApproaching') : 'Next Approaching Stop';

      htmlParts.push(`
        <div class="${nodeClass}">
          <div class="stop-indicator-circle">
            ${indicatorContent}
          </div>
          <div class="stop-details-col">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div class="stop-node-title">${stopName}</div>
              ${badgeHtml}
            </div>
            <div class="stop-node-meta">
              <span>${stopLabel} #${stop.sequence}</span>
              ${!isReached ? `<span>• ${distKm} ${kmAwayText}</span>` : ''}
              ${isNextTarget ? `<span style="color: #2563eb; font-weight: 700;">• ${nextApproachingText}</span>` : ''}
            </div>
          </div>
        </div>
      `);
    });

    container.innerHTML = htmlParts.join('');

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  renderEtaTable(route, bus) {
    const tbody = document.getElementById('wimbEtaTableBody');
    if (!tbody) return;

    const reachedStopIds = Array.isArray(bus.reachedStopIds) ? [...bus.reachedStopIds] : [];

    // Instant physical proximity check: if bus enters within geofence, register reached at that exact second
    route.stops.forEach((stop) => {
      const dMeters = GeoEngine.getDistanceMeters(bus.lat, bus.lng, stop.lat, stop.lng);
      if (dMeters <= GeoEngine.GEOFENCE_RADIUS_METERS) {
        if (!reachedStopIds.includes(stop.id)) {
          reachedStopIds.push(stop.id);
          if (Array.isArray(bus.reachedStopIds) && !bus.reachedStopIds.includes(stop.id)) {
            bus.reachedStopIds.push(stop.id);
          }
        }
      }
    });

    let currentStopIdx = -1;
    for (let i = route.stops.length - 1; i >= 0; i--) {
      if (reachedStopIds.includes(route.stops[i].id)) {
        currentStopIdx = i;
        break;
      }
    }

    // Determine upcoming target stop index
    let targetStopIdx = route.stops.findIndex((s) => !reachedStopIds.includes(s.id));
    if (targetStopIdx === -1 && route.stops.length > 0) {
      targetStopIdx = route.stops.length - 1;
    }

    tbody.innerHTML = route.stops.map((stop, index) => {
      const distMeters = GeoEngine.getDistanceMeters(bus.lat, bus.lng, stop.lat, stop.lng);
      const isPhysicallyReached = distMeters <= GeoEngine.GEOFENCE_RADIUS_METERS;
      const isReached = reachedStopIds.includes(stop.id) || (currentStopIdx !== -1 && index <= currentStopIdx) || isPhysicallyReached;

      const etaObj = GeoEngine.calculateETA(bus.lat, bus.lng, bus.speed, stop, Math.max(0, index - (currentStopIdx !== -1 ? currentStopIdx : 0)));
      const distKm = Math.round(GeoEngine.getDistanceKm(bus.lat, bus.lng, stop.lat, stop.lng) * 10) / 10;
      
      const isTarget = (index === targetStopIdx);
      const isArriving = !isReached && isTarget && (etaObj.isArriving || distMeters <= GeoEngine.APPROACHING_RADIUS_METERS || distKm <= 0.45);

      const stopName = window.I18n ? window.I18n.getStopName(stop.name) : stop.name;

      // Status Column
      let statusHtml = '';
      if (isReached) {
        const text = window.I18n && window.I18n.getLanguage() === 'ta' ? '✅ அடைந்தது' : '✅ Reached';
        statusHtml = `<span class="status-pill green" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">${text}</span>`;
      } else if (isArriving) {
        const text = window.I18n && window.I18n.getLanguage() === 'ta' ? '⚡ இப்போது வந்தடைகிறது' : '⚡ Arriving Now';
        statusHtml = `<span class="status-pill blue arriving" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">${text}</span>`;
      } else if (isTarget) {
        const text = window.I18n && window.I18n.getLanguage() === 'ta' ? '⚡ அடுத்தது' : '⚡ Next';
        statusHtml = `<span class="status-pill amber" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">${text}</span>`;
      } else {
        const text = window.I18n && window.I18n.getLanguage() === 'ta' ? '🚏 வரவிருக்கும்' : '🚏 Upcoming';
        statusHtml = `<span class="status-pill amber" style="font-size: 0.72rem; padding: 0.15rem 0.5rem; opacity: 0.85;">${text}</span>`;
      }

      // Live ETA Column
      let etaDisplay = '';
      if (isReached) {
        const text = window.I18n && window.I18n.getLanguage() === 'ta' ? 'அடைந்தது' : 'Reached';
        etaDisplay = `<strong style="color: #059669;">${text}</strong>`;
      } else if (isArriving) {
        const text = window.I18n && window.I18n.getLanguage() === 'ta' ? 'இப்போது வந்தடைகிறது ⚡' : 'Arriving Now ⚡';
        etaDisplay = `<strong style="color: #2563eb;">${text}</strong>`;
      } else {
        etaDisplay = `<strong style="color: #2563eb;">${etaObj.text}</strong>`;
      }

      return `
        <tr>
          <td><strong>${stopName}</strong></td>
          <td>${isReached ? '0 km' : `${distKm} km`}</td>
          <td>${etaDisplay}</td>
          <td>${statusHtml}</td>
        </tr>
      `;
    }).join('');
  }

  updateFreshnessTimer() {
    const el = document.getElementById('wimbGpsFreshness');
    if (!el) return;

    const bus = window.appState.getBusById(this.currentBusId);
    if (!bus || !bus.lastUpdated) {
      el.textContent = 'Live Connected';
      return;
    }

    const diffSeconds = Math.max(0, Math.floor((new Date() - new Date(bus.lastUpdated)) / 1000));
    if (diffSeconds < 4) {
      el.textContent = 'Updated Just Now 🟢';
      el.style.color = '#059669';
    } else if (diffSeconds < 20) {
      el.textContent = `Updated ${diffSeconds}s ago 🟢`;
      el.style.color = '#059669';
    } else if (diffSeconds < 60) {
      el.textContent = `Updated ${diffSeconds}s ago 🟠`;
      el.style.color = '#d97706';
    } else {
      el.textContent = `GPS Stale (${Math.floor(diffSeconds / 60)}m ago) 🔴`;
      el.style.color = '#dc2626';
    }
  }
}

window.wimb = new WhereIsMyBusController();
