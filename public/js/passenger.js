/**
 * PassengerController: Handles Route/Stop Selection, Priority Leaderboard, and Fleet Cards
 */
class PassengerController {
  constructor() {
    this.selectedRouteId = null;
    this.selectedStopId = null;
    this.selectedDestId = null;
    this.searchQuery = '';
    this.activeFilter = 'all';
    this.favoriteCommutes = [];

    this.loadFavorites();

    // Subscribe to state updates (e.g. stops added/edited in Admin portal or initial DB load)
    window.appState.subscribe((state, event) => {
      this.syncSelectedRoute();
      this.populateRouteDropdown();
      this.populateStopDropdown();
      this.populateDestDropdown();
      this.render();
    });
  }

  syncSelectedRoute() {
    if ((!this.selectedRouteId || !window.appState.getRouteById(this.selectedRouteId)) && window.appState.routes.length > 0) {
      this.selectedRouteId = window.appState.routes[0].id;
      window.appState.selectedRouteId = this.selectedRouteId;
    }
  }

  init() {
    this.syncSelectedRoute();
    this.populateRouteDropdown();
    this.populateStopDropdown();
    this.populateDestDropdown();
    this.loadFavorites();
    this.render();
  }

  populateRouteDropdown() {
    const routeSelect = document.getElementById('passengerRouteSelect');
    if (!routeSelect) return;

    this.syncSelectedRoute();

    routeSelect.innerHTML = window.appState.routes.map((r) => `
      <option value="${r.id}" ${r.id === this.selectedRouteId ? 'selected' : ''}>
        ${r.name}
      </option>
    `).join('');

    // Ensure selected value matches DOM
    if (routeSelect.value && routeSelect.value !== this.selectedRouteId) {
      this.selectedRouteId = routeSelect.value;
      window.appState.selectedRouteId = this.selectedRouteId;
    }

    // Also build filter pills
    const pillsContainer = document.getElementById('routeFilterPills');
    if (pillsContainer) {
      pillsContainer.innerHTML = `
        <button class="pill ${this.activeFilter === 'all' ? 'active' : ''}" onclick="passenger.filterByRoute('all')">All Routes</button>
        ${window.appState.routes.map((r) => `
          <button class="pill ${this.activeFilter === r.id ? 'active' : ''}" onclick="passenger.filterByRoute('${r.id}')">Route ${r.code}</button>
        `).join('')}
      `;
    }
  }

  populateStopDropdown() {
    const stopSelect = document.getElementById('passengerStopSelect');
    if (!stopSelect) return;

    this.syncSelectedRoute();

    const route = window.appState.getRouteById(this.selectedRouteId);
    if (!route || !route.stops || route.stops.length === 0) {
      stopSelect.innerHTML = '<option value="">No stops available</option>';
      const stopDisplay = document.getElementById('selectedStopNameDisplay');
      if (stopDisplay) stopDisplay.textContent = 'All Stops';
      return;
    }

    // Check if current selectedStopId is valid in the route's stops
    const stopExists = route.stops.some((s) => s.id === this.selectedStopId);
    if (!stopExists && route.stops.length > 0) {
      this.selectedStopId = route.stops[0].id;
    }

    stopSelect.innerHTML = route.stops.map((s) => `
      <option value="${s.id}" ${s.id === this.selectedStopId ? 'selected' : ''}>
        Stop #${s.sequence || 1}: ${s.name}
      </option>
    `).join('');

    const stopDisplay = document.getElementById('selectedStopNameDisplay');
    const selectedStop = route.stops.find((s) => s.id === this.selectedStopId);
    if (stopDisplay && selectedStop) {
      stopDisplay.textContent = selectedStop.name;
    }
  }

  populateDestDropdown() {
    const destSelect = document.getElementById('passengerDestSelect');
    if (!destSelect) return;

    this.syncSelectedRoute();

    const route = window.appState.getRouteById(this.selectedRouteId);
    if (!route || !route.stops || route.stops.length === 0) {
      destSelect.innerHTML = '<option value="">Any Destination</option>';
      return;
    }

    let availableDestinations = [];
    const startIdx = route.stops.findIndex((s) => s.id === this.selectedStopId);
    if (startIdx >= 0) {
      availableDestinations = route.stops.slice(startIdx + 1);
    } else {
      availableDestinations = route.stops.slice(1);
    }

    // Reset selectedDestId if it's no longer in the valid list
    if (this.selectedDestId && !availableDestinations.find(s => s.id === this.selectedDestId)) {
      this.selectedDestId = null;
    }

    destSelect.innerHTML = '<option value="">Any Destination</option>' + availableDestinations.map((s) => {
      let priceText = '';
      if (route.fareMatrix) {
        const priceKey = `${this.selectedStopId}_${s.id}`;
        const price = route.fareMatrix[priceKey];
        if (price !== undefined) {
          priceText = ` (₹${price})`;
        }
      }
      return `
        <option value="${s.id}" ${s.id === this.selectedDestId ? 'selected' : ''}>
          Stop #${s.sequence || 1}: ${s.name}${priceText}
        </option>
      `;
    }).join('');
  }

