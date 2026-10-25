/**
 * AdminController: Fleet Management, Live Radar, Route & Stop Sequence Builder
 */
class AdminController {
  constructor() {
    this.fleetMap = null;
    this.activeRouteFilter = 'all';
    this.activeBusFilter = 'all';
    this.selectedRouteTab = null;
    this.searchQuery = '';
    this._routesRendered = false;

    window.appState.subscribe((state, event) => {
      // On GPS poll update — only update moving bus markers (fast, smooth)
      if (event && event.type === 'BUS_LOCATION_UPDATE') {
        this.renderBusMarkersOnly();
        this.renderBusTable();
      } else {
        // Full render for fleet changes, init, etc.
        this._routesRendered = false;
        this.render();
      }
    });
  }

  init() {
    if (!this.fleetMap) {
      this.fleetMap = new MapManager('adminFleetMap', { zoom: 13, center: [8.7250, 77.7200] });
    }

    this.populateMapFilter();
    this.populateRouteFormRoutes();
    this.render();

    // Start on Overview section
    this.switchSection('overview');
  }

  /**
   * Switches the active admin dashboard section via sidebar navigation
   */
  switchSection(section) {
    this.activeSection = section;

    const sections = ['overview', 'buses', 'routes', 'stops'];
    sections.forEach((s) => {
      const el = document.getElementById(`adminSection${s.charAt(0).toUpperCase() + s.slice(1)}`);
      const btn = document.getElementById(`adminNav${s.charAt(0).toUpperCase() + s.slice(1)}`);
      if (el) el.style.display = s === section ? 'block' : 'none';
      if (btn) btn.classList.toggle('active', s === section);
    });

    // Trigger map invalidation if switching to overview (map needs resize)
    if (section === 'overview' && this.fleetMap) {
      setTimeout(() => this.fleetMap.invalidateSize(), 150);
    }

    // Render section-specific content
    if (section === 'routes') this.renderRouteCards();
    if (section === 'stops') this.renderStopsSection();

    if (window.lucide) lucide.createIcons();
  }

  populateMapFilter() {
    const routeSelect = document.getElementById('adminMapRouteFilter');
    if (routeSelect) {
      routeSelect.innerHTML = `
        <option value="all">Show All Routes</option>
        ${window.appState.routes.map((r) => `
          <option value="${r.id}" ${r.id === this.activeRouteFilter ? 'selected' : ''}>
            ${r.name}
          </option>
        `).join('')}
      `;
    }

    const busSelect = document.getElementById('adminMapBusFilter');
    if (busSelect) {
      // Show all buses, or just those matching active route filter? Let's show all, but filter if route selected.
      let filteredBuses = window.appState.buses;
      if (this.activeRouteFilter !== 'all') {
        filteredBuses = filteredBuses.filter(b => b.routeId === this.activeRouteFilter);
      }
      busSelect.innerHTML = `
        <option value="all">Show All Buses</option>
        ${filteredBuses.map((b) => `
          <option value="${b.id}" ${b.id === this.activeBusFilter ? 'selected' : ''}>
            ${b.name || b.id}
          </option>
        `).join('')}
      `;
    }
  }

  populateRouteFormRoutes(selectedIds = []) {
    const container = document.getElementById('busFormRouteCheckboxes');
    const select = document.getElementById('busFormRoute');
    if (!container && !select) return;

    const routes = window.appState.routes || [];

    if (select) {
      select.innerHTML = routes.map((r) => `
        <option value="${r.id}" ${selectedIds.includes(r.id) ? 'selected' : ''}>${r.name}</option>
      `).join('');
    }

    if (container) {
      if (routes.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 0.85rem; padding: 4px;">No routes available. Create a route first.</div>';
        return;
      }
      container.innerHTML = routes.map((r) => {
        const isChecked = selectedIds.includes(r.id);
        return `
          <label class="route-checkbox-item" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; background: ${isChecked ? '#eff6ff' : '#ffffff'}; border: 1px solid ${isChecked ? '#3b82f6' : '#e2e8f0'}; cursor: pointer; user-select: none; transition: all 0.15s ease;">
            <input type="checkbox" value="${r.id}" ${isChecked ? 'checked' : ''} onchange="admin.onRouteCheckboxToggle(this)" style="cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb;">
            <span class="badge" style="background: ${r.color || '#2563eb'}22; color: ${r.color || '#2563eb'}; font-weight: 700; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">${r.code}</span>
            <span style="font-size: 0.88rem; font-weight: ${isChecked ? '600' : '400'}; color: #1e293b;">${r.name}</span>
          </label>
        `;
      }).join('');
    }
  }

  onRouteCheckboxToggle(checkbox) {
    const item = checkbox.closest('.route-checkbox-item');
    if (item) {
      item.style.background = checkbox.checked ? '#eff6ff' : '#ffffff';
      item.style.borderColor = checkbox.checked ? '#3b82f6' : '#e2e8f0';
      const labelText = item.querySelector('span:last-child');
      if (labelText) labelText.style.fontWeight = checkbox.checked ? '600' : '400';
    }
    const select = document.getElementById('busFormRoute');
    if (select) {
      Array.from(select.options).forEach(opt => {
        if (opt.value === checkbox.value) opt.selected = checkbox.checked;
      });
    }
  }

  onMapFilterChange(val) {
    this.activeRouteFilter = val;
    this.activeBusFilter = 'all'; // Reset bus filter when route changes
    this.populateMapFilter(); // Re-populate bus dropdown
    this._routesRendered = false; // Force map to redraw routes
    if (this.fleetMap) {
      this.fleetMap.clearStops(); // Clear existing route stops from map
    }
    this.renderFleetMap();
  }

  onMapBusFilterChange(val) {
    this.activeBusFilter = val;
    this.renderFleetMap();
  }

  filterBusTable(val) {
    this.searchQuery = val.trim().toLowerCase();
    this.renderBusTable();
  }

  render() {
    this.populateMapFilter();
    this.renderKpis();
    this.renderFleetMap();
    this.renderBusTable();
    this.renderRoutePlanner();
  }

  renderKpis() {
    const totalBuses = document.getElementById('kpiTotalBuses');
    const activeBuses = document.getElementById('kpiActiveBuses');
    const totalRoutes = document.getElementById('kpiTotalRoutes');
    const totalStops = document.getElementById('kpiTotalStops');

    const running = window.app && typeof window.app.getActiveLiveBusesCount === 'function'
      ? window.app.getActiveLiveBusesCount()
      : window.appState.buses.filter((b) => b.isTripActive && b.status === 'Running').length;
    let stopCount = 0;
    window.appState.routes.forEach((r) => { stopCount += (r.stops || []).length; });

    if (totalBuses) totalBuses.textContent = window.appState.buses.length;
    if (activeBuses) activeBuses.textContent = running;
    if (totalRoutes) totalRoutes.textContent = window.appState.routes.length;
    if (totalStops) totalStops.textContent = stopCount;

    if (window.app && typeof window.app.updateActiveBusesBadge === 'function') {
      window.app.updateActiveBusesBadge();
    }
  }

