/**
 * PassengerController: Handles Route/Stop Selection, Priority Leaderboard, and Fleet Cards
 */
class PassengerController {
  constructor() {
    this.currentMode = 'stopToStop';
    this.globalBoardingStopName = '';
    this.globalDestStopName = '';
    this.selectedRouteId = null;
    this.selectedStopId = null;
    this.selectedDestId = null;
    this.searchQuery = '';
    this.activeFilter = 'all';
    this.favoriteCommutes = [];
    this.gender = localStorage.getItem('citybus_passenger_gender') || 'male';

    this.loadFavorites();

    // Subscribe to state updates (e.g. stops added/edited in Admin portal or initial DB load)
    window.appState.subscribe((state, event) => {
      const isLocationUpdate = event && event.type === 'BUS_LOCATION_UPDATE';
      if (!isLocationUpdate) {
        this.syncSelectedRoute();
        this.populateGlobalStops();
        this.populateRoutesTable();
        this.populateRouteTableStops();
        this.populateRouteDropdown();
        this.populateStopDropdown();
        this.populateDestDropdown();
        this.updateGenderToggleUi();
        this.render();
      } else {
        // Targeted in-place update for bus arrival telemetry (zero flicker, no dropdown reset)
        this.updateLiveArrivalsInPlace();
      }
    });
  }

  switchMode(mode) {
    this.currentMode = mode || 'stopToStop';

    const tabStopToStop = document.getElementById('tabBtnStopToStop');
    const tabRoutesTable = document.getElementById('tabBtnRoutesTable');
    const tabBusSearch = document.getElementById('tabBtnBusSearch');

    const panelStopToStop = document.getElementById('panelStopToStop');
    const panelRoutesTable = document.getElementById('panelRoutesTable');
    const panelBusNumber = document.getElementById('panelBusNumber');

    if (tabStopToStop) tabStopToStop.classList.toggle('active', this.currentMode === 'stopToStop');
    if (tabRoutesTable) tabRoutesTable.classList.toggle('active', this.currentMode === 'routesTable');
    if (tabBusSearch) tabBusSearch.classList.toggle('active', this.currentMode === 'busNumber');

    if (panelStopToStop) panelStopToStop.style.display = this.currentMode === 'stopToStop' ? '' : 'none';
    if (panelRoutesTable) panelRoutesTable.style.display = this.currentMode === 'routesTable' ? '' : 'none';
    if (panelBusNumber) panelBusNumber.style.display = this.currentMode === 'busNumber' ? '' : 'none';

    if (this.currentMode === 'routesTable') {
      this.populateRoutesTable();
      if (!this.selectedRouteId && window.appState.routes.length > 0) {
        this.selectRouteFromTable(window.appState.routes[0].id);
      }
    } else if (this.currentMode === 'stopToStop') {
      this.populateGlobalStops();
    }

    this.render();
    if (window.lucide) lucide.createIcons();
  }