  onRouteChanged() {
    const routeSelect = document.getElementById('passengerRouteSelect');
    this.selectedRouteId = routeSelect.value;
    window.appState.selectedRouteId = this.selectedRouteId;
    this.selectedStopId = null;
    this.selectedDestId = null;
    this.populateStopDropdown();
    this.populateDestDropdown();
    this.render();
  }

  onStopChanged() {
    const stopSelect = document.getElementById('passengerStopSelect');
    this.selectedStopId = stopSelect.value;
    const route = window.appState.getRouteById(this.selectedRouteId);
    const selectedStop = route ? route.stops.find((s) => s.id === this.selectedStopId) : null;
    const stopDisplay = document.getElementById('selectedStopNameDisplay');
    if (stopDisplay && selectedStop) {
      stopDisplay.textContent = selectedStop.name;
    }
    this.populateDestDropdown();
    this.render();
  }

  onDestChanged() {
    const destSelect = document.getElementById('passengerDestSelect');
    this.selectedDestId = destSelect.value;
    this.render();
  }

  findNearestStop() {
    if (!navigator.geolocation) {
      window.app.showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    
    if (!window.GeoEngine) {
      window.app.showToast('GeoEngine is not loaded yet.', 'error');
      return;
    }

    window.app.showToast('Locating your nearest bus stop...', 'info');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        let nearestStop = null;
        let nearestRouteId = null;
        let minDistance = Infinity;

        window.appState.routes.forEach(route => {
          route.stops.forEach(stop => {
            const dist = window.GeoEngine.getDistanceMeters(userLat, userLng, stop.lat, stop.lng);
            if (dist < minDistance) {
              minDistance = dist;
              nearestStop = stop;
              nearestRouteId = route.id;
            }
          });
        });

        if (nearestStop) {
          // Switch to nearest stop map portal
          document.querySelectorAll('.portal-view').forEach(p => p.classList.remove('active'));
          document.getElementById('portalNearestStopMap').classList.add('active');

          // Ensure map container renders properly before init
          setTimeout(() => {
            const mapContainer = document.getElementById('nearestStopMapContainer');
            if (this.nearestMap) {
              this.nearestMap.remove();
            }
            this.nearestMap = L.map(mapContainer).setView([userLat, userLng], 15);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(this.nearestMap);

            // Add User Marker
            const userIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #2563eb; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });
            L.marker([userLat, userLng], {icon: userIcon}).addTo(this.nearestMap).bindPopup('<b>You are here</b>').openPopup();

            // Add Stop Marker
            const stopIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #ea4335; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            L.marker([nearestStop.lat, nearestStop.lng], {icon: stopIcon}).addTo(this.nearestMap).bindPopup(`<b>${nearestStop.name}</b>`);

            // Draw line between them
            L.polyline([[userLat, userLng], [nearestStop.lat, nearestStop.lng]], {color: '#94a3b8', dashArray: '5, 10', weight: 3}).addTo(this.nearestMap);

            // Adjust bounds
            const bounds = L.latLngBounds([[userLat, userLng], [nearestStop.lat, nearestStop.lng]]);
            this.nearestMap.fitBounds(bounds, { padding: [50, 50] });

            // Render stop details
            const route = window.appState.getRouteById(nearestRouteId);
            const infoContainer = document.getElementById('nearestStopInfoContainer');
            
            let busesHtml = '<div style="color: #64748b;">No active buses on this route currently.</div>';
            const routeBuses = window.appState.getBusesForRoute(nearestRouteId).filter(b => b.isTripActive);
            
            if (routeBuses.length > 0) {
               const ranked = window.PriorityEngine ? window.PriorityEngine.rankBusesForStop(route, nearestStop, routeBuses) : [];
               if (ranked.length > 0) {
                  busesHtml = ranked.map(item => `
                    <div style="background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="font-weight: 600; color: #0f172a;">${item.bus.busNumber || 'Bus'}</div>
                        <div style="font-size: 0.85rem; color: #64748b;">${item.bus.status}</div>
                      </div>
                      <div style="text-align: right;">
                        <div style="font-weight: 700; color: ${item.etaMinutes <= 5 ? '#22c55e' : '#f59e0b'};">${item.etaMinutes} min</div>
                        <div style="font-size: 0.8rem; color: #64748b;">${item.distanceKm} km</div>
                      </div>
                    </div>
                  `).join('');
               }
            }

            infoContainer.innerHTML = `
              <div style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                <h3 style="margin-bottom: 0.5rem; color: #0f172a; font-size: 1.25rem;">${nearestStop.name}</h3>
                <p style="color: #64748b; margin-bottom: 0;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                  ${Math.round(minDistance)} meters away
                </p>
              </div>
            `;
          }, 100);

          window.app.showToast(`Nearest stop found: ${nearestStop.name}`, 'success');
        } else {
          window.app.showToast('Could not find any nearby stops.', 'warning');
        }
      },
      (error) => {
        window.app.showToast('Could not access your location. Please grant location permissions.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  onSearchInput(val) {
    this.searchQuery = val.trim().toLowerCase();
    this.renderFleetGrid();
  }

  filterByRoute(filter) {
    this.activeFilter = filter;
    this.populateRouteDropdown();
    this.renderFleetGrid();
  }

  trackSelectedBus(busIdOrMode = null) {
    let busId = null;

    if (busIdOrMode === 'byBusNumber') {
      if (this.searchQuery) {
        const matched = window.appState.buses.find(b => 
          b.busNumber && b.busNumber.toLowerCase().includes(this.searchQuery)
        );
        if (matched) busId = matched.id;
        
        // Clear the input automatically
        const searchInput = document.getElementById('passengerBusSearch');
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        this.renderFleetGrid();
      }
    } else if (busIdOrMode === 'byRoute') {
      if (this.selectedRouteId && this.selectedStopId && this.selectedRouteId !== 'all') {
         const route = window.appState.getRouteById(this.selectedRouteId);
         const targetStop = route ? route.stops.find(s => s.id === this.selectedStopId) : null;
         const routeBuses = window.appState.getBusesForRoute(this.selectedRouteId).filter(b => b.isTripActive);
         if (route && targetStop && routeBuses.length > 0) {
             const ranked = window.PriorityEngine ? window.PriorityEngine.rankBusesForStop(route, targetStop, routeBuses) : [];
             if (ranked.length > 0) {
                 busId = ranked[0].bus.id;
             }
         }
      }
      
      if (!busId && this.selectedRouteId && this.selectedRouteId !== 'all') {
        const activeBuses = window.appState.getBusesForRoute(this.selectedRouteId).filter(b => b.isTripActive);
        if (activeBuses.length > 0) {
          busId = activeBuses[0].id;
        } else {
          const allBuses = window.appState.getBusesForRoute(this.selectedRouteId);
          if (allBuses.length > 0) busId = allBuses[0].id;
        }
      }
    } else {
      busId = busIdOrMode;
    }

    if (busId) {
      window.appState.selectedBusId = busId;
      const wimbTab = document.getElementById('navTabWimb');
      if (wimbTab) wimbTab.style.display = '';
      window.app.navigate('where-is-my-bus');
      if (window.wimb) {
        window.wimb.loadBus(busId);
      }
    }
  }

  render() {
    this.renderFavoriteCommutes();
    this.renderPriorityLeaderboard();
    this.renderFleetGrid();
  }

  /**
   * Renders the Multiple-Bus Arrival Priority Leaderboard for the selected stop
   */
  renderPriorityLeaderboard() {
    const container = document.getElementById('priorityBusesContainer');
    if (!container) return;

    const route = window.appState.getRouteById(this.selectedRouteId);
    if (!route) return;

    const targetStop = route.stops.find((s) => s.id === this.selectedStopId) || route.stops[0];
    const routeBuses = window.appState.getBusesForRoute(this.selectedRouteId).filter(b => b.isTripActive);

    // If destination is selected, ensure the route has both stops and board is before dest
    let isValidRoute = true;
    if (this.selectedDestId) {
      const boardIdx = route.stops.findIndex((s) => s.id === this.selectedStopId);
      const destIdx = route.stops.findIndex((s) => s.id === this.selectedDestId);
      if (boardIdx === -1 || destIdx === -1 || destIdx <= boardIdx) {
        isValidRoute = false;
      }
    }

    if (!targetStop || routeBuses.length === 0 || !isValidRoute) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; background: #fff; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 0.95rem;">No active buses currently operating on this route segment.</p>
        </div>
      `;
      return;
    }

    // Rank approaching buses by live ETA
    const ranked = PriorityEngine.rankBusesForStop(route, targetStop, routeBuses);

    // Smart Comfort Recommendation Logic:
    // If the 1st bus is Moderate or Heavy, check if another approaching bus has Low crowd
    let smartSuggestionHtml = '';
    const firstBus = ranked[0];
    const lowCrowdBus = ranked.find((item) => (item.crowdLevel || 'Moderate').toLowerCase() === 'low');

    if (lowCrowdBus && firstBus && lowCrowdBus.bus.id !== firstBus.bus.id && (firstBus.crowdLevel || 'Moderate').toLowerCase() !== 'low') {
      smartSuggestionHtml = `
        <div class="smart-crowd-alert" style="grid-column: 1 / -1;">
          <div class="smart-crowd-alert-left">
            <div class="smart-crowd-badge-icon">
              <i data-lucide="sparkles"></i>
            </div>
            <div>
              <div class="smart-crowd-title">
                <span>Smart Travel Tip: Low Crowd Bus on Same Route!</span>
              </div>
              <div class="smart-crowd-desc">
                <strong>BUS ${lowCrowdBus.busNumber}</strong> has <strong>🟢 Seats Available (Low Crowd)</strong> arriving in <strong>${lowCrowdBus.etaText}</strong> (${lowCrowdBus.distanceKm} km away). Take this bus for a peaceful ride!
              </div>
            </div>
          </div>
          <button class="smart-crowd-btn" onclick="passenger.trackSelectedBus('${lowCrowdBus.bus.id}')">
            <i data-lucide="navigation"></i> Track BUS ${lowCrowdBus.busNumber}
          </button>
        </div>
      `;
    }

    const cardsHtml = ranked.map((item) => {
      const crowdLvl = item.crowdLevel || 'Moderate';
      const crowdClass = crowdLvl.toLowerCase();
      const isLowCrowdRecommended = lowCrowdBus && item.bus.id === lowCrowdBus.bus.id && ranked.length > 1;

      return `
      <div class="priority-card ${item.rankClass}">
        <div>
          <div class="priority-card-header">
            <div class="bus-num-badge">
              BUS ${item.busNumber}
            </div>
            <div style="text-align: right;">
              <span class="crowd-pill ${crowdClass}">
                <span class="dot" style="background: currentColor;"></span> ${crowdLvl} Crowd
              </span>
              <div class="bus-meta-title" style="margin-top: 4px;">${item.regNumber}</div>
            </div>
          </div>

          ${isLowCrowdRecommended ? `
            <div class="comfort-recommend-chip">
              <i data-lucide="thumbs-up" style="width: 12px; height: 12px;"></i> Recommended for Comfort • Seats Available
            </div>
          ` : ''}

          <!-- Big ETA Callout -->
          <div class="priority-eta-box">
            <div class="eta-label-tag">Estimated Arrival at ${targetStop.name}</div>
            <div class="eta-time-val">${item.etaText}</div>
          </div>

          <!-- Key Telemetry Metrics -->
          <div class="priority-metrics-row">
            <div class="metric-item">
              <span class="lbl">Distance to Stop</span>
              <span class="val">${item.distanceKm} km</span>
            </div>
            <div class="metric-item">
              <span class="lbl">Moving Speed</span>
              <span class="val text-blue">${item.speed} km/h</span>
            </div>
            <div class="metric-item">
              <span class="lbl">Current Stop</span>
              <span class="val">${item.currentStopName || 'On Route'}</span>
            </div>
            <div class="metric-item">
              <span class="lbl">Next Stop</span>
              <span class="val text-emerald">${item.nextStopName || 'En route'}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 1rem;">
          <button class="btn btn-primary" style="flex: 1;" onclick="passenger.trackSelectedBus('${item.bus.id}')">
            <i data-lucide="navigation"></i> Where Is My Bus
          </button>
          <button class="btn btn-warning" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700; padding: 0.6rem 0.9rem; display: flex; align-items: center; gap: 4px;" onclick="window.proximityAlarm.openAlarmModal('${item.bus.id}', '${targetStop.id}')" title="Wake Me Up Alarm">
            <i data-lucide="bell" style="width: 16px; height: 16px;"></i> <span>Alarm</span>
          </button>
        </div>
      </div>
    `;
    }).join('');

    let ticketPriceHtml = '';
    if (isValidRoute && this.selectedDestId && route.fareMatrix) {
      const priceKey = `${this.selectedStopId}_${this.selectedDestId}`;
      const price = route.fareMatrix[priceKey];
      if (price !== undefined) {
        const destStop = route.stops.find(s => s.id === this.selectedDestId);
        ticketPriceHtml = `
          <div style="grid-column: 1 / -1; background: #ecfdf5; border: 1px solid #10b981; padding: 12px 16px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div>
              <div style="font-weight: 700; color: #065f46; font-size: 0.95rem;">Ticket Price Info</div>
              <div style="font-size: 0.85rem; color: #047857; margin-top: 2px;">
                From <strong>${targetStop.name}</strong> to <strong>${destStop.name}</strong>
              </div>
            </div>
            <div style="font-size: 1.5rem; font-weight: 800; color: #059669;">
              ₹${price}
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = ticketPriceHtml + smartSuggestionHtml + cardsHtml;

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  /**
   * Renders all fleet buses with route tags & search filters
   */
  renderFleetGrid() {
    const grid = document.getElementById('allBusesGrid');
    if (!grid) return;

    let buses = window.appState.buses;

    // Filter by route pill
    if (this.activeFilter !== 'all') {
      buses = buses.filter((b) => b.routeId === this.activeFilter);
    }

    // Filter by search query
    if (this.searchQuery) {
      buses = buses.filter((b) => 
        b.busNumber.toLowerCase().includes(this.searchQuery) ||
        (b.regNumber && b.regNumber.toLowerCase().includes(this.searchQuery)) ||
        (b.BusName && b.BusName.toLowerCase().includes(this.searchQuery))
      );
    }

    // Update active buses badge in header
    const activeCountText = document.getElementById('activeBusesCountText');
    const runningCount = window.appState.buses.filter((b) => b.status === 'Running').length;
    if (activeCountText) {
      activeCountText.textContent = `${runningCount} Active Buses Live`;
    }

    if (buses.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; background: #fff; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 0.95rem;">No buses matching your filter criteria.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = buses.map((bus) => {
      const route = window.appState.getRouteById(bus.routeId);
      const isRunning = bus.status === 'Running';
      const statusClass = isRunning ? 'green' : (bus.status === 'Stopped' ? 'amber' : 'red');
      
      let crowdLvl = bus.crowdLevel || 'Moderate';
      let crowdClass = crowdLvl.toLowerCase();
      
      let crowdBadgeHtml = `
                <span class="crowd-pill ${crowdClass}">
                  ${crowdLvl}
                </span>`;
      let liveSpeedHtml = `<span class="val text-blue">${bus.speed || 0} km/h</span>`;
      let nextStopHtml = `<span class="val">${bus.nextStopName || 'N/A'}</span>`;
      let nextEtaHtml = `<span class="val text-emerald">${bus.etaMinutes || 0} min (${bus.distanceToNextKm || 0} km)</span>`;
      let crowdStatusHtml = `<span class="val text-primary" style="font-weight: 700;">${crowdLvl}</span>`;

      if (!bus.isTripActive) {
          crowdBadgeHtml = `<span style="color: #94a3b8; font-weight: 600;">-</span>`;
          liveSpeedHtml = `<span class="val text-slate" style="font-weight: 400;">-</span>`;
          nextStopHtml = `<span class="val text-slate" style="font-weight: 400;">-</span>`;
          nextEtaHtml = `<span class="val text-slate" style="font-weight: 400;">-</span>`;
          crowdStatusHtml = `<span class="val text-slate" style="font-weight: 400;">-</span>`;
      }

      return `
        <div class="fleet-card" onclick="passenger.trackSelectedBus('${bus.id}')" style="cursor: pointer;">
          <div>
            <div class="fleet-card-header">
              <div class="bus-num-badge" style="font-size: 1.1rem; padding: 0.25rem 0.6rem;">
                BUS ${bus.busNumber}
              </div>
              <div style="display: flex; gap: 0.4rem; align-items: center;">
                ${crowdBadgeHtml}
                <span class="status-pill ${statusClass}">
                  <span class="dot" style="background: currentColor;"></span> ${bus.status}
                </span>
              </div>
            </div>

            <div style="font-size: 0.92rem; font-weight: 700; color: #0f172a; margin-bottom: 0.2rem;">
              ${route ? route.name : 'Unassigned Route'}
            </div>
            <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 0.85rem;">
              Reg: ${bus.regNumber} • Bus: ${bus.BusName}
            </div>

            <div class="priority-metrics-row mb-2">
              <div class="metric-item">
                <span class="lbl">Live Speed</span>
                ${liveSpeedHtml}
              </div>
              <div class="metric-item">
                <span class="lbl">Next Stop</span>
                ${nextStopHtml}
              </div>
              <div class="metric-item">
                <span class="lbl">Next ETA</span>
                ${nextEtaHtml}
              </div>
              <div class="metric-item">
                <span class="lbl">Crowd Status</span>
                ${crowdStatusHtml}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid #f1f5f9; font-size: 0.8rem; font-weight: 700;">
            <span style="color: #2563eb; display: flex; align-items: center; gap: 4px;">
              Track on Live Radar <i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i>
            </span>
            <button class="btn btn-xs btn-warning" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700; padding: 3px 8px;" onclick="event.stopPropagation(); window.proximityAlarm.openAlarmModal('${bus.id}')" title="Set Arrival Alarm">
              <i data-lucide="bell" style="width: 12px; height: 12px;"></i> Alarm
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // ========================================================
  // ⭐ FAVORITE ROUTES & STOPS ("MY DAILY COMMUTE")
  // ========================================================

  loadFavorites() {
    try {
      const raw = localStorage.getItem('citybus_favorite_commutes');
      if (raw) {
        this.favoriteCommutes = JSON.parse(raw);
      } else {
        this.favoriteCommutes = [];
      }
    } catch (e) {
      console.warn('Failed to parse favorite commutes', e);
      this.favoriteCommutes = [];
    }

    if (!Array.isArray(this.favoriteCommutes)) {
      this.favoriteCommutes = [];
    }

    // Clean up any legacy default mock seeds if present
    const hasMockSeeds = this.favoriteCommutes.some(f => f.id === 'fav-college' || f.id === 'fav-office' || f.id === 'fav-hospital');
    if (hasMockSeeds) {
      this.favoriteCommutes = this.favoriteCommutes.filter(f => f.id !== 'fav-college' && f.id !== 'fav-office' && f.id !== 'fav-hospital');
      this.saveFavorites();
    }
  }

  saveFavorites() {
    try {
      localStorage.setItem('citybus_favorite_commutes', JSON.stringify(this.favoriteCommutes));
    } catch (e) {
      console.warn('Failed to save favorite commutes', e);
    }
  }

  renderFavoriteCommutes() {
    const section = document.getElementById('favoriteCommutesSection');
    const container = document.getElementById('favoriteCommutesGrid');

    // Update the Star Button in "1. Track by Route & Stop"
    this.updateStarButtonState();

    // Only show when the passenger has actively added favorite commutes
    if (!this.favoriteCommutes || this.favoriteCommutes.length === 0) {
      if (section) section.style.display = 'none';
      if (container) container.innerHTML = '';
      return;
    }

    if (section) section.style.display = 'block';
    if (!container) return;

    if (!window.appState || !window.appState.routes || window.appState.routes.length === 0) {
      return;
    }

    container.innerHTML = this.favoriteCommutes.map((fav) => {
      let route = window.appState.getRouteById(fav.routeId);
      if (!route) route = window.appState.routes[0];
      if (!route) return '';

      const stops = route.stops || [];
      const boardStop = stops.find(s => s.id === fav.stopId) || stops[0];
      const destStop = fav.destId ? stops.find(s => s.id === fav.destId) : null;

      // Telemetry: active buses on this route
      const activeBuses = window.appState.getBusesForRoute(route.id).filter(b => b.isTripActive);

      let etaHtml = `<span class="fav-eta-pill" style="background: #f1f5f9; color: #64748b; border-color: #e2e8f0;">No active bus</span>`;
      if (activeBuses.length > 0 && window.PriorityEngine && boardStop) {
        const ranked = window.PriorityEngine.rankBusesForStop(route, boardStop, activeBuses);
        if (ranked && ranked.length > 0) {
          const topBus = ranked[0];
          etaHtml = `<span class="fav-eta-pill">⚡ Bus ${topBus.bus.busNumber} (~${topBus.etaMinutes}m)</span>`;
        }
      }

      const activeBusesHtml = activeBuses.length > 0
        ? `<span class="fav-active-buses-pill has-buses"><span style="width: 7px; height: 7px; background: #10b981; border-radius: 50%; display: inline-block;"></span> ${activeBuses.length} Running</span>`
        : `<span class="fav-active-buses-pill no-buses">0 Running</span>`;

      const isCurrentActive = (this.selectedRouteId === fav.routeId && this.selectedStopId === fav.stopId);

      return `
        <div class="favorite-commute-card ${isCurrentActive ? 'is-active-route' : ''}" onclick="passenger.selectFavorite('${fav.id}')" title="Click to view route details">
          <div>
            <div class="fav-card-top">
              <div class="fav-card-label-badge">
                <span style="font-size: 1.15rem;">${fav.icon || '⭐'}</span>
                <span>${fav.label}</span>
              </div>
              <button class="fav-card-delete-btn" onclick="event.stopPropagation(); passenger.deleteFavorite('${fav.id}')" title="Remove from My Daily Commute">
                <i data-lucide="x" style="width: 14px; height: 14px;"></i>
              </button>
            </div>

            <div class="fav-card-route-info">
              <span class="fav-route-pill">Route ${route.code || ''}</span>
              <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #475569;" title="${route.name}">${route.name}</span>
            </div>

            <div class="fav-journey-flow">
              <div class="fav-stop-point">
                <span class="fav-stop-label">From</span>
                <span class="fav-stop-name" title="${boardStop ? boardStop.name : 'Origin'}">${boardStop ? boardStop.name : 'Origin'}</span>
              </div>
              <i data-lucide="arrow-right" class="fav-journey-arrow" style="width: 14px; height: 14px;"></i>
              <div class="fav-stop-point">
                <span class="fav-stop-label">To</span>
                <span class="fav-stop-name" title="${destStop ? destStop.name : 'Any Destination'}">${destStop ? destStop.name : 'Any Destination'}</span>
              </div>
            </div>

            <div class="fav-status-row">
              ${activeBusesHtml}
              ${etaHtml}
            </div>
          </div>

          <button class="fav-1tap-btn" onclick="event.stopPropagation(); passenger.selectAndTrackFavorite('${fav.id}')">
            <i data-lucide="zap" style="width: 14px; height: 14px;"></i> 1-Tap Live Track
          </button>
        </div>
      `;
    }).join('');

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  updateStarButtonState() {
    const starBtn = document.getElementById('btnStarCurrentCommute');
    if (!starBtn) return;

    const isStarred = this.favoriteCommutes.some(f => 
      f.routeId === this.selectedRouteId && 
      f.stopId === this.selectedStopId &&
      (!f.destId || !this.selectedDestId || f.destId === this.selectedDestId)
    );

    if (isStarred) {
      starBtn.classList.add('is-starred');
      starBtn.innerHTML = `<i data-lucide="star" style="width: 14px; height: 14px; fill: white; color: white;"></i> <span>★ Starred</span>`;
    } else {
      starBtn.classList.remove('is-starred');
      starBtn.innerHTML = `<i data-lucide="star" style="width: 14px; height: 14px; color: #b45309;"></i> <span>Star Commute</span>`;
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  selectFavorite(favId) {
    const fav = this.favoriteCommutes.find(f => f.id === favId);
    if (!fav) return;

    this.selectedRouteId = fav.routeId;
    window.appState.selectedRouteId = this.selectedRouteId;
    this.selectedStopId = fav.stopId;
    this.selectedDestId = fav.destId || null;

    this.populateRouteDropdown();
    this.populateStopDropdown();
    this.populateDestDropdown();
    this.render();

    const leaderboard = document.getElementById('selectedStopNameDisplay');
    if (leaderboard) {
      leaderboard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (window.app && window.app.showToast) {
      window.app.showToast(`Selected "${fav.label}" commute`, 'info');
    }
  }

  selectAndTrackFavorite(favId) {
    const fav = this.favoriteCommutes.find(f => f.id === favId);
    if (!fav) return;

    this.selectedRouteId = fav.routeId;
    window.appState.selectedRouteId = this.selectedRouteId;
    this.selectedStopId = fav.stopId;
    this.selectedDestId = fav.destId || null;

    this.populateRouteDropdown();
    this.populateStopDropdown();
    this.populateDestDropdown();
    this.render();

    if (window.app && window.app.showToast) {
      window.app.showToast(`⚡ 1-Tap Tracking launched for ${fav.label}!`, 'success');
    }

    this.trackSelectedBus('byRoute');
  }

  toggleFavoriteCurrentCommute() {
    const existingIdx = this.favoriteCommutes.findIndex(f => 
      f.routeId === this.selectedRouteId && 
      f.stopId === this.selectedStopId && 
      (!f.destId || !this.selectedDestId || f.destId === this.selectedDestId)
    );

    if (existingIdx >= 0) {
      const removed = this.favoriteCommutes.splice(existingIdx, 1)[0];
      this.saveFavorites();
      this.renderFavoriteCommutes();
      if (window.app && window.app.showToast) {
        window.app.showToast(`Removed "${removed.label}" from Daily Commutes`, 'info');
      }
    } else {
      this.openSaveFavoriteModal();
    }
  }

  openSaveFavoriteModal() {
    const modal = document.getElementById('saveFavoriteModal');
    if (!modal) return;

    const routeSelect = document.getElementById('favModalRouteSelect');
    if (routeSelect && window.appState.routes) {
      routeSelect.innerHTML = window.appState.routes.map(r => `
        <option value="${r.id}" ${r.id === this.selectedRouteId ? 'selected' : ''}>
          ${r.name}
        </option>
      `).join('');
    }

    this.populateFavModalStops();
    this.selectFavoritePreset('🎓 College', '🎓 College Commute');

    modal.classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  closeSaveFavoriteModal() {
    const modal = document.getElementById('saveFavoriteModal');
    if (modal) modal.classList.remove('active');
  }

  onFavModalRouteChanged() {
    this.populateFavModalStops();
  }

  onFavModalStopChanged() {
    this.populateFavModalDests();
  }

  populateFavModalStops() {
    const routeSelect = document.getElementById('favModalRouteSelect');
    const stopSelect = document.getElementById('favModalStopSelect');
    if (!routeSelect || !stopSelect) return;

    const routeId = routeSelect.value;
    const route = window.appState.getRouteById(routeId);
    if (!route || !route.stops) {
      stopSelect.innerHTML = '<option value="">No stops available</option>';
      return;
    }

    const preferredStopId = (routeId === this.selectedRouteId && this.selectedStopId) 
      ? this.selectedStopId 
      : (route.stops[0] ? route.stops[0].id : '');

    stopSelect.innerHTML = route.stops.map(s => `
      <option value="${s.id}" ${s.id === preferredStopId ? 'selected' : ''}>
        Stop #${s.sequence}: ${s.name}
      </option>
    `).join('');

    this.populateFavModalDests();
  }

  populateFavModalDests() {
    const routeSelect = document.getElementById('favModalRouteSelect');
    const stopSelect = document.getElementById('favModalStopSelect');
    const destSelect = document.getElementById('favModalDestSelect');
    if (!routeSelect || !stopSelect || !destSelect) return;

    const routeId = routeSelect.value;
    const stopId = stopSelect.value;
    const route = window.appState.getRouteById(routeId);

    if (!route || !route.stops) {
      destSelect.innerHTML = '<option value="">Any Destination</option>';
      return;
    }

    const startIdx = route.stops.findIndex(s => s.id === stopId);
    const dests = startIdx >= 0 ? route.stops.slice(startIdx + 1) : route.stops;

    const preferredDestId = (routeId === this.selectedRouteId && this.selectedDestId)
      ? this.selectedDestId
      : '';

    destSelect.innerHTML = '<option value="">Any Destination</option>' + dests.map(s => `
      <option value="${s.id}" ${s.id === preferredDestId ? 'selected' : ''}>
        Stop #${s.sequence}: ${s.name}
      </option>
    `).join('');
  }

  selectFavoritePreset(preset, defaultLabel) {
    const input = document.getElementById('favCommuteLabel');
    if (input) {
      input.value = defaultLabel;
    }
    const chips = document.querySelectorAll('#favPresetChips .preset-chip');
    chips.forEach(chip => {
      if (chip.textContent.includes(preset)) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  saveFavoriteCommute(e) {
    if (e) e.preventDefault();

    const labelInput = document.getElementById('favCommuteLabel');
    const routeSelect = document.getElementById('favModalRouteSelect');
    const stopSelect = document.getElementById('favModalStopSelect');
    const destSelect = document.getElementById('favModalDestSelect');

    const label = labelInput ? labelInput.value.trim() : 'My Daily Commute';
    const routeId = routeSelect ? routeSelect.value : this.selectedRouteId;
    const stopId = stopSelect ? stopSelect.value : this.selectedStopId;
    const destId = (destSelect && destSelect.value) ? destSelect.value : null;

    let icon = '⭐';
    if (label.includes('🎓') || label.toLowerCase().includes('college')) icon = '🎓';
    else if (label.includes('💼') || label.toLowerCase().includes('office') || label.toLowerCase().includes('work')) icon = '💼';
    else if (label.includes('🏠') || label.toLowerCase().includes('home')) icon = '🏠';
    else if (label.includes('🏥') || label.toLowerCase().includes('hospital')) icon = '🏥';

    const newFav = {
      id: 'fav-' + Date.now(),
      icon,
      label,
      routeId,
      stopId,
      destId
    };

    this.favoriteCommutes.unshift(newFav);
    this.saveFavorites();
    this.closeSaveFavoriteModal();
    this.renderFavoriteCommutes();

    if (window.app && window.app.showToast) {
      window.app.showToast(`⭐ Commute "${label}" saved to Daily Commutes!`, 'success');
    }
  }

  deleteFavorite(favId) {
    const idx = this.favoriteCommutes.findIndex(f => f.id === favId);
    if (idx >= 0) {
      const removed = this.favoriteCommutes.splice(idx, 1)[0];
      this.saveFavorites();
      this.renderFavoriteCommutes();
      if (window.app && window.app.showToast) {
        window.app.showToast(`Removed "${removed.label}" from Daily Commutes`, 'info');
      }
    }
  }
}

window.passenger = new PassengerController();