  renderFleetMap() {
    if (!this.fleetMap) return;

    // Only redraw route stops once (or when filter changes) — expensive operation
    if (!this._routesRendered) {
      this.fleetMap.clearStops();
      const routesToRender = this.activeRouteFilter === 'all'
        ? window.appState.routes
        : window.appState.routes.filter((r) => r.id === this.activeRouteFilter);

      routesToRender.forEach((route) => {
        const busesOnRoute = window.appState.getBusesForRoute(route.id);
        this.fleetMap.renderRouteStops(route, busesOnRoute);
      });
      this._routesRendered = true;
    }

    this.renderBusMarkersOnly();
    this.fleetMap.invalidateSize();
  }

  renderBusMarkersOnly() {
    if (!this.fleetMap) return;

    let busesToRender = this.activeRouteFilter === 'all'
      ? window.appState.buses
      : window.appState.buses.filter((b) => b.routeId === this.activeRouteFilter);

    if (this.activeBusFilter !== 'all') {
      busesToRender = busesToRender.filter((b) => b.id === this.activeBusFilter);
    }

    const renderIds = new Set(busesToRender.map(b => b.id));

    // Update or add valid buses
    busesToRender.forEach((bus) => {
      this.fleetMap.updateBusMarker(bus, false, false);
    });

    // Remove buses not in the current filter
    window.appState.buses.forEach((bus) => {
      if (!renderIds.has(bus.id) && this.fleetMap.busMarkers && this.fleetMap.busMarkers.has(bus.id)) {
        this.fleetMap.busMarkers.get(bus.id).remove();
        this.fleetMap.busMarkers.delete(bus.id);
      }
    });
  }

