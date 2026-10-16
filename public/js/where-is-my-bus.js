/**
 * WhereIsMyBusController: The "Where Is My Train"-Style Live Tracking & Journey Experience
 */
class WhereIsMyBusController {
  constructor() {
    this.mapManager = null;
    this.currentBusId = 'BUS-101';
    this.isFollowing = true;
    this.freshnessInterval = null;

    // Subscribe to state updates
    window.appState.subscribe((state, event) => {
      if (event && event.type === 'BUS_LOCATION_UPDATE' && event.busId === this.currentBusId) {
        this.renderBusUpdate(event.locationData);
      } else {
        this.render();
      }
    });
  }

  init() {
    if (!this.mapManager) {
      this.mapManager = new MapManager('wimbMap', { zoom: 13 });
    }

    this.populateBusSelector();
    this.loadBus(window.appState.selectedBusId || 'BUS-101');

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

    if (numBadge) numBadge.textContent = `BUS ${bus.busNumber}`;
    if (routeTitle) routeTitle.textContent = route.name;
    if (busReg) {
      if (bus.isTripActive) {
        busReg.textContent = `Reg: ${bus.regNumber} • Bus: ${bus.BusName} • Crowd: ${bus.crowdLevel || 'Moderate'}`;
      } else {
        busReg.textContent = `Reg: ${bus.regNumber} • Bus: ${bus.BusName}`;
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
    }

    this.render();
  }

  toggleFollowBus() {
    this.isFollowing = !this.isFollowing;
    const btnText = document.getElementById('followBusBtnText');
    const btn = document.getElementById('btnFollowBus');

    if (this.isFollowing) {
      if (btnText) btnText.textContent = 'Following Bus';
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
      if (btnText) btnText.textContent = 'Follow Bus';
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
    if (btnText) btnText.textContent = 'Follow Bus';
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

  renderBusUpdate(bus) {
    if (!bus || bus.id !== this.currentBusId) return;

    if (this.mapManager) {
      this.mapManager.updateBusMarker(bus, true, true);
    }
    this.render();
  }

  render() {
    const bus = window.appState.getBusById(this.currentBusId);
    if (!bus) return;

    const route = window.appState.getRouteById(bus.routeId);
    if (!route) return;

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
        liveStatus.textContent = '🔴 Trip Ended (GPS Off)';
      } else {
        const isRunning = bus.status === 'Running';
        liveStatus.className = `hud-value status-pill ${isRunning ? 'green' : (bus.status === 'Stopped' ? 'amber' : 'red')}`;
        liveStatus.textContent = isRunning ? '🟢 Running' : `🟡 ${bus.status}`;
      }
    }

    const currentCrowd = bus.crowdLevel || 'Moderate';
    if (liveCrowd) {
      const crowdClass = currentCrowd.toLowerCase();
      liveCrowd.innerHTML = `
        <span class="crowd-pill ${crowdClass}">
          <span class="dot" style="background: currentColor;"></span> ${currentCrowd} Crowd
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
    if (nextStop) nextStop.textContent = bus.nextStopName || 'N/A';
    if (nextEta) nextEta.textContent = `${bus.etaMinutes || 0} min (${bus.distanceToNextKm || 0} km)`;
    if (bearingTip) bearingTip.textContent = `Heading: ${Math.round(bus.bearing || 0)}° • Speed: ${bus.speed || 0} km/h • Crowd: ${currentCrowd}`;

    // Progress Bar
    const progressFill = document.getElementById('wimbProgressBarFill');
    const progressPct = document.getElementById('wimbProgressPct');
    const pct = Math.round(bus.routeProgress || 0);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressPct) progressPct.textContent = `${pct}% Complete`;

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

    const reachedStopIds = bus.reachedStopIds || [];
    const currentStopIdx = route.stops.findIndex((s) => s.id === bus.currentStopId);
    const nextStopIdx = route.stops.findIndex((s) => s.id === bus.nextStopId);

    container.innerHTML = route.stops.map((stop, index) => {
      const isReached = reachedStopIds.includes(stop.id) || index < currentStopIdx;
      const isNextTarget = stop.id === bus.nextStopId;
      const isCurrent = stop.id === bus.currentStopId;

      // Distance and ETA to this stop
      const etaObj = GeoEngine.calculateETA(bus.lat, bus.lng, bus.speed, stop, Math.max(0, index - currentStopIdx));
      const distKm = GeoEngine.getDistanceKm(bus.lat, bus.lng, stop.lat, stop.lng);

      let nodeClass = 'stop-timeline-node';
      if (isReached) nodeClass += ' reached';
      if (isNextTarget) nodeClass += ' next-target';

      let indicatorContent = stop.sequence;
      if (isReached) indicatorContent = '<i data-lucide="check" style="width: 18px; height: 18px; stroke-width: 3;"></i>';
      else if (isNextTarget) indicatorContent = '<i data-lucide="map-pin" style="width: 18px; height: 18px;"></i>';

      // If the bus is between this stop and the next stop, display the floating moving bus marker on the timeline track!
      let movingBusOverlay = '';
      if (isCurrent && nextStopIdx > currentStopIdx) {
        movingBusOverlay = `
          <div class="timeline-live-bus-floater" style="top: 48px;">
            <i data-lucide="bus"></i>
            <span>BUS ${bus.busNumber} • ${bus.speed || 0} km/h • ${bus.distanceToNextKm || 0} km remaining</span>
          </div>
        `;
      }

      return `
        <div class="${nodeClass}">
          <div class="stop-indicator-circle">
            ${indicatorContent}
          </div>
          <div class="stop-details-col">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div class="stop-node-title">${stop.name}</div>
              <span class="stop-eta-badge ${isReached ? 'reached' : 'upcoming'}">
                ${isReached ? 'Reached ✅' : etaObj.text}
              </span>
            </div>
            <div class="stop-node-meta">
              <span>Stop #${stop.sequence}</span>
              ${!isReached ? `<span>• ${Math.round(distKm * 10) / 10} km away</span>` : ''}
              ${isNextTarget ? '<span style="color: #2563eb; font-weight: 700;">• Next Approaching Stop</span>' : ''}
            </div>
          </div>
          ${movingBusOverlay}
        </div>
      `;
    }).join('');

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  renderEtaTable(route, bus) {
    const tbody = document.getElementById('wimbEtaTableBody');
    if (!tbody) return;

    const reachedStopIds = bus.reachedStopIds || [];
    const currentStopIdx = route.stops.findIndex((s) => s.id === bus.currentStopId);

    tbody.innerHTML = route.stops.map((stop, index) => {
      const isReached = reachedStopIds.includes(stop.id) || index < currentStopIdx;
      const etaObj = GeoEngine.calculateETA(bus.lat, bus.lng, bus.speed, stop, Math.max(0, index - currentStopIdx));
      const distKm = Math.round(GeoEngine.getDistanceKm(bus.lat, bus.lng, stop.lat, stop.lng) * 10) / 10;

      return `
        <tr>
          <td><strong>${stop.name}</strong></td>
          <td>${isReached ? '0 km' : `${distKm} km`}</td>
          <td><strong style="color: ${isReached ? '#059669' : '#2563eb'};">${isReached ? 'Reached' : etaObj.text}</strong></td>
          <td>
            <span class="status-pill ${isReached ? 'green' : 'amber'}" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">
              ${isReached ? '✅ Reached' : (stop.id === bus.nextStopId ? '⚡ Next' : '🚌 Upcoming')}
            </span>
          </td>
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
