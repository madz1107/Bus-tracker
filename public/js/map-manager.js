/**
 * MapManager: High-Performance Leaflet Vector & Marker Visualizer
 */
class MapManager {
  constructor(mapContainerId, options = {}) {
    this.containerId = mapContainerId;
    this.options = Object.assign({
      zoom: 13,
      center: [8.7139, 77.7285],
      followBus: false
    }, options);

    this.map = null;
    this.busMarkers = new Map();
    this.stopMarkers = new Map();
    this.routePolylines = new Map();
    this.geofenceCircles = new Map();
    this.followBusId = null;

    this.initMap();
  }

  initMap() {
    const el = document.getElementById(this.containerId);
    if (!el || typeof L === 'undefined') return;

    this.map = L.map(this.containerId, {
      zoomControl: false,
      attributionControl: false
    }).setView(this.options.center, this.options.zoom);

    // Geoapify High-Quality Map Tiles (OSM Bright Style)
    const GEOAPIFY_KEY = '085e238ac9de46f4aca2977ed1a2c592';
    L.tileLayer(
      `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`,
      {
        maxZoom: 20,
        attribution: '© Geoapify | © OpenStreetMap contributors'
      }
    ).addTo(this.map);
  }

  /**
   * Renders or updates a bus marker with smooth rotation & custom badge
   */
  updateBusMarker(bus, isHighlight = false, isRank1 = false) {
    if (!this.map || !bus || bus.lat == null || bus.lng == null) return;

    // Do not show bus icon on map if conductor GPS is off (Trip not active or Offline)
    if (!bus.isTripActive || bus.status === 'Offline') {
      if (this.busMarkers.has(bus.id)) {
        this.busMarkers.get(bus.id).remove();
        this.busMarkers.delete(bus.id);
      }
      return;
    }

    const latLng = [bus.lat, bus.lng];
    const bearing = bus.bearing || 0;
    const rankClass = isRank1 ? 'rank-1' : '';

    const iconHtml = `
      <div class="bus-map-marker" style="transform: rotate(${bearing}deg);">
        <div class="bus-marker-pin ${rankClass}">
          <i data-lucide="bus" style="width: 18px; height: 18px; transform: rotate(-${bearing}deg);"></i>
        </div>
        <div class="bus-marker-number" style="transform: rotate(-${bearing}deg);">
          BUS ${bus.busNumber}
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: 'custom-bus-icon-container',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const crowdIcon = bus.crowdLevel === 'Low' ? '🟢' : bus.crowdLevel === 'Heavy' ? '🔴' : '🟡';
    const statusColor = bus.status === 'Running' ? '#059669' : '#dc2626';

    const popupHtml = `
      <div style="font-family: var(--font-sans, 'Inter', sans-serif); padding: 4px; min-width: 200px;">
        <h4 style="margin: 0 0 6px; font-weight: 800; color: #1e40af; font-size: 14px;">🚌 BUS ${bus.busNumber}</h4>
        <div style="font-size: 12px; color: #475569; margin-bottom: 2px;"><strong>Reg:</strong> ${bus.regNumber || 'N/A'}</div>
        <div style="font-size: 12px; color: #475569; margin-bottom: 2px;"><strong>Speed:</strong> ${bus.speed || 0} km/h</div>
        <div style="font-size: 12px; color: #475569; margin-bottom: 2px;"><strong>Current Stop:</strong> ${bus.currentStopName || 'En route'}</div>
        <div style="font-size: 12px; color: #475569; margin-bottom: 2px;"><strong>Next Stop:</strong> ${bus.nextStopName || 'N/A'}</div>
        <div style="font-size: 12px; color: #059669; font-weight: 700; margin-bottom: 2px;"><strong>Live ETA:</strong> ${bus.etaMinutes || 0} min (${bus.distanceToNextKm || 0} km)</div>
        <div style="font-size: 12px; margin-bottom: 2px;"><strong>Crowd:</strong> ${crowdIcon} ${bus.crowdLevel || 'Unknown'}</div>
        <div style="font-size: 11px; font-weight: 700; color: ${statusColor}; margin-top: 4px; text-transform: uppercase;">${bus.status || 'Unknown'}</div>
      </div>
    `;

    if (this.busMarkers.has(bus.id)) {
      const marker = this.busMarkers.get(bus.id);
      marker.setLatLng(latLng);
      marker.setIcon(customIcon);
      // Refresh popup content with latest live data
      if (marker.getPopup()) {
        marker.getPopup().setContent(popupHtml);
      } else {
        marker.bindPopup(popupHtml);
      }
    } else {
      const marker = L.marker(latLng, { icon: customIcon }).addTo(this.map);
      marker.bindPopup(popupHtml);
      this.busMarkers.set(bus.id, marker);
    }

    // Refresh icons inside marker HTML
    if (window.lucide) {
      setTimeout(() => lucide.createIcons(), 10);
    }

    // Camera follow mode
    if (this.followBusId === bus.id) {
      this.map.panTo(latLng, { animate: true, duration: 0.5 });
    }
  }

  /**
   * Renders bus stops along a route with geofence rings and sequence numbers
   */
  renderRouteStops(route, activeBuses = []) {
    if (!this.map || !route || !route.stops) return;

    const stopCoordinates = [];

    route.stops.forEach((stop, index) => {
      const latLng = [stop.lat, stop.lng];
      stopCoordinates.push(latLng);

      const stopIconHtml = `
        <div class="stop-map-marker">
          ${stop.sequence || index + 1}
        </div>
      `;

      const stopIcon = L.divIcon({
        html: stopIconHtml,
        className: 'custom-stop-icon-container',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      // Geofence detection circle (80 meters)
      const geofenceCircle = L.circle(latLng, {
        radius: GeoEngine.GEOFENCE_RADIUS_METERS,
        color: route.color || '#2563EB',
        fillColor: route.color || '#2563EB',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '3, 4'
      }).addTo(this.map);
      this.geofenceCircles.set(stop.id, geofenceCircle);

      const marker = L.marker(latLng, { icon: stopIcon }).addTo(this.map);

      // Rank approaching buses for this stop to show in the popup
      const rankedApproaching = PriorityEngine.rankBusesForStop(route, stop, activeBuses);
      let approachingHtml = '';

      if (rankedApproaching.length > 0) {
        approachingHtml = `
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Approaching Buses:</div>
            ${rankedApproaching.map((item) => `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 2px;">
                <span>${item.rankBadge} BUS ${item.busNumber}</span>
                <strong style="color: #2563eb;">${item.etaText} (${item.distanceKm} km)</strong>
              </div>
            `).join('')}
          </div>
        `;
      }

      marker.bindPopup(`
        <div style="font-family: var(--font-sans); padding: 4px; min-width: 190px;">
          <h4 style="margin: 0 0 2px; font-weight: 800; color: #0f172a;">${stop.name}</h4>
          <div style="font-size: 12px; color: #64748b;">Stop #${stop.sequence || index + 1} on ${route.name}</div>
          ${approachingHtml}
        </div>
      `);

      this.stopMarkers.set(stop.id, marker);
    });

    // Render custom roadway line if it exists
    if (route.roadway && route.roadway.length > 0) {
      this.renderRoutePolyline(route, route.roadway);
    }
  }

  renderRoutePolyline(route, roadPoints) {
    if (!this.map || !roadPoints || roadPoints.length === 0) return;

    // Geoapify stores roadway as [lng, lat]. Leaflet needs [lat, lng].
    const latLngPoints = roadPoints.map(p => [p[1], p[0]]);

    // Draw casing for better visibility
    const casing = L.polyline(latLngPoints, {
      color: '#ffffff',
      weight: 6,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    // Draw main colored line
    const polyline = L.polyline(latLngPoints, {
      color: route.color || '#2563EB',
      weight: 4,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    this.routePolylines.set(`${route.id}-casing`, casing);
    this.routePolylines.set(route.id, polyline);
  }

  clearStops() {
    this.stopMarkers.forEach((marker) => marker.remove());
    this.stopMarkers.clear();
    this.geofenceCircles.forEach((circle) => circle.remove());
    this.geofenceCircles.clear();
    this.routePolylines.forEach((line) => line.remove());
    this.routePolylines.clear();
  }

  fitBoundsToRoute(route) {
    if (!this.map || !route || !route.stops || route.stops.length === 0) return;
    const bounds = L.latLngBounds(route.stops.map((s) => [s.lat, s.lng]));
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  setFollowBus(busId) {
    this.followBusId = busId;
  }

  centerOnLocation(lat, lng, zoom = 15) {
    if (this.map && lat && lng) {
      this.map.setView([lat, lng], zoom, { animate: true });
    }
  }

  invalidateSize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 150);
    }
  }
}

window.MapManager = MapManager;