  renderBusTable() {
    const tbody = document.getElementById('adminBusTableBody');
    if (!tbody) return;

    let buses = window.appState.buses;
    if (this.searchQuery) {
      buses = buses.filter((b) =>
        b.busNumber.toLowerCase().includes(this.searchQuery) ||
        b.regNumber.toLowerCase().includes(this.searchQuery) ||
        (b.BusName && b.BusName.toLowerCase().includes(this.searchQuery))
      );
    }

    tbody.innerHTML = buses.map((bus) => {
      const route = window.appState.getRouteById(bus.routeId);
      const isRunning = bus.status === 'Running';
      const statusClass = isRunning ? 'green' : (bus.status === 'Stopped' ? 'amber' : 'red');
      const crowdLvl = bus.crowdLevel || 'Moderate';
      const crowdClass = crowdLvl.toLowerCase();

      return `
        <tr>
          <td>
            <strong style="color: #2563eb;">BUS ${bus.busNumber}</strong>
            ${bus.isVetriPayanam ? `<div style="margin-top: 3px;"><span class="status-pill blue" style="font-size: 0.65rem; padding: 1px 6px;">Vetri Payanam</span></div>` : ''}
          </td>
          <td><code>${bus.regNumber}</code></td>
          <td>
            ${(bus.assignedRouteIds && bus.assignedRouteIds.length > 0)
                ? bus.assignedRouteIds.map(rid => {
                    const r = window.appState.getRouteById(rid);
                    return r ? `<div style="margin-bottom: 4px; display: flex; align-items: center; gap: 5px;"><span class="badge" style="background: ${r.color || '#2563eb'}22; color: ${r.color || '#2563eb'}; font-size: 0.72rem; font-weight: 700; padding: 1px 6px; border-radius: 4px;">${r.code}</span> <span>${r.name}</span></div>` : '';
                  }).join('')
                : (route ? `<div>${route.name}</div>` : '<div style="color: #94a3b8;">Unassigned</div>')
            }
          </td>
          <td>${bus.BusName || 'N/A'}</td>
          <td>
            ${bus.status !== 'Offline' ? `
            <span class="crowd-pill ${crowdClass}">
              ${crowdLvl}
            </span>
            ` : `<span style="color: #94a3b8;">-</span>`}
          </td>
          <td>
            <span class="status-pill ${statusClass}">
              ${bus.status}
            </span>
          </td>
          <td>${bus.status !== 'Offline' ? `<strong class="text-blue">${bus.speed || 0} km/h</strong>` : `<span style="color: #94a3b8;">-</span>`}</td>
          <td>${bus.status !== 'Offline' ? (bus.currentStopName || 'On Route') : `<span style="color: #94a3b8;">-</span>`}</td>
          <td>${bus.status !== 'Offline' ? (bus.nextStopName || 'N/A') : `<span style="color: #94a3b8;">-</span>`}</td>
          <td>${bus.status !== 'Offline' ? `<strong class="text-emerald">${bus.etaMinutes || 0} min</strong>` : `<span style="color: #94a3b8;">-</span>`}</td>
          <td>${bus.status !== 'Offline' ? `${bus.routeProgress || 0}%` : `<span style="color: #94a3b8;">-</span>`}</td>
          <td>${bus.status !== 'Offline' ? `<small class="text-muted">${bus.lastUpdated ? 'Live' : 'Cached'}</small>` : `<span style="color: #94a3b8;">-</span>`}</td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-xs btn-outline" onclick="admin.editBus('${bus.id}')" title="Edit Bus">
                <i data-lucide="edit"></i>
              </button>
              <button class="btn btn-xs btn-danger" onclick="admin.deleteBusPrompt('${bus.id}')" title="Delete Bus">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  renderRoutePlanner() {
    const tabsContainer = document.getElementById('adminRouteTabs');
    const plannerBody = document.getElementById('routePlannerBody');
    if (!tabsContainer || !plannerBody) return;

    // Route Tabs
    tabsContainer.innerHTML = window.appState.routes.map((r) => `
      <button class="btn btn-sm ${r.id === this.selectedRouteTab ? 'btn-primary' : 'btn-outline'}" onclick="admin.selectRouteTab('${r.id}')">
        ${r.code} - ${r.name.split('-')[1] || r.name}
      </button>
    `).join('');

    const route = window.appState.getRouteById(this.selectedRouteTab);
    if (!route) return;

    plannerBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <h3 style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${route.name}</h3>
          <p style="font-size: 0.8rem; color: #64748b;">${route.stops.length} stops arranged in driving sequence. Reorder or add stops below.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="admin.openDrawRouteModal('${route.id}')">
            <i data-lucide="pen-tool"></i> Draw Route on Map
          </button>
          <button class="btn btn-primary btn-sm" onclick="admin.openAddStopModal('${route.id}')">
            <i data-lucide="plus"></i> Add Stop to Route
          </button>
        </div>
      </div>

      <div class="route-stops-sequence-list">
        ${route.stops.map((stop, idx) => `
          <div class="route-stop-row">
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <div class="stop-seq-num">${stop.sequence || idx + 1}</div>
              <div>
                <div style="font-weight: 700; color: #0f172a;">${stop.name}</div>
                <div style="font-size: 0.75rem; color: #64748b;">GPS: ${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)} • Geofence Radius: 80m</div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <button class="btn btn-xs btn-outline" onclick="admin.moveStop('${route.id}', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">
                <i data-lucide="arrow-up"></i>
              </button>
              <button class="btn btn-xs btn-outline" onclick="admin.moveStop('${route.id}', ${idx}, 1)" ${idx === route.stops.length - 1 ? 'disabled' : ''} title="Move Down">
                <i data-lucide="arrow-down"></i>
              </button>
              <button class="btn btn-xs btn-danger" onclick="admin.deleteStop('${route.id}', '${stop.id}')" title="Delete Stop">
                <i data-lucide="x"></i>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  selectRouteTab(routeId) {
    this.selectedRouteTab = routeId;
    this.renderRoutePlanner();
  }

  moveStop(routeId, index, direction) {
    const route = window.appState.getRouteById(routeId);
    if (!route || !route.stops) return;

    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= route.stops.length) return;

    const temp = route.stops[index];
    route.stops[index] = route.stops[targetIdx];
    route.stops[targetIdx] = temp;

    // Resequence
    route.stops.forEach((s, i) => { s.sequence = i + 1; });
    window.appState.saveRoute(route);
    window.app.showToast('Stop sequence reordered.', 'success');
  }

  deleteStop(routeId, stopId) {
    const route = window.appState.getRouteById(routeId);
    if (!route) return;

    route.stops = route.stops.filter((s) => s.id !== stopId);
    route.stops.forEach((s, i) => { s.sequence = i + 1; });
    window.appState.saveRoute(route);
    window.app.showToast('Stop removed from route.', 'info');
  }

  // Modals & CRUD
  openAddBusModal() {
    document.getElementById('busModalTitle').textContent = 'Add New Bus';
    document.getElementById('busFormId').value = '';
    document.getElementById('busFormNumber').value = '';
    document.getElementById('busFormReg').value = '';
    document.getElementById('busFormBus').value = '';
    document.getElementById('busFormPhone').value = '';
    document.getElementById('busFormLoginEmail').value = '';
    document.getElementById('busFormLoginPassword').value = '';
    const vpCheck = document.getElementById('busFormVetriPayanam');
    if (vpCheck) vpCheck.checked = false;
    const defaultSelected = window.appState.routes.length > 0 ? [window.appState.routes[0].id] : [];
    this.populateRouteFormRoutes(defaultSelected);
    document.getElementById('busModal').classList.add('active');
  }

  editBus(busId) {
    const bus = window.appState.getBusById(busId);
    if (!bus) return;

    document.getElementById('busModalTitle').textContent = `Edit BUS ${bus.busNumber}`;
    document.getElementById('busFormId').value = bus.id;
    document.getElementById('busFormNumber').value = bus.busNumber;
    document.getElementById('busFormReg').value = bus.regNumber;
    document.getElementById('busFormBus').value = bus.BusName || bus.name || '';
    document.getElementById('busFormPhone').value = bus.BusPhone || bus.conductorPhone || '';
    
    // Find associated user for login email
    const busUser = window.appState.users.find(u => u.busId === bus.id);
    document.getElementById('busFormLoginEmail').value = busUser ? busUser.email : '';
    document.getElementById('busFormLoginPassword').value = '';
    
    const vpCheck = document.getElementById('busFormVetriPayanam');
    if (vpCheck) vpCheck.checked = Boolean(bus.isVetriPayanam);
    
    const assigned = Array.isArray(bus.assignedRouteIds)
      ? bus.assignedRouteIds
      : (bus.routeId ? [bus.routeId] : []);
    this.populateRouteFormRoutes(assigned);
    document.getElementById('busModal').classList.add('active');
  }

  closeBusModal() {
    document.getElementById('busModal').classList.remove('active');
  }

  async saveBus(event) {
    event.preventDefault();
    const id = document.getElementById('busFormId').value;
    const busNumber = document.getElementById('busFormNumber').value.trim();
    const regNumber = document.getElementById('busFormReg').value.trim();
    
    // Retrieve all selected routes from checkboxes or select
    const container = document.getElementById('busFormRouteCheckboxes');
    let assignedRouteIds = [];
    if (container) {
      assignedRouteIds = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    } else {
      const routeSelect = document.getElementById('busFormRoute');
      if (routeSelect) {
        assignedRouteIds = Array.from(routeSelect.selectedOptions).map(o => o.value);
      }
    }
    if (assignedRouteIds.length === 0) {
      window.app.showToast('Please select at least one route for this bus.', 'warning');
      return;
    }
    
    const BusName = document.getElementById('busFormBus').value.trim();
    const BusPhone = document.getElementById('busFormPhone').value.trim();
    const loginEmail = document.getElementById('busFormLoginEmail').value.trim();
    const loginPassword = document.getElementById('busFormLoginPassword').value.trim();
    const isVetriPayanam = document.getElementById('busFormVetriPayanam') ? document.getElementById('busFormVetriPayanam').checked : false;
    
    // Retrieve existing bus or set defaults for tracking info
    const existingBus = window.appState.getBusById(id || `BUS-${busNumber}`);
    const status = existingBus ? existingBus.status : 'Offline';
    const crowdLevel = existingBus ? existingBus.crowdLevel : 'Moderate';

    let routeId = assignedRouteIds[0] || '';
    if (existingBus && assignedRouteIds.includes(existingBus.routeId)) {
      routeId = existingBus.routeId;
    }

    const route = window.appState.getRouteById(routeId);
    const firstStop = route && route.stops.length > 0 ? route.stops[0] : null;

    const busPayload = {
      id: id || `BUS-${busNumber}`,
      busNumber,
      regNumber,
      routeId,
      assignedRouteIds,
      isVetriPayanam,
      BusName,
      name: BusName,
      BusPhone,
      conductorPhone: BusPhone,
      conductorName: BusName,
      loginEmail,
      loginPassword,
      status: existingBus ? existingBus.status : 'Offline',
      crowdLevel: existingBus ? existingBus.crowdLevel : 'Moderate',
      lat: (existingBus && existingBus.lat) ? existingBus.lat : (firstStop ? firstStop.lat : 8.7139),
      lng: (existingBus && existingBus.lng) ? existingBus.lng : (firstStop ? firstStop.lng : 77.7285),
      speed: existingBus ? existingBus.speed : 0,
      bearing: existingBus ? existingBus.bearing : 90,
      isTripActive: existingBus ? Boolean(existingBus.isTripActive) : false,
      currentStopId: (existingBus && existingBus.currentStopId) ? existingBus.currentStopId : (firstStop ? firstStop.id : null),
      currentStopName: (existingBus && existingBus.currentStopName) ? existingBus.currentStopName : (firstStop ? firstStop.name : 'Terminal'),
      nextStopId: (existingBus && existingBus.nextStopId) ? existingBus.nextStopId : (route && route.stops && route.stops[1] ? route.stops[1].id : null),
      nextStopName: (existingBus && existingBus.nextStopName) ? existingBus.nextStopName : (route && route.stops && route.stops[1] ? route.stops[1].name : 'Next Stop'),
      distanceToNextKm: (existingBus && existingBus.distanceToNextKm !== undefined) ? existingBus.distanceToNextKm : 2.0,
      etaMinutes: (existingBus && existingBus.etaMinutes !== undefined) ? existingBus.etaMinutes : 5,
      routeProgress: (existingBus && existingBus.routeProgress !== undefined) ? existingBus.routeProgress : 0,
      reachedStopIds: (existingBus && existingBus.reachedStopIds) ? existingBus.reachedStopIds : (firstStop ? [firstStop.id] : [])
    };

    await window.appState.saveBus(busPayload);
    this.closeBusModal();
    this.renderBusTable();
    this.renderFleetMap();
    this.renderKpis();
    window.app.showToast(`Bus ${busNumber} saved successfully!`, 'success');
  }

  async deleteBusPrompt(busId) {
    if (confirm(`Are you sure you want to delete ${busId}?`)) {
      if (this.markers && this.markers[busId]) {
        this.markers[busId].remove();
        delete this.markers[busId];
      }
      await window.appState.deleteBus(busId);
      this.renderBusTable();
      this.renderFleetMap();
      window.app.showToast('Bus deleted.', 'info');
    }
  }

  openAddRouteModal() {
    document.getElementById('routeModalTitle').innerHTML = '<i data-lucide="git-branch"></i> Create New Route';
    document.getElementById('routeFormSubmitBtn').textContent = 'Create Route';
    document.getElementById('routeFormId').value = '';
    document.getElementById('routeFormCode').value = '';
    document.getElementById('routeFormName').value = '';
    document.getElementById('routeFormDescription').value = '';
    document.getElementById('routeFormColor').value = '#3B82F6';
    document.getElementById('routeModal').classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  closeRouteModal() {
    document.getElementById('routeModal').classList.remove('active');
  }

  async saveRoute(event) {
    event.preventDefault();
    const id = document.getElementById('routeFormId').value;
    const code = document.getElementById('routeFormCode').value.trim();
    const name = document.getElementById('routeFormName').value.trim();
    const description = document.getElementById('routeFormDescription').value.trim();
    const color = document.getElementById('routeFormColor').value;

    let route = id ? window.appState.getRouteById(id) : null;
    
    if (route) {
      // Update existing
      route.code = code;
      route.name = name;
      route.description = description;
      route.color = color;
      window.app.showToast(`Route ${name} updated!`, 'success');
    } else {
      // Create new
      route = {
        id: `route-${code}`,
        code,
        name,
        description,
        color,
        stops: []
      };
      window.app.showToast(`Route ${name} created! Add stops now.`, 'success');
    }

    await window.appState.saveRoute(route);
    this.closeRouteModal();
    this.renderRouteCards();
    this.renderStopsSection();
    this.populateRouteFormRoutes();
  }

  openAddStopModal(routeId) {
    document.getElementById('stopFormRouteId').value = routeId;
    document.getElementById('stopFormName').value = '';
    document.getElementById('stopFormLat').value = '';
    document.getElementById('stopFormLng').value = '';
    document.getElementById('stopPickerCoords').textContent = 'No location selected — tap the map above';
    document.getElementById('btnSaveStop').disabled = true;
    document.getElementById('addStopModal').classList.add('active');

    // Init the mini picker map centered on Tirunelveli after a tick
    setTimeout(() => {
      if (this._stopPickerMap) {
        this._stopPickerMap.remove();
        this._stopPickerMap = null;
        this._stopPickerMarker = null;
      }

      const pickerMap = L.map('stopPickerMap', { zoomControl: true }).setView([8.7139, 77.7285], 14);
      const GEOAPIFY_KEY = '085e238ac9de46f4aca2977ed1a2c592';
      L.tileLayer(
        `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`,
        { attribution: '© Geoapify | © OpenStreetMap contributors', maxZoom: 20 }
      ).addTo(pickerMap);

      // Draw existing stops of this route so admin can see context
      const route = window.appState.getRouteById(routeId);
      if (route && route.stops) {
        route.stops.forEach((s) => {
          L.circleMarker([s.lat, s.lng], {
            radius: 7, color: route.color || '#2563EB',
            fillColor: route.color || '#2563EB', fillOpacity: 0.9, weight: 2
          }).bindTooltip(s.name, { permanent: false }).addTo(pickerMap);
        });
      }

      // Click on map → drop a draggable pin and capture lat/lng
      pickerMap.on('click', (e) => {
        const { lat, lng } = e.latlng;

        if (this._stopPickerMarker) {
          this._stopPickerMarker.setLatLng([lat, lng]);
        } else {
          this._stopPickerMarker = L.marker([lat, lng], { draggable: true })
            .addTo(pickerMap)
            .bindPopup('📍 Stop Location<br><small>Drag to adjust</small>', { autoClose: false })
            .openPopup();

          this._stopPickerMarker.on('dragend', (ev) => {
            const pos = ev.target.getLatLng();
            this._setPickedLocation(pos.lat, pos.lng);
          });
        }

        this._setPickedLocation(lat, lng);
      });

      this._stopPickerMap = pickerMap;
    }, 120);
  }

  _setPickedLocation(lat, lng) {
    document.getElementById('stopFormLat').value = lat.toFixed(6);
    document.getElementById('stopFormLng').value = lng.toFixed(6);
    document.getElementById('stopPickerCoords').textContent =
      `📌 Lat: ${lat.toFixed(5)},  Lng: ${lng.toFixed(5)}  ✅ Location pinned`;
    document.getElementById('stopPickerCoords').style.color = '#059669';
    document.getElementById('btnSaveStop').disabled = false;
    if (window.lucide) lucide.createIcons();
  }

  closeAddStopModal() {
    document.getElementById('addStopModal').classList.remove('active');
    if (this._stopPickerMap) {
      this._stopPickerMap.remove();
      this._stopPickerMap = null;
      this._stopPickerMarker = null;
    }
  }

  async saveStopToRoute(event) {
    event.preventDefault();
    const routeId = document.getElementById('stopFormRouteId').value;
    const name    = document.getElementById('stopFormName').value.trim();
    const lat     = parseFloat(document.getElementById('stopFormLat').value);
    const lng     = parseFloat(document.getElementById('stopFormLng').value);

    if (!lat || !lng) {
      window.app.showToast('Please click on the map to pick a location first.', 'error');
      return;
    }

    const route = window.appState.getRouteById(routeId);
    if (!route) return;

    const stopId = `stop-${route.code}-${(route.stops || []).length + 1}`;
    const newStop = {
      id: stopId,
      name,
      lat,
      lng,
      sequence: (route.stops || []).length + 1
    };

    route.stops.push(newStop);
    await window.appState.saveRoute(route);
    this.closeAddStopModal();
    window.app.showToast(`Stop "${name}" added to ${route.name}!`, 'success');
  }

  /**
   * Renders clickable route cards in the Manage Routes section
   */
  renderRouteCards() {
    const grid = document.getElementById('adminRouteCardsGrid');
    if (!grid) return;

    const routes = window.appState.routes;
    if (!routes || routes.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; padding: 3rem; text-align: center; color: #64748b;">
          <i data-lucide="route" style="width:48px;height:48px;margin-bottom:1rem;opacity:0.3;"></i>
          <p>No routes created yet. Click "Create New Route" to get started.</p>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    grid.innerHTML = routes.map((route) => {
      const buses = window.appState.getBusesForRoute(route.id);
      const running = buses.filter((b) => b.status === 'Running').length;
      return `
        <div class="admin-route-card" onclick="admin.openRoutePlannerForRoute('${route.id}')">
          <div class="route-card-color-bar" style="background: ${route.color || '#2563eb'};"></div>
          <div class="route-card-body">
            <div class="route-card-badge" style="background: ${route.color || '#2563eb'}22; color: ${route.color || '#2563eb'};">
              ${route.code}
            </div>
            <div class="route-card-name">${route.name}</div>
            <div class="route-card-description" style="font-size: 0.82rem; color: #64748b; margin-top: 4px; margin-bottom: 6px; line-height: 1.35;">
              ${route.description ? `📝 ${route.description}` : '<em style="color:#94a3b8; font-size: 0.78rem;">No description added yet</em>'}
            </div>
            <div class="route-card-meta">
              <span><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${(route.stops || []).length} Stops</span>
              <span><i data-lucide="bus" style="width:12px;height:12px;"></i> ${buses.length} Buses</span>
              <span class="${running > 0 ? 'text-emerald' : 'text-muted'}">
                <i data-lucide="activity" style="width:12px;height:12px;"></i> ${running} Running
              </span>
            </div>
          </div>
          <div class="route-card-arrow">
            <button class="btn btn-xs btn-outline" style="margin-right: 6px;" onclick="event.stopPropagation(); admin.createReturnRoute('${route.id}')" title="Create Return Route">
              <i data-lucide="git-commit" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="btn btn-xs btn-outline" style="margin-right: 6px;" onclick="event.stopPropagation(); admin.editRoute('${route.id}')" title="Edit Route">
              <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="btn btn-xs btn-danger" style="margin-right: 8px;" onclick="event.stopPropagation(); admin.deleteRoute('${route.id}')" title="Delete Route">
              <i data-lucide="trash" style="width: 14px; height: 14px;"></i>
            </button>
            <i data-lucide="chevron-right"></i>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  openRoutePlannerForRoute(routeId) {
    this.switchSection('stops');
    this._selectedStopRouteId = routeId;
    this.renderStopsSection();
  }

  async deleteRoute(routeId) {
    if (!confirm('Are you sure you want to delete this route? This action cannot be undone.')) {
      return;
    }
    await window.appState.deleteRoute(routeId);
    this.renderRouteCards();
    window.app.showToast('Route deleted successfully', 'success');
  }

  async createReturnRoute(routeId) {
    const route = window.appState.getRouteById(routeId);
    if (!route) return;
    
    const newRouteId = 'route-' + Date.now();
    let newName = route.name;
    if (newName.toLowerCase().includes(' to ')) {
      // Split by " to " (case insensitive but preserve original case mostly by using regex)
      const parts = newName.split(/ to /i);
      if (parts.length === 2) {
        newName = parts[1].trim() + ' to ' + parts[0].trim();
      } else {
        newName = newName + ' (Return)';
      }
    } else {
      newName = newName + ' (Return)';
    }

    const returnRoute = {
      id: newRouteId,
      code: route.code + 'R',
      name: newName,
      color: route.color,
      description: route.description,
      stops: []
    };
    
    if (route.stops && route.stops.length > 0) {
      const reversedStops = [...route.stops].reverse();
      returnRoute.stops = reversedStops.map((stop, index) => {
        return {
          id: `stop-${returnRoute.code}-${index + 1}`,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          sequence: index + 1
        };
      });
    }

    await window.appState.saveRoute(returnRoute);
    window.app.showToast(`Return route created!`, 'success');
    this.renderRouteCards();
  }

  editRoute(routeId) {
    const route = window.appState.getRouteById(routeId);
    if (!route) return;
    
    document.getElementById('routeModalTitle').innerHTML = `<i data-lucide="edit"></i> Edit Route ${route.code}`;
    document.getElementById('routeFormSubmitBtn').textContent = 'Save Changes';
    document.getElementById('routeFormId').value = route.id;
    document.getElementById('routeFormCode').value = route.code;
    document.getElementById('routeFormName').value = route.name;
    document.getElementById('routeFormDescription').value = route.description || '';
    document.getElementById('routeFormColor').value = route.color || '#3B82F6';
    document.getElementById('routeModal').classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  async assignRoadway() {
    const routeId = document.getElementById('routeFormId').value || this._selectedStopRouteId;
    if (!routeId) {
      window.app.showToast('Please select or save the route first to assign a roadway.', 'error');
      return;
    }
    const route = window.appState.getRouteById(routeId);
    if (!route || !route.stops || route.stops.length < 2) {
      window.app.showToast('Route must have at least 2 stops to assign a roadway.', 'error');
      return;
    }

    window.app.showToast('Calculating route on road network...', 'info');
    
    // Construct waypoints for Geoapify Routing API
    const waypoints = route.stops.map(s => `${s.lat},${s.lng}`).join('|');
    const apiKey = '085e238ac9de46f4aca2977ed1a2c592';
    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=bus&details=instruction_details&apiKey=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Routing API Error');
      const data = await response.json();
      
      if (data && data.features && data.features.length > 0) {
        let coordinates = data.features[0].geometry.coordinates;
        if (data.features[0].geometry.type === 'MultiLineString') {
          // Flatten to a single array of [lng, lat]
          coordinates = coordinates.flat();
        }
        route.roadway = coordinates; // Assign GeoJSON geometry [lng, lat]
        await window.appState.saveRoute(route);
        window.app.showToast('Roadway assigned and saved!', 'success');
        this.renderRouteCards();
      } else {
        window.app.showToast('Could not calculate a valid road route.', 'error');
      }
    } catch (err) {
      console.error(err);
      window.app.showToast('Error calculating roadway. Try again later.', 'error');
    }
  }

  openDrawRouteModal(explicitRouteId) {
    const routeId = explicitRouteId || (document.getElementById('routeFormId') ? document.getElementById('routeFormId').value : null) || this._selectedStopRouteId || this.selectedRouteTab;
    if (!routeId) {
      window.app.showToast('Please select or save the route first to draw a roadway.', 'error');
      return;
    }
    const route = window.appState.getRouteById(routeId);
    if (!route || !route.stops || route.stops.length < 2) {
      window.app.showToast('Route must have at least 2 stops to draw a roadway.', 'error');
      return;
    }
    this._drawRouteId = routeId;
    document.getElementById('drawRouteModal').classList.add('active');
    
    // Ensure map container renders properly inside modal
    setTimeout(() => {
      this.initDrawRouteMap(route);
    }, 150);
  }

  closeDrawRouteModal() {
    document.getElementById('drawRouteModal').classList.remove('active');
    if (this.drawRouteMap) {
      this.drawRouteMap.remove();
      this.drawRouteMap = null;
    }
    this._drawRouteId = null;
    this.drawRoutePoints = [];
  }

  initDrawRouteMap(route) {
    if (this.drawRouteMap) {
      this.drawRouteMap.remove();
      this.drawRouteMap = null;
    }
    
    // Initialize map
    this.drawRouteMap = L.map('drawRouteMap', {
      zoomControl: true,
      doubleClickZoom: false
    }).setView([8.7139, 77.7567], 13);
    
    const GEOAPIFY_KEY = '085e238ac9de46f4aca2977ed1a2c592';
    L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`, {
      maxZoom: 20,
      attribution: '© Geoapify | © OpenStreetMap contributors'
    }).addTo(this.drawRouteMap);

    // Call invalidateSize to fix leaflet coordinate projection in modal
    this.drawRouteMap.invalidateSize();
    setTimeout(() => {
      if (this.drawRouteMap) this.drawRouteMap.invalidateSize();
    }, 200);
    
    // Add stops as numbered markers
    const bounds = L.latLngBounds();
    route.stops.forEach((stop, idx) => {
      const stopMarker = L.marker([stop.lat, stop.lng], {
        icon: L.divIcon({
          html: `<div style="background:#1e293b;color:#ffffff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${idx+1}</div>`,
          className: 'custom-draw-stop-icon',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        })
      }).bindTooltip(`<strong>Stop ${idx+1}:</strong> ${stop.name}`).addTo(this.drawRouteMap);
      
      // Clicking a stop marker appends its coordinate to the path
      stopMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.addDrawPoint(stop.lat, stop.lng);
      });

      bounds.extend([stop.lat, stop.lng]);
    });
    
    // Initialize drawRoutePoints with existing roadway (if any, [lng, lat] to [lat, lng])
    if (route.roadway && route.roadway.length > 0) {
      this.drawRoutePoints = route.roadway.map(coord => [coord[1], coord[0]]);
    } else {
      // Default to stops sequence as starting outline
      this.drawRoutePoints = route.stops.map(s => [s.lat, s.lng]);
    }
    
    // Outer casing line for high visibility
    this.drawRouteCasing = L.polyline(this.drawRoutePoints, {
      color: '#ffffff',
      weight: 8,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.drawRouteMap);

    // Draw main colored polyline
    this.drawRoutePolyline = L.polyline(this.drawRoutePoints, {
      color: route.color || '#2563EB',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.drawRouteMap);

    // Layer for point circles
    this.drawRouteCircles = L.layerGroup().addTo(this.drawRouteMap);
    this.renderDrawCircles();
    this.updatePointsCount();
    
    // Fit bounds so entire route is framed
    if (this.drawRoutePoints.length > 0) {
      this.drawRoutePoints.forEach(p => bounds.extend(p));
    }
    if (bounds.isValid()) {
      this.drawRouteMap.fitBounds(bounds, { padding: [40, 40] });
    }
    
    // Click listener on map to add points directly
    this.drawRouteMap.on('click', (e) => {
      this.addDrawPoint(e.latlng.lat, e.latlng.lng);
    });

    if (window.lucide) lucide.createIcons();
  }

  addDrawPoint(lat, lng) {
    this.drawRoutePoints.push([lat, lng]);
    this.redrawPath();
    this.updatePointsCount();
  }

  redrawPath() {
    if (this.drawRoutePolyline) {
      this.drawRoutePolyline.setLatLngs([...this.drawRoutePoints]);
    }
    if (this.drawRouteCasing) {
      this.drawRouteCasing.setLatLngs([...this.drawRoutePoints]);
    }
    this.renderDrawCircles();
  }

  renderDrawCircles() {
    if (!this.drawRouteCircles) return;
    this.drawRouteCircles.clearLayers();
    
    // Draw dots at points for feedback
    this.drawRoutePoints.forEach((p, idx) => {
      const isLast = idx === this.drawRoutePoints.length - 1;
      L.circleMarker(p, {
        radius: isLast ? 6 : 4,
        color: '#ffffff',
        weight: 1.5,
        fillColor: isLast ? '#10b981' : '#2563eb',
        fillOpacity: 1
      }).addTo(this.drawRouteCircles);
    });
  }

  updatePointsCount() {
    const badge = document.getElementById('drawPointsCount');
    if (badge) {
      const count = this.drawRoutePoints ? this.drawRoutePoints.length : 0;
      badge.textContent = `${count} Point${count === 1 ? '' : 's'}`;
    }
  }

  undoDrawPoint() {
    if (this.drawRoutePoints && this.drawRoutePoints.length > 0) {
      this.drawRoutePoints.pop();
      this.redrawPath();
      this.updatePointsCount();
    }
  }

  clearDrawPoints() {
    this.drawRoutePoints = [];
    this.redrawPath();
    this.updatePointsCount();
    window.app.showToast('Cleared drawn path. Click along roads to draw from scratch.', 'info');
  }

  resetDrawToStops() {
    if (!this._drawRouteId) return;
    const route = window.appState.getRouteById(this._drawRouteId);
    if (!route || !route.stops) return;
    this.drawRoutePoints = route.stops.map(s => [s.lat, s.lng]);
    this.redrawPath();
    this.updatePointsCount();
    window.app.showToast('Reset path to direct stop connections.', 'info');
  }

  async saveDrawnRoute() {
    if (!this._drawRouteId) return;
    const route = window.appState.getRouteById(this._drawRouteId);
    if (!route) return;
    
    if (!this.drawRoutePoints || this.drawRoutePoints.length < 2) {
      window.app.showToast('Please draw at least 2 points along the route.', 'error');
      return;
    }
    
    window.app.showToast('Calculating road-snapped custom route...', 'info');
    
    // Construct waypoints for Geoapify from the drawn points
    const waypoints = this.drawRoutePoints.map(p => `${p[0]},${p[1]}`).join('|');
    const apiKey = '085e238ac9de46f4aca2977ed1a2c592';
    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=bus&details=instruction_details&apiKey=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.features && data.features.length > 0) {
        let coordinates = data.features[0].geometry.coordinates;
        if (data.features[0].geometry.type === 'MultiLineString') {
          coordinates = coordinates.flat();
        }
        route.roadway = coordinates;
        window.app.showToast('Roadway perfectly snapped and saved!', 'success');
      } else {
        // Fallback to straight lines if routing fails
        route.roadway = this.drawRoutePoints.map(p => [p[1], p[0]]);
        window.app.showToast('Could not snap to road. Saved as straight lines.', 'warning');
      }
      
      await window.appState.saveRoute(route);
      this.closeDrawRouteModal();
      this.renderRouteCards();
    } catch (e) {
      console.error(e);
      // Fallback
      route.roadway = this.drawRoutePoints.map(p => [p[1], p[0]]);
      await window.appState.saveRoute(route);
      window.app.showToast('Failed to connect routing API. Saved straight lines.', 'error');
      this.closeDrawRouteModal();
      this.renderRouteCards();
    }
  }

  // --- FARE MATRIX (TICKET PRICES) ---
  openTicketPriceModal(routeId) {
    this._fareMatrixRouteId = routeId;
    const modal = document.getElementById('ticketPriceModal');
    if (!modal) return;
    
    const route = window.appState.getRouteById(routeId);
    if (!route || !route.stops || route.stops.length < 2) {
      window.app.showToast('Please add at least 2 stops first', 'warning');
      return;
    }

    if (!route.fareMatrix) {
      route.fareMatrix = {}; // format: { "stop1Id_stop2Id": price }
    }

    const select = document.getElementById('fareMatrixBoardingStop');
    select.innerHTML = route.stops.slice(0, -1).map(s => 
      `<option value="${s.id}">Stop #${s.sequence}: ${s.name}</option>`
    ).join('');

    this.onFareBoardingStopChanged();

    modal.classList.add('active');
  }

  closeTicketPriceModal() {
    const modal = document.getElementById('ticketPriceModal');
    if (modal) modal.classList.remove('active');
    this._fareMatrixRouteId = null;
  }

  onFareBoardingStopChanged() {
    const routeId = this._fareMatrixRouteId;
    if (!routeId) return;
    const route = window.appState.getRouteById(routeId);
    if (!route || !route.stops) return;
    
    const select = document.getElementById('fareMatrixBoardingStop');
    const boardStopId = select.value;
    
    const container = document.getElementById('fareMatrixDestinationsContainer');
    
    const boardIdx = route.stops.findIndex(s => s.id === boardStopId);
    if (boardIdx === -1) return;
    
    const destStops = route.stops.slice(boardIdx + 1);
    const stages = [0, 5, 7, 10, 12, 14, 15, 17, 18, 20, 20, 22, 23, 25, 25];
    
    container.innerHTML = destStops.map((dest, dIdx) => {
      const key = `${boardStopId}_${dest.id}`;
      let existingPrice = (route.fareMatrix && route.fareMatrix[key] !== undefined && route.fareMatrix[key] !== null)
        ? route.fareMatrix[key]
        : '';
      if (existingPrice === '') {
        const stepDiff = dIdx + 1;
        existingPrice = stages[Math.min(stepDiff, stages.length - 1)] || (5 + stepDiff * 2);
      }
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="font-size: 0.9rem; color: #475569;">To: <strong>${dest.name}</strong></div>
          <div style="display: flex; align-items: center;">
            <span style="color: #64748b; margin-right: 6px;">₹</span>
            <input type="number" class="form-control fare-input" data-dest="${dest.id}" value="${existingPrice}" placeholder="0" style="width: 80px; text-align: right;" min="0">
          </div>
        </div>
      `;
    }).join('');
  }

  async saveFareMatrix() {
    if (!this._fareMatrixRouteId) return;
    const route = window.appState.getRouteById(this._fareMatrixRouteId);
    if (!route) return;
    
    const select = document.getElementById('fareMatrixBoardingStop');
    const boardStopId = select.value;
    
    if (!route.fareMatrix) {
      route.fareMatrix = {};
    }
    
    const inputs = document.querySelectorAll('.fare-input');
    inputs.forEach(input => {
      const destId = input.getAttribute('data-dest');
      const val = parseInt(input.value);
      const key = `${boardStopId}_${destId}`;
      if (!isNaN(val) && val >= 0) {
        route.fareMatrix[key] = val;
      }
    });

    const routeId = this._fareMatrixRouteId;
    window.appState.notify({ type: 'ROUTES_UPDATED', route });
    await window.appState.saveRoute(route);
    this.closeTicketPriceModal();
    this.renderRouteStopList(routeId);
    window.app.showToast('Ticket prices saved successfully!', 'success');
  }

  async deleteStop(routeId, stopId) {
    const route = window.appState.getRouteById(routeId);
    if (!route) return;
    const idx = route.stops.findIndex(s => s.id === stopId);
    if (idx !== -1) {
      route.stops.splice(idx, 1);
      // Re-sequence
      route.stops.forEach((s, i) => s.sequence = i + 1);
      this.selectRouteForStops(routeId);
      window.app.showToast('Stop removed from route', 'info');
      await window.appState.saveRoute(route);
    }
  }

  editStop(routeId, stopId) {
    const route = window.appState.getRouteById(routeId);
    if (!route) return;
    const stop = route.stops.find(s => s.id === stopId);
    if (!stop) return;
    
    document.getElementById('editStopFormRouteId').value = routeId;
    document.getElementById('editStopFormStopId').value = stopId;
    document.getElementById('editStopFormName').value = stop.name;
    document.getElementById('editStopFormLat').value = stop.lat;
    document.getElementById('editStopFormLng').value = stop.lng;
    document.getElementById('editStopPickerCoords').textContent = `${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`;
    
    document.getElementById('editStopModal').classList.add('active');

    // Init the mini picker map after a tick
    setTimeout(() => {
      if (this._editStopPickerMap) {
        this._editStopPickerMap.remove();
        this._editStopPickerMap = null;
        this._editStopPickerMarker = null;
      }

      const pickerMap = L.map('editStopPickerMap', { zoomControl: true }).setView([stop.lat, stop.lng], 16);
      const GEOAPIFY_KEY = '085e238ac9de46f4aca2977ed1a2c592';
      L.tileLayer(
        `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`,
        { attribution: '© Geoapify | © OpenStreetMap contributors', maxZoom: 20 }
      ).addTo(pickerMap);

      // Draw existing stop marker
      this._editStopPickerMarker = L.marker([stop.lat, stop.lng]).addTo(pickerMap);

      // Add click handler to pick new location
      pickerMap.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        if (!this._editStopPickerMarker) {
          this._editStopPickerMarker = L.marker([lat, lng]).addTo(pickerMap);
        } else {
          this._editStopPickerMarker.setLatLng([lat, lng]);
        }

        document.getElementById('editStopFormLat').value = lat;
        document.getElementById('editStopFormLng').value = lng;
        document.getElementById('editStopPickerCoords').textContent = 
          `New location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      });

      this._editStopPickerMap = pickerMap;
    }, 50);
  }

  closeEditStopModal() {
    document.getElementById('editStopModal').classList.remove('active');
    if (this._editStopPickerMap) {
      this._editStopPickerMap.remove();
      this._editStopPickerMap = null;
      this._editStopPickerMarker = null;
    }
  }

  async saveEditedStop(event) {
    event.preventDefault();
    const routeId = document.getElementById('editStopFormRouteId').value;
    const stopId = document.getElementById('editStopFormStopId').value;
    const newName = document.getElementById('editStopFormName').value.trim();
    const newLat = parseFloat(document.getElementById('editStopFormLat').value);
    const newLng = parseFloat(document.getElementById('editStopFormLng').value);
    
    if (!newName) return;

    const route = window.appState.getRouteById(routeId);
    if (!route) return;
    const stop = route.stops.find(s => s.id === stopId);
    if (!stop) return;

    stop.name = newName;
    if (!isNaN(newLat)) stop.lat = newLat;
    if (!isNaN(newLng)) stop.lng = newLng;
    
    this.selectRouteForStops(routeId);
    window.app.showToast(`Stop "${stop.name}" updated!`, 'success');
    await window.appState.saveRoute(route);

    this.closeEditStopModal();
  }


  async moveStop(routeId, idx, direction) {
    const route = window.appState.getRouteById(routeId);
    if (!route || !route.stops) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= route.stops.length) return;
    const stops = route.stops;
    [stops[idx], stops[newIdx]] = [stops[newIdx], stops[idx]];
    stops.forEach((s, i) => s.sequence = i + 1);
    this.selectRouteForStops(routeId);
    await window.appState.saveRoute(route);
  }