  getAllUniqueStops() {
    const stopMap = new Map();
    (window.appState.routes || []).forEach(route => {
      (route.stops || []).forEach(stop => {
        if (!stop || !stop.name) return;
        const cleanName = stop.name.trim().replace(/\s+/g, ' ');
        const key = cleanName.toLowerCase();
        if (!stopMap.has(key)) {
          stopMap.set(key, {
            name: cleanName,
            lat: stop.lat,
            lng: stop.lng,
            routes: [route]
          });
        } else {
          const entry = stopMap.get(key);
          if (!entry.routes.some(r => r.id === route.id)) {
            entry.routes.push(route);
          }
        }
      });
    });
    return Array.from(stopMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  populateGlobalStops() {
    const boardingSel = document.getElementById('globalBoardingSelect');
    const destSel = document.getElementById('globalDestSelect');
    if (!boardingSel || !destSel) return;

    const allStops = this.getAllUniqueStops();
    if (allStops.length === 0) {
      const noStopsText = window.I18n ? window.I18n.t('noStopsAvailable') : 'No stops available';
      boardingSel.innerHTML = `<option value="">${noStopsText}</option>`;
      destSel.innerHTML = `<option value="">${noStopsText}</option>`;
      return;
    }

    if (!this.globalBoardingStopName || !allStops.some(s => s.name === this.globalBoardingStopName)) {
      this.globalBoardingStopName = allStops[0].name;
    }

    boardingSel.innerHTML = allStops.map(s => {
      const displayName = window.I18n ? window.I18n.getStopName(s.name) : s.name;
      return `<option value="${s.name}" ${s.name === this.globalBoardingStopName ? 'selected' : ''}>${displayName}</option>`;
    }).join('');

    const destCandidates = allStops.filter(s => s.name !== this.globalBoardingStopName);
    if (!this.globalDestStopName || this.globalDestStopName === this.globalBoardingStopName || !destCandidates.some(s => s.name === this.globalDestStopName)) {
      this.globalDestStopName = destCandidates.length > 0 ? destCandidates[0].name : '';
    }

    destSel.innerHTML = destCandidates.map(s => {
      const displayName = window.I18n ? window.I18n.getStopName(s.name) : s.name;
      return `<option value="${s.name}" ${s.name === this.globalDestStopName ? 'selected' : ''}>${displayName}</option>`;
    }).join('');

    const stopDisplay = document.getElementById('selectedStopNameDisplay');
    if (stopDisplay && this.globalBoardingStopName) {
      const fromDisp = window.I18n ? window.I18n.getStopName(this.globalBoardingStopName) : this.globalBoardingStopName;
      const toDisp = window.I18n ? window.I18n.getStopName(this.globalDestStopName) : this.globalDestStopName;
      stopDisplay.textContent = toDisp ? `${fromDisp} ➔ ${toDisp}` : fromDisp;
    }
  }

  onGlobalBoardingChanged() {
    const boardingSel = document.getElementById('globalBoardingSelect');
    if (!boardingSel) return;
    this.globalBoardingStopName = boardingSel.value;

    const destSel = document.getElementById('globalDestSelect');
    if (destSel) {
      const allStops = this.getAllUniqueStops();
      const destCandidates = allStops.filter(s => s.name !== this.globalBoardingStopName);
      if (this.globalDestStopName === this.globalBoardingStopName || !destCandidates.some(s => s.name === this.globalDestStopName)) {
        this.globalDestStopName = destCandidates.length > 0 ? destCandidates[0].name : '';
      }
      destSel.innerHTML = destCandidates.map(s => {
        const displayName = window.I18n ? window.I18n.getStopName(s.name) : s.name;
        return `<option value="${s.name}" ${s.name === this.globalDestStopName ? 'selected' : ''}>${displayName}</option>`;
      }).join('');
    }

    const stopDisplay = document.getElementById('selectedStopNameDisplay');
    if (stopDisplay && this.globalBoardingStopName) {
      const fromDisp = window.I18n ? window.I18n.getStopName(this.globalBoardingStopName) : this.globalBoardingStopName;
      const toDisp = window.I18n ? window.I18n.getStopName(this.globalDestStopName) : this.globalDestStopName;
      stopDisplay.textContent = toDisp ? `${fromDisp} ➔ ${toDisp}` : fromDisp;
    }

    this.render();
  }

  onGlobalDestChanged() {
    const destSel = document.getElementById('globalDestSelect');
    if (!destSel) return;
    this.globalDestStopName = destSel.value;

    const stopDisplay = document.getElementById('selectedStopNameDisplay');
    if (stopDisplay && this.globalBoardingStopName) {
      const fromDisp = window.I18n ? window.I18n.getStopName(this.globalBoardingStopName) : this.globalBoardingStopName;
      const toDisp = window.I18n ? window.I18n.getStopName(this.globalDestStopName) : this.globalDestStopName;
      stopDisplay.textContent = toDisp ? `${fromDisp} ➔ ${toDisp}` : fromDisp;
    }

    this.render();
  }

  swapGlobalStops() {
    const temp = this.globalBoardingStopName;
    this.globalBoardingStopName = this.globalDestStopName;
    this.globalDestStopName = temp;
    this.populateGlobalStops();
    this.render();
    if (window.app && typeof window.app.showToast === 'function') {
      const isTa = window.I18n && window.I18n.getLanguage() === 'ta';
      window.app.showToast(isTa ? 'திசை மாற்றப்பட்டது' : 'Direction swapped', 'info');
    }
  }

  executeStopToStopSearch() {
    this.render();
    const target = document.getElementById('priorityBusesContainer');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  normalizeStopName(name) {
    if (!name) return '';
    let n = name.replace(/\s+/g, ' ').trim().toLowerCase();
    if (n === 'vannerpettai') n = 'vannarpettai';
    if (n.includes('new bus stand')) n = 'new bus stand';
    if (n.includes('palayankottai') || n.includes('palayamkottai')) n = 'palayamkottai bus stand';
    return n;
  }

  findJourneys(fromName, toName) {
    if (!fromName || !toName || fromName === toName) return { direct: [], connecting: [] };

    const normFrom = this.normalizeStopName(fromName);
    const normTo = this.normalizeStopName(toName);
    if (!normFrom || !normTo || normFrom === normTo) return { direct: [], connecting: [] };

    const routes = window.appState.routes || [];
    const directMatches = [];

    // 1. Direct Routes Search
    routes.forEach(route => {
      const stops = route.stops || [];
      const fromIdx = stops.findIndex(s => this.normalizeStopName(s.name) === normFrom);
      const toIdx = stops.findIndex(s => this.normalizeStopName(s.name) === normTo);
      if (fromIdx >= 0 && toIdx >= 0 && toIdx > fromIdx) {
        directMatches.push({
          route,
          fromStop: stops[fromIdx],
          toStop: stops[toIdx],
          fare: this.getFare(route, stops[fromIdx].id, stops[toIdx].id),
          stopCount: toIdx - fromIdx
        });
      }
    });

    if (directMatches.length > 0) {
      return { direct: directMatches, connecting: [] };
    }

    // 2. 1-Stop Transfer / Connecting Routes Search
    const connectingMatches = [];
    routes.forEach(r1 => {
      const s1 = r1.stops || [];
      const fromIdx = s1.findIndex(s => this.normalizeStopName(s.name) === normFrom);
      if (fromIdx < 0) return;

      for (let j = fromIdx + 1; j < s1.length; j++) {
        const interchangeStop1 = s1[j];
        const normInterchange = this.normalizeStopName(interchangeStop1.name);

        routes.forEach(r2 => {
          if (r2.id === r1.id) return;
          const s2 = r2.stops || [];
          const interchangeIdx2 = s2.findIndex(s => this.normalizeStopName(s.name) === normInterchange);
          const toIdx2 = s2.findIndex(s => this.normalizeStopName(s.name) === normTo);

          if (interchangeIdx2 >= 0 && toIdx2 >= 0 && toIdx2 > interchangeIdx2) {
            const leg1Fare = this.getFare(r1, s1[fromIdx].id, interchangeStop1.id);
            const leg2Fare = this.getFare(r2, s2[interchangeIdx2].id, s2[toIdx2].id);
            connectingMatches.push({
              interchangeName: interchangeStop1.name,
              leg1: {
                route: r1,
                fromStop: s1[fromIdx],
                toStop: interchangeStop1,
                fare: leg1Fare
              },
              leg2: {
                route: r2,
                fromStop: s2[interchangeIdx2],
                toStop: s2[toIdx2],
                fare: leg2Fare
              },
              totalFare: (leg1Fare || 5) + (leg2Fare || 5),
              totalStops: (j - fromIdx) + (toIdx2 - interchangeIdx2)
            });
          }
        });
      }
    });

    connectingMatches.sort((a, b) => a.totalStops - b.totalStops);
    return { direct: [], connecting: connectingMatches };
  }

  populateRoutesTable() {
    const tbody = document.getElementById('passengerRoutesTableBody');
    if (!tbody) return;

    const routes = window.appState.routes || [];
    if (routes.length === 0) {
      const noRoutesText = window.I18n && window.I18n.getLanguage() === 'ta' ? 'வழித்தடங்கள் இல்லை' : 'No routes found.';
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 2rem;">${noRoutesText}</td></tr>`;
      return;
    }

    const isTa = window.I18n && window.I18n.getLanguage() === 'ta';
    const selectBtnText = isTa ? 'தேர்வு செய்க' : 'Select';
    const liveWord = isTa ? 'செயலில்' : 'Live';

    tbody.innerHTML = routes.map(r => {
      const activeBuses = window.appState.getBusesForRoute(r.id).filter(b => b.isTripActive).length;
      const totalStops = (r.stops || []).length;
      const isSelected = r.id === this.selectedRouteId;
      const routeDisplayName = window.I18n ? window.I18n.getRouteName(r.name) : r.name;
      const firstStopName = (r.stops && r.stops[0]) ? (window.I18n ? window.I18n.getStopName(r.stops[0].name) : r.stops[0].name) : '';
      const lastStopName = (r.stops && r.stops[r.stops.length - 1]) ? (window.I18n ? window.I18n.getStopName(r.stops[r.stops.length - 1].name) : r.stops[r.stops.length - 1].name) : '';

      return `
        <tr class="${isSelected ? 'selected-route-row' : ''}" style="cursor: pointer;" onclick="passenger.selectRouteFromTable('${r.id}')">
          <td>
            <span style="background: ${r.color || '#3b82f6'}; color: #fff; font-weight: 800; font-size: 0.85rem; padding: 3px 10px; border-radius: 9999px; display: inline-block;">
              ${r.code}
            </span>
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 0.92rem;">${routeDisplayName}</div>
            <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
              ${r.description ? r.description : `${firstStopName} ➔ ${lastStopName}`}
            </div>
          </td>
          <td style="text-align: center; font-weight: 600; color: #475569;">
            ${totalStops}
          </td>
          <td style="text-align: center;">
            <span style="background: ${activeBuses > 0 ? '#dcfce7' : '#f1f5f9'}; color: ${activeBuses > 0 ? '#15803d' : '#64748b'}; font-weight: 700; font-size: 0.78rem; padding: 3px 8px; border-radius: 6px;">
              ${activeBuses > 0 ? `🟢 ${activeBuses} ${liveWord}` : `⚪ 0 ${liveWord}`}
            </span>
          </td>
          <td style="text-align: right;">
            <button class="btn btn-xs ${isSelected ? 'btn-primary' : 'btn-outline'}" onclick="event.stopPropagation(); passenger.selectRouteFromTable('${r.id}')">
              ${selectBtnText}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  selectRouteFromTable(routeId) {
    this.selectedRouteId = routeId;
    window.appState.selectedRouteId = routeId;

    const route = window.appState.getRouteById(routeId);
    if (!route) return;

    const box = document.getElementById('routeSelectedBox');
    const title = document.getElementById('routeSelectedBoxTitle');
    if (box) box.style.display = 'block';
    if (title) {
      const routeDisplayName = window.I18n ? window.I18n.getRouteName(route.name) : route.name;
      title.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: ${route.color || '#3b82f6'}; color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 0.82rem; font-weight: 800;">${route.code}</span>
            <span>${routeDisplayName}</span>
          </div>
          ${route.description ? `<div style="font-size: 0.82rem; font-weight: 500; color: #64748b;">📝 ${route.description}</div>` : ''}
        </div>
      `;
    }

    this.populateRouteTableStops();
    this.populateRoutesTable();
    this.renderPriorityLeaderboard();
    if (window.lucide) lucide.createIcons();
  }

  populateRouteTableStops() {
    const boardingSel = document.getElementById('routeTableBoardingSelect');
    const destSel = document.getElementById('routeTableDestSelect');
    if (!boardingSel || !destSel) return;

    const route = window.appState.getRouteById(this.selectedRouteId);
    if (!route || !route.stops || route.stops.length === 0) {
      const noStopsText = window.I18n ? window.I18n.t('noStopsAvailable') : 'No stops available';
      boardingSel.innerHTML = `<option value="">${noStopsText}</option>`;
      destSel.innerHTML = `<option value="">${noStopsText}</option>`;
      return;
    }

    const isTa = window.I18n && window.I18n.getLanguage() === 'ta';
    const stopWord = isTa ? 'நிறுத்தம்' : 'Stop';
    const anyDestWord = isTa ? 'அனைத்து நிறுத்தங்களும்' : 'Any Destination';

    const stopExists = route.stops.some(s => s.id === this.selectedStopId);
    if (!stopExists && route.stops.length > 0) {
      this.selectedStopId = route.stops[0].id;
    }

    boardingSel.innerHTML = route.stops.map(s => {
      const name = window.I18n ? window.I18n.getStopName(s.name) : s.name;
      return `<option value="${s.id}" ${s.id === this.selectedStopId ? 'selected' : ''}>${stopWord} #${s.sequence || 1}: ${name}</option>`;
    }).join('');

    const fromIdx = route.stops.findIndex(s => s.id === this.selectedStopId);
    const availableDests = fromIdx >= 0 ? route.stops.slice(fromIdx + 1) : route.stops.slice(1);

    if (this.selectedDestId && !availableDests.some(s => s.id === this.selectedDestId)) {
      this.selectedDestId = null;
    }

    destSel.innerHTML = `<option value="">${anyDestWord}</option>` + availableDests.map(s => {
      const name = window.I18n ? window.I18n.getStopName(s.name) : s.name;
      const fare = this.getFare(route, this.selectedStopId, s.id);
      const fareStr = fare ? ` (₹${fare})` : '';
      return `<option value="${s.id}" ${s.id === this.selectedDestId ? 'selected' : ''}>${stopWord} #${s.sequence || 1}: ${name}${fareStr}</option>`;
    }).join('');

    const stopDisplay = document.getElementById('selectedStopNameDisplay');
    const selectedStop = route.stops.find(s => s.id === this.selectedStopId);
    if (stopDisplay && selectedStop) {
      stopDisplay.textContent = window.I18n ? window.I18n.getStopName(selectedStop.name) : selectedStop.name;
    }
  }

  onRouteChangeStopChanged() {
    const boardingSel = document.getElementById('routeTableBoardingSelect');
    if (!boardingSel) return;
    this.selectedStopId = boardingSel.value;
    this.populateRouteTableStops();
    this.render();
  }

  onRouteChangeDestChanged() {
    const destSel = document.getElementById('routeTableDestSelect');
    if (!destSel) return;
    this.selectedDestId = destSel.value;
    this.render();
  }

  setGender(gender) {
    this.gender = gender === 'female' ? 'female' : 'male';
    localStorage.setItem('citybus_passenger_gender', this.gender);
    this.updateGenderToggleUi();
    this.populateDestDropdown();
    this.populateRouteTableStops();
    this.render();
    if (window.wimb && window.wimb.currentBusId) {
      window.wimb.loadBus(window.wimb.currentBusId);
    }
  }

  updateGenderToggleUi() {
    const btnMale = document.getElementById('genderBtnMale');
    const btnFemale = document.getElementById('genderBtnFemale');
    if (btnMale && btnFemale) {
      btnMale.classList.toggle('active', this.gender === 'male');
      btnFemale.classList.toggle('active', this.gender === 'female');
    }

    const currentPortal = (window.app && window.app.currentPortal) ? window.app.currentPortal : 'passenger';
    if (currentPortal === 'admin' || currentPortal === 'Bus') {
      document.body.classList.remove('female-mode');
      return;
    }

    if (this.gender === 'female') {
      document.body.classList.add('female-mode');
    } else {
      document.body.classList.remove('female-mode');
    }
  }

  syncSelectedRoute() {
    if ((!this.selectedRouteId || !window.appState.getRouteById(this.selectedRouteId)) && window.appState.routes.length > 0) {
      this.selectedRouteId = window.appState.routes[0].id;
      window.appState.selectedRouteId = this.selectedRouteId;
    }
  }

  getFare(route, fromStopId, toStopId) {
    if (!route || !fromStopId || !toStopId) return 5;
    const key = `${fromStopId}_${toStopId}`;
    if (route.fareMatrix && route.fareMatrix[key] !== undefined) {
      return Number(route.fareMatrix[key]);
    }
    // Dynamic fallback calculation based on stop index difference
    if (route.stops && Array.isArray(route.stops)) {
      const fromIdx = route.stops.findIndex(s => s.id === fromStopId);
      const toIdx = route.stops.findIndex(s => s.id === toStopId);
      if (fromIdx >= 0 && toIdx >= 0 && toIdx > fromIdx) {
        const diff = toIdx - fromIdx;
        const stages = [0, 5, 7, 10, 12, 14, 15, 17, 18, 20, 20, 22, 23, 25, 25];
        return stages[Math.min(diff, stages.length - 1)] || (5 + diff * 2);
      }
    }
    return 5;
  }

  init() {
    this.currentMode = this.currentMode || 'stopToStop';
    this.syncSelectedRoute();
    this.populateGlobalStops();
    this.populateRoutesTable();
    this.populateRouteTableStops();
    this.populateRouteDropdown();
    this.populateStopDropdown();
    this.populateDestDropdown();
    this.loadFavorites();
    this.updateGenderToggleUi();
    this.render();
  }

  populateRouteDropdown() {
    const routeSelect = document.getElementById('passengerRouteSelect');
    if (!routeSelect) return;

    this.syncSelectedRoute();

    routeSelect.innerHTML = window.appState.routes.map((r) => `
      <option value="${r.id}" ${r.id === this.selectedRouteId ? 'selected' : ''}>
        ${window.I18n ? window.I18n.getRouteName(r.name) : r.name}
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
      const allRoutesLabel = window.I18n && window.I18n.getLanguage() === 'ta' ? 'அனைத்து வழித்தடங்கள்' : 'All Routes';
      const routeWord = window.I18n && window.I18n.getLanguage() === 'ta' ? 'வழித்தடம்' : 'Route';
      pillsContainer.innerHTML = `
        <button class="pill ${this.activeFilter === 'all' ? 'active' : ''}" onclick="passenger.filterByRoute('all')">${allRoutesLabel}</button>
        ${window.appState.routes.map((r) => `
          <button class="pill ${this.activeFilter === r.id ? 'active' : ''}" onclick="passenger.filterByRoute('${r.id}')">${routeWord} ${r.code}</button>
        `).join('')}
      `;
    }
  }

  populateStopDropdown() {
    const stopSelect = document.getElementById('passengerStopSelect');
    if (!stopSelect) return;

    this.syncSelectedRoute();

    const noStopsText = window.I18n ? window.I18n.t('noStopsAvailable') : 'No stops available';
    const allStopsText = window.I18n ? window.I18n.t('allStops') : 'All Stops';

    const route = window.appState.getRouteById(this.selectedRouteId);
    if (!route || !route.stops || route.stops.length === 0) {
      stopSelect.innerHTML = `<option value="">${noStopsText}</option>`;
      const stopDisplay = document.getElementById('selectedStopNameDisplay');
      if (stopDisplay) stopDisplay.textContent = allStopsText;
      return;
    }

    // Check if current selectedStopId is valid in the route's stops
    const stopExists = route.stops.some((s) => s.id === this.selectedStopId);
    if (!stopExists && route.stops.length > 0) {
      this.selectedStopId = route.stops[0].id;
    }

    const stopLabel = window.I18n && window.I18n.getLanguage() === 'ta' ? 'நிறுத்தம்' : 'Stop';

    stopSelect.innerHTML = route.stops.map((s) => {
      const stopName = window.I18n ? window.I18n.getStopName(s.name) : s.name;
      return `
        <option value="${s.id}" ${s.id === this.selectedStopId ? 'selected' : ''}>
          ${stopLabel} #${s.sequence || 1}: ${stopName}
        </option>
      `;
    }).join('');

    const stopDisplay = document.getElementById('selectedStopNameDisplay');
    const selectedStop = route.stops.find((s) => s.id === this.selectedStopId);
    if (stopDisplay && selectedStop) {
      stopDisplay.textContent = window.I18n ? window.I18n.getStopName(selectedStop.name) : selectedStop.name;
    }
  }

  populateDestDropdown() {
    const destSelect = document.getElementById('passengerDestSelect');
    if (!destSelect) return;

    this.syncSelectedRoute();

    const anyDestText = window.I18n ? window.I18n.t('anyDestination') : 'Any Destination';

    const route = window.appState.getRouteById(this.selectedRouteId);
    if (!route || !route.stops || route.stops.length === 0) {
      destSelect.innerHTML = `<option value="">${anyDestText}</option>`;
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

    const stopLabel = window.I18n && window.I18n.getLanguage() === 'ta' ? 'நிறுத்தம்' : 'Stop';
    const vetriFreeLabel = window.I18n && window.I18n.getLanguage() === 'ta' ? 'வெற்றிப் பயணம் : இலவசம்' : 'Vetri Payanam : Free';

    const routeBuses = window.appState.getBusesForRoute(route.id) || [];
    const hasVetri = routeBuses.some(b => b.isVetriPayanam);

    destSelect.innerHTML = `<option value="">${anyDestText}</option>` + availableDestinations.map((s) => {
      let priceText = '';
      const price = this.getFare(route, this.selectedStopId, s.id);
      if (price !== undefined) {
        if (this.gender === 'female' && hasVetri) {
          priceText = ` (${vetriFreeLabel})`;
        } else {
          priceText = ` (₹${price})`;
        }
      }
      const destStopName = window.I18n ? window.I18n.getStopName(s.name) : s.name;
      return `
        <option value="${s.id}" ${s.id === this.selectedDestId ? 'selected' : ''}>
          ${stopLabel} #${s.sequence || 1}: ${destStopName}${priceText}
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
      stopDisplay.textContent = window.I18n ? window.I18n.getStopName(selectedStop.name) : selectedStop.name;
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
            const userMarkerColor = this.gender === 'female' ? '#f472b6' : '#2563eb';
            const userIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: ${userMarkerColor}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });
            L.marker([userLat, userLng], { icon: userIcon }).addTo(this.nearestMap).bindPopup('<b>You are here</b>').openPopup();

            // Add Stop Marker
            const stopIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #ea4335; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            L.marker([nearestStop.lat, nearestStop.lng], { icon: stopIcon }).addTo(this.nearestMap).bindPopup(`<b>${nearestStop.name}</b>`);

            // Draw line between them
            L.polyline([[userLat, userLng], [nearestStop.lat, nearestStop.lng]], { color: '#94a3b8', dashArray: '5, 10', weight: 3 }).addTo(this.nearestMap);

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
    if (busIdOrMode === 'byRoute') {
      this.renderPriorityLeaderboard();
      const target = document.getElementById('priorityBusesContainer') || document.getElementById('priorityLeaderboardSection');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (busIdOrMode === 'byBusNumber') {
      if (this.searchQuery) {
        this.renderFleetGrid();
        const grid = document.getElementById('passengerFleetGrid');
        if (grid) {
          grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      return;
    }

    let busId = busIdOrMode;
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
   * Generates a reusable, beautiful Priority Bus Card HTML string
   */
  generateBusPriorityCardHtml(route, targetStop, item, isLowCrowdRecommended, isTa, customDestName = null, customFare = null) {
    const crowdLvl = item.crowdLevel || 'Moderate';
    const crowdClass = crowdLvl.toLowerCase();
    const isVetriBus = item.bus && item.bus.isVetriPayanam;

    const crowdTranslated = isTa ? (window.I18n ? window.I18n.t('crowd' + crowdLvl, crowdLvl) : crowdLvl) : crowdLvl;
    const crowdWord = isTa ? 'கூட்டம்' : 'Crowd';
    const vetriBadgeText = isTa ? 'வெற்றிப் பயணம் • இலவசம்' : 'Vetri Payanam • FREE';
    const comfortText = isTa ? 'இருக்கைகள் உள்ளன • சௌகரியமான பயணம்' : 'Recommended for Comfort • Seats Available';
    const targetStopName = targetStop ? (window.I18n ? window.I18n.getStopName(targetStop.name) : targetStop.name) : '';
    const arrivalAtText = isTa ? `வந்து சேரும் இடம்: ${targetStopName}` : `Estimated Arrival at ${targetStopName}`;
    const driverNoticeText = isTa ? 'ஓட்டுநர் தகவல்:' : 'Driver Notice:';
    const distLabel = isTa ? 'நிறுத்தத்திற்கான தூரம்' : 'Distance to Stop';
    const speedLabel = isTa ? 'இயங்கும் வேகம்' : 'Moving Speed';
    const curStopLabel = isTa ? 'தற்போதைய நிறுத்தம்' : 'Current Stop';
    const nextStopLabel = isTa ? 'அடுத்த நிறுத்தம்' : 'Next Stop';
    const ticketFareLabel = isTa ? 'பயணக் கட்டணம்' : 'Ticket Fare';
    const curStopVal = item.currentStopName ? (window.I18n ? window.I18n.getStopName(item.currentStopName) : item.currentStopName) : (isTa ? 'பயணத்தில் உள்ளது' : 'On Route');
    const nextStopVal = item.nextStopName ? (window.I18n ? window.I18n.getStopName(item.nextStopName) : item.nextStopName) : (isTa ? 'வழியில் உள்ளது' : 'En route');

    const isFreeForThisPassenger = isVetriBus && this.gender === 'female';
    let fareVal = '';
    if (isFreeForThisPassenger) {
      fareVal = isTa ? 'வெற்றிப் பயணம் : இலவசம்' : 'Vetri Payanam : Free';
    } else if (customFare !== null && customFare !== undefined) {
      fareVal = `₹${customFare}`;
    } else if (this.selectedDestId && route) {
      const calc = this.getFare(route, targetStop ? targetStop.id : null, this.selectedDestId);
      fareVal = `₹${calc || 5}`;
    } else {
      fareVal = isTa ? '₹5 முதல்' : 'From ₹5';
    }

    const wimbBtnText = isTa ? 'என் பேருந்து எங்கே?' : 'Where Is My Bus';
    const alarmBtnText = isTa ? 'அலாரம்' : 'Alarm';

    return `
      <div class="priority-card ${item.rankClass || 'rank-other'}" data-bus-id="${item.bus.id}">
        <div>
          <div class="priority-card-header">
            <div>
              <div class="bus-num-badge">
                BUS ${item.busNumber}
              </div>
              ${this.gender === 'female' && isVetriBus ? `
                <div style="margin-top: 4px;">
                  <span class="badge" style="display: inline-flex; align-items: center; gap: 4px; background: #fdf2f8; color: #db2777; border: 1px solid #fbcfe8; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                    <img src="assets/vetri-payanam-logo.png" alt="" style="width: 14px; height: 14px; object-fit: contain;">
                    ${vetriBadgeText}
                  </span>
                </div>
              ` : ''}
            </div>
            <div style="text-align: right;">
              <span class="crowd-pill ${crowdClass}">
                <span class="dot" style="background: currentColor;"></span> <span class="val-crowd">${crowdTranslated} ${crowdWord}</span>
              </span>
              <div class="bus-meta-title" style="margin-top: 4px;">${item.regNumber || (route ? route.code : '')}</div>
            </div>
          </div>

          ${isLowCrowdRecommended ? `
            <div class="comfort-recommend-chip">
              <i data-lucide="thumbs-up" style="width: 12px; height: 12px;"></i> ${comfortText}
            </div>
          ` : ''}

          <!-- Big ETA Callout -->
          <div class="priority-eta-box">
            <div class="eta-label-tag">${arrivalAtText}</div>
            <div class="eta-time-val">${item.etaText}</div>
          </div>

          <!-- Key Telemetry Metrics -->
          ${item.bus && item.bus.delayAlert ? `
            <div class="driver-delay-alert" style="background: #fef3c7; color: #92400e; font-size: 0.76rem; font-weight: 700; padding: 6px 10px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #fde68a; display: flex; align-items: center; gap: 6px;">
              ⚠️ <span>${driverNoticeText} <strong>${item.bus.delayAlert}</strong></span>
            </div>
          ` : ''}
          <div class="priority-metrics-row">
            <div class="metric-item">
              <span class="lbl">${distLabel}</span>
              <span class="val val-dist">${item.distanceKm} km</span>
            </div>
            <div class="metric-item">
              <span class="lbl">${speedLabel}</span>
              <span class="val text-blue val-speed">${item.speed} km/h</span>
            </div>
            <div class="metric-item">
              <span class="lbl">${curStopLabel}</span>
              <span class="val val-cur-stop">${curStopVal}</span>
            </div>
            <div class="metric-item">
              <span class="lbl">${nextStopLabel}</span>
              <span class="val text-emerald val-next-stop">${nextStopVal}</span>
            </div>
            <div class="metric-item">
              <span class="lbl">${ticketFareLabel}</span>
              <span class="val ${isFreeForThisPassenger ? 'text-emerald' : ''}" style="font-weight: 700; ${isFreeForThisPassenger ? 'color: #10b981;' : 'color: #0f172a;'}">
                ${fareVal}
              </span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 1rem;">
          <button class="btn btn-primary" style="flex: 1;" onclick="passenger.trackSelectedBus('${item.bus.id}')">
            <i data-lucide="navigation"></i> ${wimbBtnText}
          </button>
          <button class="btn btn-warning" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700; padding: 0.6rem 0.9rem; display: flex; align-items: center; gap: 4px;" onclick="window.proximityAlarm.openAlarmModal('${item.bus.id}', '${targetStop ? targetStop.id : ''}')" title="Wake Me Up Alarm">
            <i data-lucide="bell" style="width: 16px; height: 16px;"></i> <span>${alarmBtnText}</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Generates a reusable, clean Offline Bus Card HTML string
   */
  generateOfflineBusCardHtml(route, targetStop, bus, isTa, customDestName = null, customFare = null) {
    const isVetriBus = Boolean(bus && bus.isVetriPayanam);
    const targetStopName = targetStop ? (window.I18n ? window.I18n.getStopName(targetStop.name) : targetStop.name) : '';
    const statusText = isTa ? 'ஆஃப்லைன்' : 'Offline';
    const offlineTitle = isTa ? 'சேவை நிலை' : 'Service Status';
    const offlineSub = isTa ? '🔴 ஆஃப்லைன் (இயக்கத்தில் இல்லை)' : '🔴 Offline / Trip Inactive';
    const vetriBadgeText = isTa ? 'வெற்றிப் பயணம் • இலவசம்' : 'Vetri Payanam • FREE';
    const speedLabel = isTa ? 'இயங்கும் வேகம்' : 'Moving Speed';
    const curStopLabel = isTa ? 'தற்போதைய இடம்' : 'Current Location';
    const nextStopLabel = isTa ? 'அடுத்த நிறுத்தம்' : 'Next Stop';
    const ticketFareLabel = isTa ? 'பயணக் கட்டணம்' : 'Ticket Fare';
    const curStopVal = bus.currentStopName ? (window.I18n ? window.I18n.getStopName(bus.currentStopName) : bus.currentStopName) : (isTa ? 'பணிமனை / டெப்போ' : 'At Terminal / Depot');
    const wimbBtnText = isTa ? 'என் பேருந்து எங்கே?' : 'Where Is My Bus';
    const assignedRouteLabel = isTa ? 'ஒதுக்கப்பட்ட வழித்தடம்' : 'Assigned Route';

    const isFreeForThisPassenger = isVetriBus && this.gender === 'female';
    let fareVal = '';
    if (isFreeForThisPassenger) {
      fareVal = isTa ? 'வெற்றிப் பயணம் : இலவசம்' : 'Vetri Payanam : Free';
    } else if (customFare !== null && customFare !== undefined) {
      fareVal = `₹${customFare}`;
    } else if (this.selectedDestId && route) {
      const calc = this.getFare(route, targetStop ? targetStop.id : null, this.selectedDestId);
      fareVal = `₹${calc || 5}`;
    } else {
      fareVal = isTa ? '₹5 முதல்' : 'From ₹5';
    }

    const routeDisplayName = route ? (window.I18n ? window.I18n.getRouteName(route.name) : route.name) : (isTa ? 'ஒதுக்கப்படாத வழித்தடம்' : 'Unassigned Route');

    return `
      <div class="priority-card rank-other bus-card-offline" data-bus-id="${bus.id}" style="border-color: #fecaca; background: #ffffff;">
        <div>
          <div class="priority-card-header">
            <div>
              <div class="bus-num-badge" style="background: #64748b;">
                BUS ${bus.busNumber}
              </div>
              ${this.gender === 'female' && isVetriBus ? `
                <div style="margin-top: 4px;">
                  <span class="badge" style="display: inline-flex; align-items: center; gap: 4px; background: #fdf2f8; color: #db2777; border: 1px solid #fbcfe8; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                    <img src="assets/vetri-payanam-logo.png" alt="" style="width: 14px; height: 14px; object-fit: contain;">
                    ${vetriBadgeText}
                  </span>
                </div>
              ` : ''}
            </div>
            <div style="text-align: right;">
              <span class="status-pill red">
                <span class="dot" style="background: currentColor;"></span> ${statusText}
              </span>
              <div class="bus-meta-title" style="margin-top: 4px;">${bus.regNumber || (route ? route.code : '')}</div>
            </div>
          </div>

          <!-- Offline Status Callout -->
          <div class="priority-eta-box" style="background: #fef2f2; border-color: #fecaca;">
            <div class="eta-label-tag" style="color: #991b1b;">${offlineTitle}</div>
            <div class="eta-time-val" style="font-size: 1.15rem; color: #dc2626;">${offlineSub}</div>
          </div>

          <!-- Telemetry Row -->
          <div class="priority-metrics-row">
            <div class="metric-item">
              <span class="lbl">${assignedRouteLabel}</span>
              <span class="val">${route ? (route.code ? route.code + ' - ' : '') + routeDisplayName : '-'}</span>
            </div>
            <div class="metric-item">
              <span class="lbl">${speedLabel}</span>
              <span class="val text-slate">0 km/h</span>
            </div>
            <div class="metric-item">
              <span class="lbl">${curStopLabel}</span>
              <span class="val">${curStopVal}</span>
            </div>
            <div class="metric-item">
              <span class="lbl">${nextStopLabel}</span>
              <span class="val text-slate">-</span>
            </div>
            <div class="metric-item">
              <span class="lbl">${ticketFareLabel}</span>
              <span class="val ${isFreeForThisPassenger ? 'text-emerald' : ''}" style="font-weight: 700; ${isFreeForThisPassenger ? 'color: #10b981;' : 'color: #0f172a;'}">
                ${fareVal}
              </span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 1rem;">
          <button class="btn btn-primary" style="flex: 1;" onclick="passenger.trackSelectedBus('${bus.id}')">
            <i data-lucide="navigation"></i> ${wimbBtnText}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renders the Stop-to-Stop Route-free Leaderboard
   */
  renderStopToStopLeaderboard(container) {
    const isTa = window.I18n && window.I18n.getLanguage() === 'ta';
    const fromName = this.globalBoardingStopName;
    const toName = this.globalDestStopName;

    const fromDisp = fromName ? (window.I18n ? window.I18n.getStopName(fromName) : fromName) : '';
    const toDisp = toName ? (window.I18n ? window.I18n.getStopName(toName) : toName) : '';

    if (!fromName) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem; background: #fff; border-radius: 14px; text-align: center; border: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 1rem; margin: 0;">
            ${isTa ? 'பேருந்துகளைக் காண உங்கள் புறப்படும் நிறுத்தத்தைத் தேர்வு செய்யவும்.' : 'Please select your boarding stop to search available buses.'}
          </p>
        </div>
      `;
      return;
    }

    // If destination is not selected or same as boarding:
    if (!toName || fromName === toName) {
      const routes = (window.appState.routes || []).filter(r =>
        (r.stops || []).some(s => this.normalizeStopName(s.name) === this.normalizeStopName(fromName))
      );

      let activeBuses = [];
      let offlineBuses = [];
      routes.forEach(r => {
        const rBuses = window.appState.getBusesForRoute(r.id);
        const stopObj = r.stops.find(s => this.normalizeStopName(s.name) === this.normalizeStopName(fromName));
        if (stopObj) {
          const act = rBuses.filter(b => b.isTripActive && (b.status === 'Running' || b.status === 'Stopped'));
          const off = rBuses.filter(b => !act.some(ab => ab.id === b.id));
          if (act.length > 0 && window.PriorityEngine) {
            const ranked = window.PriorityEngine.rankBusesForStop(r, stopObj, act);
            ranked.forEach(item => {
              activeBuses.push({ ...item, route: r, stopObj });
            });
          }
          off.forEach(b => {
            offlineBuses.push({ bus: b, route: r, stopObj });
          });
        }
      });

      activeBuses.sort((a, b) => (a.etaMinutes || 0) - (b.etaMinutes || 0));

      if (activeBuses.length > 0) {
        let outHtml = activeBuses.map((item, idx) => {
          return this.generateBusPriorityCardHtml(item.route, item.stopObj, item, idx === 0, isTa);
        }).join('');
        if (offlineBuses.length > 0) {
          const offSecTitle = isTa ? 'தற்போது ஆஃப்லைனில் உள்ள பேருந்துகள்' : 'Currently Offline Buses';
          outHtml += `
            <div style="grid-column: 1 / -1; margin-top: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.85rem; font-weight: 700;">
              <span class="status-pill red" style="font-size: 0.72rem; padding: 2px 8px;"><span class="dot"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</span>
              <span>${offSecTitle}</span>
            </div>
          ` + offlineBuses.map(item => this.generateOfflineBusCardHtml(item.route, item.stopObj, item.bus, isTa)).join('');
        }
        container.innerHTML = outHtml;
        if (window.lucide) lucide.createIcons();
        return;
      }

      if (offlineBuses.length > 0) {
        const offNotice = isTa
          ? `"${fromDisp}" நிறுத்தத்திற்கான பேருந்துகள் தற்போது ஆஃப்லைனில் (இயக்கத்தில் இல்லை) உள்ளன:`
          : `Buses serving "${fromDisp}" are currently Offline (Trip Inactive):`;
        container.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 10px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #991b1b; font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span class="status-pill red" style="font-size: 0.72rem; padding: 2px 8px;"><span class="dot"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</span>
            <span>${offNotice}</span>
          </div>
        ` + offlineBuses.map(item => this.generateOfflineBusCardHtml(item.route, item.stopObj, item.bus, isTa)).join('');
        if (window.lucide) lucide.createIcons();
        return;
      }

      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem; background: #fff; border-radius: 14px; text-align: center; border: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 0.95rem; margin: 0;">
            ${isTa ? `"${fromDisp}" நிறுத்தத்திற்கு தற்போது நேரலை பேருந்துகள் எதுவும் வரவில்லை.` : `No active buses currently approaching "${fromDisp}". Select a destination stop to search connecting journeys.`}
          </p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Both fromName and toName are selected
    const { direct, connecting } = this.findJourneys(fromName, toName);

    // Scenario 1: Direct route(s) exist
    if (direct.length > 0) {
      const primaryDirect = direct[0];
      const fare = primaryDirect.fare || 5;

      const directRouteIds = direct.map(d => d.route.id);
      let allDirectBuses = [];
      let allDirectOfflineBuses = [];
      direct.forEach(d => {
        const routeBuses = window.appState.getBusesForRoute(d.route.id);
        const act = routeBuses.filter(b => b.isTripActive && (b.status === 'Running' || b.status === 'Stopped'));
        const off = routeBuses.filter(b => !act.some(ab => ab.id === b.id));
        if (act.length > 0 && window.PriorityEngine) {
          const ranked = window.PriorityEngine.rankBusesForStop(d.route, d.fromStop, act);
          ranked.forEach(item => {
            allDirectBuses.push({ ...item, route: d.route, stopObj: d.fromStop });
          });
        }
        off.forEach(b => {
          allDirectOfflineBuses.push({ bus: b, route: d.route, stopObj: d.fromStop });
        });
      });

      allDirectBuses.sort((a, b) => (a.etaMinutes || 0) - (b.etaMinutes || 0));

      const hasVetri = window.appState.buses.some(b => directRouteIds.includes(b.routeId) && b.isVetriPayanam);
      const isFemaleFree = this.gender === 'female' && hasVetri;

      const ticketTitle = isTa ? 'பயணக் கட்டண விவரம்' : 'Ticket Price Info';
      const fromLabel = isTa ? 'புறப்படும் இடம்:' : 'From';
      const toLabel = isTa ? 'சென்றடையும் இடம்:' : 'to';
      const freeTag = isTa ? '(மகளிர் இலவசப் பயணம்)' : '(Women Free Travel)';
      const vetriFreeText = isTa ? 'வெற்றிப் பயணம் : இலவசம்' : 'Vetri Payanam : Free';

      let ticketPriceHtml = '';
      if (isFemaleFree) {
        ticketPriceHtml = `
          <div style="grid-column: 1 / -1; background: #ecfdf5; border: 1px solid #10b981; padding: 14px 18px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="assets/vetri-payanam-logo.png" alt="Vetri Payanam" style="height: 48px; width: 44px; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));">
              <div>
                <div style="font-weight: 700; color: #065f46; font-size: 0.95rem;">${ticketTitle}</div>
                <div style="font-size: 0.85rem; color: #047857; margin-top: 2px;">
                  ${fromLabel} <strong>${fromDisp}</strong> ${toLabel} <strong>${toDisp}</strong>
                </div>
                <div style="font-size: 0.82rem; color: #047857; margin-top: 4px;">
                  ${freeTag}
                </div>
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <div style="font-size: 1.35rem; font-weight: 800; color: #059669;">
                ${vetriFreeText}
              </div>
            </div>
          </div>
        `;
      } else {
        ticketPriceHtml = `
          <div style="grid-column: 1 / -1; background: #ecfdf5; border: 1px solid #10b981; padding: 14px 18px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <div>
              <div style="font-weight: 700; color: #065f46; font-size: 0.95rem;">${ticketTitle}</div>
              <div style="font-size: 0.85rem; color: #047857; margin-top: 2px;">
                ${fromLabel} <strong>${fromDisp}</strong> ${toLabel} <strong>${toDisp}</strong>
              </div>
            </div>
            <div style="font-size: 1.5rem; font-weight: 800; color: #059669;">
              ₹${fare}
            </div>
          </div>
        `;
      }

      let cardsHtml = '';
      if (allDirectBuses.length > 0) {
        cardsHtml = allDirectBuses.map((item, idx) => {
          return this.generateBusPriorityCardHtml(item.route, item.stopObj, item, idx === 0, isTa, toName, fare);
        }).join('');
        if (allDirectOfflineBuses.length > 0) {
          const offSecTitle = isTa ? 'தற்போது ஆஃப்லைனில் உள்ள நேரடிப் பேருந்துகள்' : 'Currently Offline Direct Buses';
          cardsHtml += `
            <div style="grid-column: 1 / -1; margin-top: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.85rem; font-weight: 700;">
              <span class="status-pill red" style="font-size: 0.72rem; padding: 2px 8px;"><span class="dot"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</span>
              <span>${offSecTitle}</span>
            </div>
          ` + allDirectOfflineBuses.map(item => this.generateOfflineBusCardHtml(item.route, item.stopObj, item.bus, isTa, toName, fare)).join('');
        }
      } else if (allDirectOfflineBuses.length > 0) {
        const noActiveMsg = isTa
          ? `நேரடி வழித்தடம் (${primaryDirect.route.code}) உள்ளது. ஆனால் பேருந்துகள் தற்போது ஆஃப்லைனில் (இயக்கத்தில் இல்லை) உள்ளன:`
          : `Direct route exists (${primaryDirect.route.code} - ${primaryDirect.route.name}). Buses are currently Offline:`;
        const offlineHeader = `
          <div style="grid-column: 1 / -1; padding: 10px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #991b1b; font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span class="status-pill red" style="font-size: 0.72rem; padding: 2px 8px;"><span class="dot"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</span>
            <span>${noActiveMsg}</span>
          </div>
        `;
        cardsHtml = offlineHeader + allDirectOfflineBuses.map(item => this.generateOfflineBusCardHtml(item.route, item.stopObj, item.bus, isTa, toName, fare)).join('');
      } else {
        const noActiveMsg = isTa
          ? `நேரடி வழித்தடம் (${primaryDirect.route.code}) உள்ளது, ஆனால் தற்போது பேருந்துகள் எதுவும் இயக்கத்தில் இல்லை.`
          : `Direct route exists (${primaryDirect.route.code} - ${primaryDirect.route.name}), but no buses are currently operating on this segment.`;
        cardsHtml = `
          <div style="grid-column: 1 / -1; padding: 2rem; background: #fff; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 0.95rem; margin: 0;">${noActiveMsg}</p>
          </div>
        `;
      }

      container.innerHTML = ticketPriceHtml + cardsHtml;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Scenario 2: Connecting Route (2 Buses Transfer)
    if (connecting.length > 0) {
      const best = connecting[0];
      this.lastConnectingJourney = best;
      const interchangeDisp = window.I18n ? window.I18n.getStopName(best.interchangeName) : best.interchangeName;
      const leg1RouteName = window.I18n ? window.I18n.getRouteName(best.leg1.route.name) : best.leg1.route.name;
      const leg2RouteName = window.I18n ? window.I18n.getRouteName(best.leg2.route.name) : best.leg2.route.name;

      const leg1Buses = window.appState.getBusesForRoute(best.leg1.route.id).filter(b => Boolean(b.isTripActive && (b.status === 'Running' || b.status === 'Stopped')));
      const leg2Buses = window.appState.getBusesForRoute(best.leg2.route.id).filter(b => Boolean(b.isTripActive && (b.status === 'Running' || b.status === 'Stopped')));

      const hasVetri1 = window.appState.getBusesForRoute(best.leg1.route.id).some(b => b.isVetriPayanam);
      const hasVetri2 = window.appState.getBusesForRoute(best.leg2.route.id).some(b => b.isVetriPayanam);
      const isFemaleFree1 = this.gender === 'female' && hasVetri1;
      const isFemaleFree2 = this.gender === 'female' && hasVetri2;
      const totalFareStr = (this.gender === 'female' && isFemaleFree1 && isFemaleFree2)
        ? (isTa ? 'வெற்றிப் பயணம் : இலவசம்' : 'Vetri Payanam : Free')
        : `₹${best.totalFare}`;

      const cardBadgeText = isTa ? 'இணைப்புப் பயணம் (2 பேருந்துகள்)' : '2-Bus Connecting Journey';
      const changeBusTitle = isTa ? `${interchangeDisp} நிறுத்தத்தில் பேருந்து மாறவும்` : `Transfer at ${interchangeDisp}`;
      const changeBusSubtitle = isTa
        ? 'இந்த இரண்டு நிறுத்தங்களுக்கும் இடையே நேரடி பேருந்து இல்லை. 2 பேருந்துகளில் எளிதாகச் செல்லலாம்:'
        : 'No direct bus available between these two stops. You can easily travel with 1 transfer:';
      const totalFareLabel = isTa ? 'மொத்தக் கட்டணம்' : 'Total Fare';
      const stopsWord = isTa ? 'நிறுத்தங்கள்' : 'stops';
      const bus1Word = isTa ? 'பேருந்து 1' : 'Bus 1';
      const bus2Word = isTa ? 'பேருந்து 2' : 'Bus 2';
      const boardWord = isTa ? 'ஏறும் இடம்' : 'Board at';
      const deboardWord = isTa ? 'இறங்கும் இடம்' : 'Deboard at';
      const fareWord = isTa ? 'கட்டணம்' : 'Fare';
      const liveWord = isTa ? 'செயலில்' : 'live';
      const trackBus1Btn = isTa ? 'பேருந்து 1 முன்னுரிமை' : 'Track Bus 1';
      const trackBus2Btn = isTa ? 'பேருந்து 2 முன்னுரிமை' : 'Track Bus 2';
      const transferPrompt = isTa
        ? `⇄ ${interchangeDisp} நிறுத்தத்தில் இறங்கி பேருந்து 2-க்கு மாறவும்`
        : `⇄ Transfer at ${interchangeDisp} (Switch to Bus 2)`;

      container.innerHTML = `
        <div class="transfer-journey-card">
          <div class="transfer-header">
            <div>
              <span class="transfer-badge">
                <i data-lucide="shuffle" style="width: 14px; height: 14px;"></i> ${cardBadgeText}
              </span>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 8px 0 2px 0;">${changeBusTitle}</h3>
              <p style="font-size: 0.85rem; color: #64748b; margin: 0;">${changeBusSubtitle}</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">${totalFareLabel}</div>
              <div style="font-size: 1.4rem; font-weight: 900; color: #059669;">${totalFareStr}</div>
              <div style="font-size: 0.78rem; color: #475569;">${best.totalStops} ${stopsWord}</div>
            </div>
          </div>

          <div class="transfer-legs-wrap">
            <!-- Leg 1 -->
            <div>
              <div class="transfer-leg-box">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="background: #3b82f6; color: white; font-weight: 900; font-size: 0.95rem; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    ${best.leg1.route.code}
                  </div>
                  <div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">
                      ${bus1Word}: ${best.leg1.route.code} - ${leg1RouteName}
                    </div>
                    <div style="font-size: 0.82rem; color: #475569; margin-top: 2px;">
                      ${boardWord}: <strong>${fromDisp}</strong> ➔ ${deboardWord}: <strong>${interchangeDisp}</strong>
                    </div>
                    <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                      ${fareWord}: ${isFemaleFree1 ? (isTa ? 'இலவசம்' : 'Free') : '₹' + (best.leg1.fare || 5)} • ${leg1Buses.length} ${liveWord}
                    </div>
                  </div>
                </div>
                <div>
                  <button class="btn btn-sm btn-primary" onclick="passenger.showConnectingLegPriority(1)">
                    <i data-lucide="zap"></i> ${trackBus1Btn}
                  </button>
                </div>
              </div>
              <div id="transferLeg1PriorityArea" class="transfer-leg-priority-area" style="display: none; margin-top: 8px;"></div>
            </div>

            <!-- Interchange Divider -->
            <div class="transfer-hub-divider">
              <i data-lucide="arrow-down-up" style="width: 16px; height: 16px;"></i>
              <span>${transferPrompt}</span>
            </div>

            <!-- Leg 2 -->
            <div>
              <div class="transfer-leg-box">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="background: #8b5cf6; color: white; font-weight: 900; font-size: 0.95rem; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    ${best.leg2.route.code}
                  </div>
                  <div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">
                      ${bus2Word}: ${best.leg2.route.code} - ${leg2RouteName}
                    </div>
                    <div style="font-size: 0.82rem; color: #475569; margin-top: 2px;">
                      ${boardWord}: <strong>${interchangeDisp}</strong> ➔ ${deboardWord}: <strong>${toDisp}</strong>
                    </div>
                    <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                      ${fareWord}: ${isFemaleFree2 ? (isTa ? 'இலவசம்' : 'Free') : '₹' + (best.leg2.fare || 5)} • ${leg2Buses.length} ${liveWord}
                    </div>
                  </div>
                </div>
                <div>
                  <button class="btn btn-sm btn-primary" onclick="passenger.showConnectingLegPriority(2)">
                    <i data-lucide="zap"></i> ${trackBus2Btn}
                  </button>
                </div>
              </div>
              <div id="transferLeg2PriorityArea" class="transfer-leg-priority-area" style="display: none; margin-top: 8px;"></div>
            </div>
          </div>
        </div>
      `;
      if (this.activeConnectingLeg === 1 || this.activeConnectingLeg === 2) {
        setTimeout(() => {
          this.showConnectingLegPriority(this.activeConnectingLeg, false);
        }, 10);
      }
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Scenario 3: No direct and no connecting bus found
    const noBusTitle = isTa ? 'பேருந்து சேவை இல்லை' : 'No Direct or Connecting Bus Available';
    const noBusSub = isTa ? `"${fromDisp}" முதல் "${toDisp}" வரை பேருந்துகள் இல்லை.` : `No bus service found from "${fromDisp}" to "${toDisp}".`;
    const noBusDesc = isTa
      ? 'இந்த இரண்டு நிறுத்தங்களுக்கும் இடையே நேரடி அல்லது இணைப்பு பேருந்து வழித்தடம் தற்போது இல்லை. திசையை மாற்றிப் பார்க்கவும் அல்லது மாற்று நிறுத்தத்தைத் தேர்ந்தெடுக்கவும்.'
      : 'There is currently no direct or connecting transit route between these two stops. Try swapping the travel direction or searching another nearby stop.';
    const swapBtnText = isTa ? 'திசையை மாற்றிப் பார்க்க' : 'Swap Direction';

    container.innerHTML = `
      <div class="no-bus-alert-card">
        <div class="no-bus-alert-icon">🚫</div>
        <div class="no-bus-alert-title">${noBusTitle}</div>
        <div class="no-bus-alert-desc" style="font-weight: 700; color: #1e293b; margin-bottom: 6px;">${noBusSub}</div>
        <div class="no-bus-alert-desc">${noBusDesc}</div>
        <button class="btn btn-outline" onclick="passenger.swapGlobalStops()" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 6px; font-weight: 700;">
          <i data-lucide="arrow-left-right"></i> ${swapBtnText}
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Displays the Priority Cards for a selected connecting leg inline
   * Strictly differentiates between online (live tracking with priority card) and offline buses.
   */
  showConnectingLegPriority(legNum, shouldScroll = true) {
    if (!this.lastConnectingJourney) return;
    const isTa = window.I18n && window.I18n.getLanguage() === 'ta';
    const leg = legNum === 1 ? this.lastConnectingJourney.leg1 : this.lastConnectingJourney.leg2;
    if (!leg || !leg.route) return;

    const targetArea = document.getElementById(legNum === 1 ? 'transferLeg1PriorityArea' : 'transferLeg2PriorityArea');
    const otherArea = document.getElementById(legNum === 1 ? 'transferLeg2PriorityArea' : 'transferLeg1PriorityArea');

    if (!targetArea) return;

    // Toggle close if already open and clicked again
    if (shouldScroll && this.activeConnectingLeg === legNum && targetArea.style.display !== 'none') {
      targetArea.style.display = 'none';
      targetArea.innerHTML = '';
      this.activeConnectingLeg = null;
      return;
    }

    if (otherArea) {
      otherArea.style.display = 'none';
      otherArea.innerHTML = '';
    }

    this.activeConnectingLeg = legNum;

    const fromDisp = window.I18n ? window.I18n.getStopName(leg.fromStop.name) : leg.fromStop.name;
    const toDisp = window.I18n ? window.I18n.getStopName(leg.toStop.name) : leg.toStop.name;
    const routeDisplayName = window.I18n ? window.I18n.getRouteName(leg.route.name) : leg.route.name;

    const headerTitle = isTa
      ? `பேருந்து ${legNum} வருகை முன்னுரிமை (${leg.route.code} - ${routeDisplayName})`
      : `Bus ${legNum} Live Arrival Priority (${leg.route.code} - ${routeDisplayName})`;
    const segmentSub = isTa
      ? `புறப்படும் இடம்: <strong>${fromDisp}</strong> ➔ இறங்கும் இடம்: <strong>${toDisp}</strong>`
      : `Boarding at <strong>${fromDisp}</strong> ➔ Deboarding at <strong>${toDisp}</strong>`;
    const closeBtnText = isTa ? 'மூடு' : 'Close';

    const routeBuses = window.appState.getBusesForRoute(leg.route.id) || [];
    const activeBuses = routeBuses.filter(b => Boolean(b.isTripActive && (b.status === 'Running' || b.status === 'Stopped')));
    const offlineBuses = routeBuses.filter(b => !activeBuses.some(ab => ab.id === b.id));

    let cardsHtml = '';
    if (activeBuses.length > 0) {
      const ranked = window.PriorityEngine
        ? window.PriorityEngine.rankBusesForStop(leg.route, leg.fromStop, activeBuses)
        : activeBuses.map((b, i) => ({ bus: b, busNumber: b.busNumber, etaText: `${b.etaMinutes || 0} min`, distanceKm: b.distanceToNextKm || 0, speed: b.speed || 0, rankClass: i === 0 ? 'rank-1' : 'rank-other', crowdLevel: b.crowdLevel }));

      const lowCrowdBus = ranked.find((item) => (item.crowdLevel || 'Moderate').toLowerCase() === 'low');

      cardsHtml = ranked.map((item, idx) => {
        const isLowCrowdRecommended = lowCrowdBus && item.bus.id === lowCrowdBus.bus.id && ranked.length > 1;
        return this.generateBusPriorityCardHtml(leg.route, leg.fromStop, item, isLowCrowdRecommended, isTa, leg.toStop.name, leg.fare);
      }).join('');

      if (offlineBuses.length > 0) {
        const offSecTitle = isTa ? 'தற்போது ஆஃப்லைனில் உள்ள பேருந்துகள்' : 'Currently Offline Buses on this Leg';
        cardsHtml += `
          <div style="grid-column: 1 / -1; margin-top: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.85rem; font-weight: 700;">
            <span class="status-pill red" style="font-size: 0.72rem; padding: 2px 8px;"><span class="dot"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</span>
            <span>${offSecTitle}</span>
          </div>
        ` + offlineBuses.map(b => this.generateOfflineBusCardHtml(leg.route, leg.fromStop, b, isTa, leg.toStop.name, leg.fare)).join('');
      }
    } else if (offlineBuses.length > 0) {
      const offNotice = isTa
        ? `இந்த இணைப்பு வழித்தடப் பேருந்துகள் (${leg.route.code}) தற்போது ஆஃப்லைனில் (இயக்கத்தில் இல்லை) உள்ளன:`
        : `Buses on this route (${leg.route.code} - ${leg.route.name}) are currently Offline (Trip Inactive):`;
      cardsHtml = `
        <div style="grid-column: 1 / -1; padding: 10px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #991b1b; font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span class="status-pill red" style="font-size: 0.72rem; padding: 2px 8px;"><span class="dot"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</span>
          <span>${offNotice}</span>
        </div>
      ` + offlineBuses.map(b => this.generateOfflineBusCardHtml(leg.route, leg.fromStop, b, isTa, leg.toStop.name, leg.fare)).join('');
    } else {
      const emptyMsg = isTa
        ? 'இந்த இணைப்பு வழித்தடத்தில் தற்போது பேருந்துகள் இயக்கத்தில் இல்லை.'
        : 'No buses currently operating on this route segment.';
      cardsHtml = `
        <div style="grid-column: 1 / -1; padding: 1.5rem; background: #fff; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 0.9rem; margin: 0;">${emptyMsg}</p>
        </div>
      `;
    }

    targetArea.innerHTML = `
      <div style="background: #f8fafc; border: 1.5px solid ${legNum === 1 ? '#bfdbfe' : '#ddd6fe'}; border-radius: 14px; padding: 16px; margin-top: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: ${legNum === 1 ? '#3b82f6' : '#8b5cf6'}; color: white; font-weight: 800; font-size: 0.78rem; padding: 3px 10px; border-radius: 6px;">
                ${isTa ? `பேருந்து ${legNum}` : `BUS ${legNum}`}
              </span>
              <strong style="color: #0f172a; font-size: 1rem;">${headerTitle}</strong>
            </div>
            <div style="font-size: 0.84rem; color: #475569; margin-top: 4px;">
              ${segmentSub}
            </div>
          </div>
          <button class="btn btn-xs btn-outline" onclick="passenger.hideConnectingLegPriority(${legNum})" style="padding: 4px 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="x" style="width: 14px; height: 14px;"></i> ${closeBtnText}
          </button>
        </div>
        <div class="priority-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${cardsHtml}
        </div>
      </div>
    `;

    targetArea.style.display = 'block';
    if (window.lucide) lucide.createIcons();
    if (shouldScroll) {
      targetArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  hideConnectingLegPriority(legNum) {
    const targetArea = document.getElementById(legNum === 1 ? 'transferLeg1PriorityArea' : 'transferLeg2PriorityArea');
    if (targetArea) {
      targetArea.style.display = 'none';
      targetArea.innerHTML = '';
    }
    if (this.activeConnectingLeg === legNum) {
      this.activeConnectingLeg = null;
    }
  }

  /**
   * Renders the Multiple-Bus Arrival Priority Leaderboard
   */
  renderPriorityLeaderboard() {
    const container = document.getElementById('priorityBusesContainer');
    if (!container) return;

    if (this.currentMode === 'stopToStop') {
      this.renderStopToStopLeaderboard(container);
      return;
    }

    const route = window.appState.getRouteById(this.selectedRouteId);
    if (!route) return;

    const isTa = window.I18n && window.I18n.getLanguage() === 'ta';
    const targetStop = route.stops.find((s) => s.id === this.selectedStopId) || route.stops[0];
    const targetStopName = targetStop ? (window.I18n ? window.I18n.getStopName(targetStop.name) : targetStop.name) : '';

    // If destination is selected, validate stop ordering
    let isValidRoute = true;
    if (this.selectedDestId) {
      const boardIdx = route.stops.findIndex((s) => s.id === this.selectedStopId);
      const destIdx = route.stops.findIndex((s) => s.id === this.selectedDestId);
      if (boardIdx === -1 || destIdx === -1 || destIdx <= boardIdx) {
        isValidRoute = false;
      }
    }

    // 1. Ticket Price Info Box
    let ticketPriceHtml = '';
    if (isValidRoute && this.selectedDestId) {
      const price = this.getFare(route, this.selectedStopId, this.selectedDestId);
      if (price !== undefined && price !== null) {
        const destStop = route.stops.find(s => s.id === this.selectedDestId);
        const destStopName = destStop ? (window.I18n ? window.I18n.getStopName(destStop.name) : destStop.name) : '';
        const ticketTitle = isTa ? 'பயணக் கட்டண விவரம்' : 'Ticket Price Info';
        const fromLabel = isTa ? 'புறப்படும் இடம்:' : 'From';
        const toLabel = isTa ? 'சென்றடையும் இடம்:' : 'to';
        const vetriFreeText = isTa ? 'வெற்றிப் பயணம் : இலவசம்' : 'Vetri Payanam : Free';
        const freeTag = isTa ? '(மகளிர் இலவசப் பயணம்)' : '(Women Free Travel)';

        const routeBuses = window.appState.getBusesForRoute(route.id) || [];
        const hasVetri = routeBuses.some(b => b.isVetriPayanam);

        if (this.gender === 'female' && hasVetri) {
          ticketPriceHtml = `
            <div style="grid-column: 1 / -1; background: #ecfdf5; border: 1px solid #10b981; padding: 14px 18px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <img src="assets/vetri-payanam-logo.png" alt="Vetri Payanam" style="height: 48px; width: 44px; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));">
                <div>
                  <div style="font-weight: 700; color: #065f46; font-size: 0.95rem;">${ticketTitle}</div>
                  <div style="font-size: 0.85rem; color: #047857; margin-top: 2px;">
                    ${fromLabel} <strong>${targetStopName}</strong> ${toLabel} <strong>${destStopName}</strong>
                  </div>
                  <div style="font-size: 0.82rem; color: #047857; margin-top: 4px;">
                    ${freeTag}
                  </div>
                </div>
              </div>
              <div style="text-align: right; flex-shrink: 0;">
                <div style="font-size: 1.35rem; font-weight: 800; color: #059669;">
                  ${vetriFreeText}
                </div>
              </div>
            </div>
          `;
        } else {
          ticketPriceHtml = `
            <div style="grid-column: 1 / -1; background: #ecfdf5; border: 1px solid #10b981; padding: 14px 18px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
              <div>
                <div style="font-weight: 700; color: #065f46; font-size: 0.95rem;">${ticketTitle}</div>
                <div style="font-size: 0.85rem; color: #047857; margin-top: 2px;">
                  ${fromLabel} <strong>${targetStopName}</strong> ${toLabel} <strong>${destStopName}</strong>
                </div>
              </div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #059669;">
                ₹${price}
              </div>
            </div>
          `;
        }
      }
    }

    // 2. Bus Cards Generation
    const allRouteBuses = window.appState.getBusesForRoute(this.selectedRouteId);
    const activeRouteBuses = allRouteBuses.filter(b => Boolean(b.isTripActive && (b.status === 'Running' || b.status === 'Stopped')));
    const offlineRouteBuses = allRouteBuses.filter(b => !activeRouteBuses.some(ab => ab.id === b.id));

    let smartSuggestionHtml = '';
    let cardsHtml = '';

    if (activeRouteBuses.length > 0) {
      const ranked = PriorityEngine.rankBusesForStop(route, targetStop, activeRouteBuses);
      const firstBus = ranked[0];
      const lowCrowdBus = ranked.find((item) => (item.crowdLevel || 'Moderate').toLowerCase() === 'low');

      if (lowCrowdBus && firstBus && lowCrowdBus.bus.id !== firstBus.bus.id && (firstBus.crowdLevel || 'Moderate').toLowerCase() !== 'low') {
        const smartTitle = isTa ? 'பயணக் குறிப்பு: இதே வழித்தடத்தில் குறைந்த கூட்டமுள்ள பேருந்து வருகிறது!' : 'Smart Travel Tip: Low Crowd Bus on Same Route!';
        const smartSeats = isTa ? 'பேருந்தில் 🟢 இருக்கைகள் காலியாக உள்ளன. வந்து சேரும் நேரம்:' : 'has 🟢 Seats Available (Low Crowd) arriving in';
        const smartPeaceful = isTa ? 'அமைதியான பயணத்திற்கு இப்பேருந்தை பயன்படுத்தவும்!' : 'Take this bus for a peaceful ride!';
        const smartTrackBtn = isTa ? 'பேருந்தைக் காண்க' : 'Track BUS';

        smartSuggestionHtml = `
          <div class="smart-crowd-alert" style="grid-column: 1 / -1;">
            <div class="smart-crowd-alert-left">
              <div class="smart-crowd-badge-icon">
                <i data-lucide="sparkles"></i>
              </div>
              <div>
                <div class="smart-crowd-title">
                  <span>${smartTitle}</span>
                </div>
                <div class="smart-crowd-desc">
                  <strong>BUS ${lowCrowdBus.busNumber}</strong> ${smartSeats} <strong>${lowCrowdBus.etaText}</strong> (${lowCrowdBus.distanceKm} km). ${smartPeaceful}
                </div>
              </div>
            </div>
            <button class="smart-crowd-btn" onclick="passenger.trackSelectedBus('${lowCrowdBus.bus.id}')">
              <i data-lucide="navigation"></i> ${smartTrackBtn} ${lowCrowdBus.busNumber}
            </button>
          </div>
        `;
      }

      cardsHtml = ranked.map((item) => {
        const isLowCrowdRecommended = lowCrowdBus && item.bus.id === lowCrowdBus.bus.id && ranked.length > 1;
        return this.generateBusPriorityCardHtml(route, targetStop, item, isLowCrowdRecommended, isTa);
      }).join('');

      if (offlineRouteBuses.length > 0) {
        const offlineSecTitle = isTa ? 'தற்போது ஆஃப்லைனில் உள்ள பேருந்துகள்' : 'Offline Buses on this Route';
        cardsHtml += `
          <div style="grid-column: 1 / -1; margin-top: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.85rem; font-weight: 700;">
            <span class="status-pill red" style="font-size: 0.72rem; padding: 2px 8px;"><span class="dot"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</span>
            <span>${offlineSecTitle}</span>
          </div>
        ` + offlineRouteBuses.map(b => this.generateOfflineBusCardHtml(route, targetStop, b, isTa)).join('');
      }
    } else if (allRouteBuses.length > 0) {
      const offlineNotice = isTa
        ? 'இந்த வழித்தடப் பேருந்துகள் தற்போது ஆஃப்லைனில் (இயக்கத்தில் இல்லை) உள்ளன:'
        : 'Buses assigned to this route are currently Offline (Trip Inactive):';
      const offlineHeader = `
        <div style="grid-column: 1 / -1; padding: 10px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #991b1b; font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span class="status-pill red" style="font-size: 0.72rem; padding: 2px 8px;"><span class="dot"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</span>
          <span>${offlineNotice}</span>
        </div>
      `;
      cardsHtml = offlineHeader + allRouteBuses.map(b => this.generateOfflineBusCardHtml(route, targetStop, b, isTa)).join('');
    } else {
      const emptyMsg = isTa
        ? 'இந்த வழித்தடத்தில் தற்போது எந்த பேருந்தும் இயக்கத்தில் இல்லை.'
        : 'No buses currently operating or assigned to this route segment.';
      cardsHtml = `
        <div style="grid-column: 1 / -1; padding: 2rem; background: #fff; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 0.95rem;">${emptyMsg}</p>
        </div>
      `;
    }

    container.innerHTML = ticketPriceHtml + smartSuggestionHtml + cardsHtml;

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  /**
   * Fast in-place telemetry update for Live Bus Arrival Priority cards.
   * Completely avoids DOM destruction, eliminating flickering and disappearing cards.
   */
  updateLiveArrivalsInPlace() {
    const container = document.getElementById('priorityBusesContainer');
    if (!container) return;

    const portal = document.getElementById('portalPassenger');
    if (portal && portal.style.display === 'none') return;

    const isTa = window.I18n && window.I18n.getLanguage() === 'ta';

    if (this.currentMode === 'stopToStop') {
      const existingCards = container.querySelectorAll('.priority-card[data-bus-id]');
      if (existingCards.length === 0) return;

      existingCards.forEach(card => {
        const busId = card.getAttribute('data-bus-id');
        const bus = window.appState.getBusById(busId);
        if (!bus) return;

        const etaElem = card.querySelector('.eta-time-val');
        if (etaElem && bus.etaMinutes != null) {
          const etaText = bus.etaMinutes <= 1 ? (isTa ? 'இப்போது ⚡' : 'Arriving Now ⚡') : `${bus.etaMinutes} min`;
          if (etaElem.textContent !== etaText) etaElem.textContent = etaText;
        }

        const distElem = card.querySelector('.val-dist');
        if (distElem && bus.distanceToNextKm != null) {
          const text = `${bus.distanceToNextKm} km`;
          if (distElem.textContent !== text) distElem.textContent = text;
        }

        const speedElem = card.querySelector('.val-speed');
        if (speedElem && bus.speed != null) {
          const text = `${bus.speed} km/h`;
          if (speedElem.textContent !== text) speedElem.textContent = text;
        }
      });
      return;
    }

    const route = window.appState.getRouteById(this.selectedRouteId);
    if (!route) return;

    const targetStop = route.stops.find((s) => s.id === this.selectedStopId) || route.stops[0];
    if (!targetStop) return;

    const allRouteBuses = window.appState.getBusesForRoute(this.selectedRouteId);
    const activeRouteBuses = allRouteBuses.filter(b => Boolean(b.isTripActive && (b.status === 'Running' || b.status === 'Stopped')));

    // If active bus count or total bus count changed between online/offline, do full render
    const existingCards = container.querySelectorAll('.priority-card[data-bus-id]');
    const existingActiveCards = container.querySelectorAll('.priority-card[data-bus-id]:not(.bus-card-offline)');
    if (activeRouteBuses.length !== existingActiveCards.length || existingCards.length !== allRouteBuses.length) {
      this.renderPriorityLeaderboard();
      this.renderFleetGrid();
      return;
    }

    const ranked = PriorityEngine.rankBusesForStop(route, targetStop, activeRouteBuses);
    const existingBusIds = Array.from(existingActiveCards).map(el => el.getAttribute('data-bus-id'));
    const newBusIds = ranked.map(r => r.bus.id);

    // If bus ranking order changed (e.g. Bus 2 overtook Bus 1, or bus arrived at stop), rebuild cards cleanly
    const isSameOrder = existingBusIds.length === newBusIds.length &&
      existingBusIds.every((id, idx) => id === newBusIds[idx]);

    if (!isSameOrder) {
      this.renderPriorityLeaderboard();
      this.renderFleetGrid();
      return;
    }

    // Identical ranking order: update dynamic values in-place (Zero Flicker!)
    ranked.forEach((item, index) => {
      const card = existingActiveCards[index];
      if (!card) return;

      const etaElem = card.querySelector('.eta-time-val');
      if (etaElem && etaElem.textContent !== item.etaText) {
        etaElem.textContent = item.etaText;
      }

      const distElem = card.querySelector('.val-dist');
      if (distElem) {
        const text = `${item.distanceKm} km`;
        if (distElem.textContent !== text) distElem.textContent = text;
      }

      const speedElem = card.querySelector('.val-speed');
      if (speedElem) {
        const text = `${item.speed} km/h`;
        if (speedElem.textContent !== text) speedElem.textContent = text;
      }

      const curStopVal = item.currentStopName ? (window.I18n ? window.I18n.getStopName(item.currentStopName) : item.currentStopName) : (isTa ? 'பயணத்தில் உள்ளது' : 'On Route');
      const curStopElem = card.querySelector('.val-cur-stop');
      if (curStopElem && curStopElem.textContent !== curStopVal) {
        curStopElem.textContent = curStopVal;
      }

      const nextStopVal = item.nextStopName ? (window.I18n ? window.I18n.getStopName(item.nextStopName) : item.nextStopName) : (isTa ? 'வழியில் உள்ளது' : 'En route');
      const nextStopElem = card.querySelector('.val-next-stop');
      if (nextStopElem && nextStopElem.textContent !== nextStopVal) {
        nextStopElem.textContent = nextStopVal;
      }

      const crowdLvl = item.crowdLevel || 'Moderate';
      const crowdTranslated = isTa ? (window.I18n ? window.I18n.t('crowd' + crowdLvl, crowdLvl) : crowdLvl) : crowdLvl;
      const crowdWord = isTa ? 'கூட்டம்' : 'Crowd';
      const crowdElem = card.querySelector('.val-crowd');
      if (crowdElem) {
        const crowdFull = `${crowdTranslated} ${crowdWord}`;
        if (crowdElem.textContent !== crowdFull) crowdElem.textContent = crowdFull;
      }
    });

    if (window.app && typeof window.app.updateActiveBusesBadge === 'function') {
      window.app.updateActiveBusesBadge();
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
    if (window.app && typeof window.app.updateActiveBusesBadge === 'function') {
      window.app.updateActiveBusesBadge();
    }

    const isTa = window.I18n && window.I18n.getLanguage() === 'ta';

    if (buses.length === 0) {
      const emptyText = isTa ? 'தேடல் நிபந்தனைகளுக்கு ஏற்ற பேருந்துகள் இல்லை.' : 'No buses matching your filter criteria.';
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; background: #fff; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 0.95rem;">${emptyText}</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = buses.map((bus) => {
      const route = window.appState.getRouteById(bus.routeId);
      const isOnline = Boolean(bus.isTripActive && (bus.status === 'Running' || bus.status === 'Stopped'));
      const isRunning = isOnline && bus.status === 'Running';
      const statusClass = isRunning ? 'green' : (isOnline && bus.status === 'Stopped' ? 'amber' : 'red');
      const statusText = isOnline
        ? (isRunning ? (isTa ? 'இயங்குகிறது' : 'Running') : (isTa ? 'நிறுத்தப்பட்டுள்ளது' : 'Stopped'))
        : (isTa ? 'ஆஃப்லைன்' : 'Offline');

      let crowdLvl = bus.crowdLevel || 'Moderate';
      let crowdClass = crowdLvl.toLowerCase();

      let crowdBadgeHtml = `
                <span class="crowd-pill ${crowdClass}">
                  ${crowdLvl}
                </span>`;
      let liveSpeedHtml = `<span class="val text-blue">${bus.speed || 0} km/h</span>`;
      let nextStopHtml = `<span class="val">${bus.nextStopName || 'N/A'}</span>`;
      const isArrivingNext = bus.etaMinutes <= 1 || (bus.distanceToNextKm != null && bus.distanceToNextKm <= 0.45);
      let nextEtaHtml = isArrivingNext
        ? `<span class="val text-blue" style="font-weight: 800;">⚡ ${isTa ? 'இப்போது வந்து சேரும்' : 'Arriving Now'} (${bus.distanceToNextKm || 0} km)</span>`
        : `<span class="val text-emerald">${bus.etaMinutes || 0} min (${bus.distanceToNextKm || 0} km)</span>`;
      let crowdStatusHtml = `<span class="val text-primary" style="font-weight: 700;">${crowdLvl}</span>`;

      if (!isOnline) {
        crowdBadgeHtml = `<span style="color: #94a3b8; font-weight: 600;">-</span>`;
        liveSpeedHtml = `<span class="val text-slate" style="font-weight: 400;">0 km/h</span>`;
        nextStopHtml = `<span class="val text-slate" style="font-weight: 400;">-</span>`;
        nextEtaHtml = `<span class="val text-slate" style="font-weight: 400;">-</span>`;
        crowdStatusHtml = `<span class="val text-slate" style="font-weight: 400;">-</span>`;
      }

      const routeName = route ? (window.I18n ? window.I18n.getRouteName(route.name) : route.name) : (isTa ? 'ஒதுக்கப்படாத வழித்தடம்' : 'Unassigned Route');
      const speedLbl = isTa ? 'இயங்கும் வேகம்' : 'Live Speed';
      const nextStopLbl = isTa ? 'அடுத்த நிறுத்தம்' : 'Next Stop';
      const nextEtaLbl = isTa ? 'அடுத்த வருகை' : 'Next ETA';
      const crowdLblText = isTa ? 'கூட்ட நிலை' : 'Crowd Status';
      const trackRadarText = isTa ? 'நேரடி ரேடாரில் காண்க' : 'Track on Live Radar';
      const alarmText = isTa ? 'அலாரம்' : 'Alarm';

      return `
        <div class="fleet-card ${!isOnline ? 'fleet-card-offline' : ''}" onclick="passenger.trackSelectedBus('${bus.id}')" style="cursor: pointer; ${!isOnline ? 'border-color: #fecaca;' : ''}">
          <div>
            <div class="fleet-card-header">
              <div class="bus-num-badge" style="font-size: 1.1rem; padding: 0.25rem 0.6rem; ${!isOnline ? 'background: #64748b;' : ''}">
                BUS ${bus.busNumber}
              </div>
              <div style="display: flex; gap: 0.4rem; align-items: center;">
                ${crowdBadgeHtml}
                <span class="status-pill ${statusClass}">
                  <span class="dot" style="background: currentColor;"></span> ${statusText}
                </span>
              </div>
            </div>

            <div style="font-size: 0.92rem; font-weight: 700; color: #0f172a; margin-bottom: 0.2rem;">
              ${routeName}
            </div>
            <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 0.85rem;">
              Reg: ${bus.regNumber} • Bus: ${bus.BusName}
            </div>

            ${bus.delayAlert ? `
              <div style="background: #fef3c7; color: #92400e; font-size: 0.74rem; font-weight: 700; padding: 4px 8px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #fde68a;">
                ⚠️ Notice: ${bus.delayAlert}
              </div>
            ` : ''}

            <div class="priority-metrics-row mb-2">
              <div class="metric-item">
                <span class="lbl">${speedLbl}</span>
                ${liveSpeedHtml}
              </div>
              <div class="metric-item">
                <span class="lbl">${nextStopLbl}</span>
                ${nextStopHtml}
              </div>
              <div class="metric-item">
                <span class="lbl">${nextEtaLbl}</span>
                ${nextEtaHtml}
              </div>
              <div class="metric-item">
                <span class="lbl">${crowdLblText}</span>
                ${crowdStatusHtml}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid #f1f5f9; font-size: 0.8rem; font-weight: 700;">
            <span style="color: ${!isOnline ? '#64748b' : '#2563eb'}; display: flex; align-items: center; gap: 4px;">
              ${trackRadarText} <i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i>
            </span>
            <button class="btn btn-xs btn-warning" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700; padding: 3px 8px;" onclick="event.stopPropagation(); window.proximityAlarm.openAlarmModal('${bus.id}')" title="Set Arrival Alarm">
              <i data-lucide="bell" style="width: 12px; height: 12px;"></i> ${alarmText}
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