  /**
   * Renders the Manage Stops section: route selector buttons + stop list
   */
  renderStopsSection() {
    const selector = document.getElementById('adminStopRouteSelector');
    if (!selector) return;

    const routes = window.appState.routes;
    if ((!this._selectedStopRouteId || !routes.some(r => r.id === this._selectedStopRouteId)) && routes.length > 0) {
      this._selectedStopRouteId = routes[0].id;
    }

    selector.innerHTML = routes.map((route) => `
      <button class="admin-route-select-btn ${this._selectedStopRouteId === route.id ? 'active' : ''}"
              onclick="admin.selectRouteForStops('${route.id}')"
              style="border-left: 4px solid ${route.color || '#2563eb'};">
        <div class="route-select-code" style="color: ${route.color || '#2563eb'};">${route.code}</div>
        <div class="route-select-name">${route.name}</div>
        ${route.description ? `<div class="route-select-desc" style="font-size: 0.76rem; color: #64748b; margin-top: 2px; line-height: 1.25;">${route.description}</div>` : ''}
        <div class="route-select-meta">${(route.stops || []).length} stops</div>
      </button>
    `).join('');

    if (this._selectedStopRouteId) {
      this.selectRouteForStops(this._selectedStopRouteId);
    }

    if (window.lucide) lucide.createIcons();
  }

  selectRouteForStops(routeId) {
    this._selectedStopRouteId = routeId;

    // Re-render selector to update active state
    const selector = document.getElementById('adminStopRouteSelector');
    if (selector) {
      selector.querySelectorAll('.admin-route-select-btn').forEach((btn) => {
        const isActive = btn.onclick && btn.onclick.toString().includes(routeId);
        btn.classList.toggle('active', btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${routeId}'`));
      });
    }

    const route = window.appState.getRouteById(routeId);
    if (!route) return;

    const card = document.getElementById('adminStopListCard');
    const title = document.getElementById('adminStopListTitle');
    const addBtn = document.getElementById('adminAddStopBtn');
    const drawBtn = document.getElementById('adminDrawRouteBtn');
    const faresBtn = document.getElementById('adminManageFaresBtn');
    const list = document.getElementById('adminInlineStopList');

    if (card) card.style.display = 'block';
    if (title) {
      title.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="map-pin"></i> <span>${route.name} — ${(route.stops || []).length} Stops</span>
          </div>
          ${route.description ? `<div style="font-size: 0.85rem; color: #64748b; font-weight: 400; margin-top: 3px;">📝 ${route.description}</div>` : ''}
        </div>
      `;
    }
    if (addBtn) addBtn.setAttribute('onclick', `admin.openAddStopModal('${routeId}')`);
    if (drawBtn) drawBtn.setAttribute('onclick', `admin.openDrawRouteModal('${routeId}')`);
    if (faresBtn) faresBtn.setAttribute('onclick', `admin.openTicketPriceModal('${routeId}')`);

    if (list) {
      if (!route.stops || route.stops.length === 0) {
        list.innerHTML = `
          <div style="padding: 2rem; text-align: center; color: #64748b;">
            <p>No stops yet. Click "Add Stop to Route" to pin your first stop on the map.</p>
          </div>`;
      } else {
        const originStop = route.stops[0];
        const stages = [0, 5, 7, 10, 12, 14, 15, 17, 18, 20, 20, 22, 23, 25, 25];
        list.innerHTML = route.stops.map((stop, idx) => {
          let fareBadge = '';
          if (idx === 0) {
            fareBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:6px;">Start / Origin</span>`;
          } else {
            const key = `${originStop.id}_${stop.id}`;
            const fareVal = (route.fareMatrix && route.fareMatrix[key] !== undefined)
              ? route.fareMatrix[key]
              : (stages[Math.min(idx, stages.length - 1)] || (5 + idx * 2));
            fareBadge = `<span class="badge" style="background:#ecfdf5; color:#065f46; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; border:1px solid #a7f3d0;" title="Fare from Start Stop">₹${fareVal}</span>`;
          }
          return `
          <div class="route-stop-row">
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <div class="stop-seq-num">${stop.sequence || idx + 1}</div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 700; color: #0f172a;">${stop.name}</span>
                  ${fareBadge}
                </div>
                <div style="font-size: 0.75rem; color: #64748b;">
                  GPS: ${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)} • Geofence: 80m
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <button class="btn btn-xs btn-outline" onclick="admin.editStop('${routeId}', '${stop.id}')" title="Edit Stop">
                <i data-lucide="edit" style="width:12px;height:12px;"></i>
              </button>
              <button class="btn btn-xs btn-outline" onclick="admin.moveStop('${routeId}', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">
                <i data-lucide="arrow-up"></i>
              </button>
              <button class="btn btn-xs btn-outline" onclick="admin.moveStop('${routeId}', ${idx}, 1)" ${idx === route.stops.length - 1 ? 'disabled' : ''} title="Move Down">
                <i data-lucide="arrow-down"></i>
              </button>
              <button class="btn btn-xs btn-danger" onclick="admin.deleteStop('${routeId}', '${stop.id}')" title="Delete Stop">
                <i data-lucide="x"></i>
              </button>
            </div>
          </div>
          `;
        }).join('');
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  refreshFleetData() {
    window.appState.init();
    window.app.showToast('Fleet telemetry refreshed.', 'info');
  }

  /**
   * Confirms add-stop modal submission (called from modal Save button)
   */
  confirmAddStop() {
    const routeId = document.getElementById('addStopRouteId') ? document.getElementById('addStopRouteId').value : this._selectedStopRouteId;
    const name = (document.getElementById('stopNameInput') || {}).value || '';
    const lat = parseFloat((document.getElementById('stopLatInput') || {}).value || 0);
    const lng = parseFloat((document.getElementById('stopLngInput') || {}).value || 0);
    if (!name || !lat || !lng) {
      window.app.showToast('Please fill in all stop fields (Name, Lat, Lng)', 'error');
      return;
    }
    this.addStopToRoute(routeId, name, lat, lng);
    document.getElementById('addStopModal') && (document.getElementById('addStopModal').style.display = 'none');
  }
}

window.admin = new AdminController();
