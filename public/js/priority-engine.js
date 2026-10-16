/**
 * PriorityEngine: Real-Time Multi-Bus Arrival Priority & ETA Ranking Engine
 * 
 * Determines which bus will arrive at the passenger's selected stop FIRST.
 * Does NOT rank purely by raw straight-line distance, but by Live ETA considering:
 * - Real along-the-route distance
 * - Live moving speed vs stopped status
 * - Intermediate stop dwell delays
 */
const PriorityEngine = {
  /**
   * Calculates priority ranking for all buses approaching a specific stop
   * @param {Object} route - The route object
   * @param {Object} targetStop - The passenger's target stop
   * @param {Array} buses - List of buses assigned to this route
   */
  rankBusesForStop(route, targetStop, buses) {
    if (!route || !targetStop || !buses || buses.length === 0) {
      return [];
    }

    const targetSeq = targetStop.sequence;
    const rankedList = [];

    buses.forEach((bus) => {
      // Find where the bus currently is along the sequence
      const currentStop = route.stops.find((s) => s.id === bus.currentStopId);
      const currentSeq = currentStop ? currentStop.sequence : 1;

      // Count intermediate stops between bus and target stop
      const intermediateStopsCount = Math.max(0, targetSeq - currentSeq);

      // Compute live dynamic ETA
      const etaObj = GeoEngine.calculateETA(
        bus.lat,
        bus.lng,
        bus.speed,
        targetStop,
        intermediateStopsCount
      );

      // Distance from bus to target stop
      const distKm = GeoEngine.getDistanceKm(bus.lat, bus.lng, targetStop.lat, targetStop.lng);

      // Has the bus already passed this stop?
      const isPastStop = currentSeq > targetSeq && !etaObj.isReached;

      rankedList.push({
        bus,
        busNumber: bus.busNumber,
        regNumber: bus.regNumber,
        conductorName: bus.conductorName,
        speed: bus.speed,
        status: bus.status,
        crowdLevel: bus.crowdLevel,
        currentStopName: bus.currentStopName,
        nextStopName: bus.nextStopName,
        distanceKm: Math.round(distKm * 10) / 10,
        etaMinutes: etaObj.minutes,
        etaText: etaObj.text,
        isReached: etaObj.isReached,
        isArriving: etaObj.isArriving,
        isPastStop,
        routeProgress: bus.routeProgress || 0
      });
    });

    // Sort by ETA ascending:
    // 1. Buses that have reached or arriving now come first
    // 2. Smallest ETA in minutes next
    // 3. Buses that passed the stop placed at the bottom
    rankedList.sort((a, b) => {
      if (a.isPastStop && !b.isPastStop) return 1;
      if (!a.isPastStop && b.isPastStop) return -1;
      if (a.isReached && !b.isReached) return -1;
      if (!a.isReached && b.isReached) return 1;
      if (a.isArriving && !b.isArriving) return -1;
      if (!a.isArriving && b.isArriving) return 1;

      // Numerical ETA comparison
      return a.etaMinutes - b.etaMinutes;
    });

    // Assign medal ranks
    return rankedList.map((item, index) => {
      let rankBadge = `${index + 1}th`;
      let rankClass = 'rank-other';
      let rankTitle = `BUS ${item.busNumber}`;

      if (index === 0 && !item.isPastStop) {
        rankBadge = '🥇 1st Arriving';
        rankClass = 'rank-gold';
      } else if (index === 1 && !item.isPastStop) {
        rankBadge = '🥈 2nd Arriving';
        rankClass = 'rank-silver';
      } else if (index === 2 && !item.isPastStop) {
        rankBadge = '🥉 3rd Arriving';
        rankClass = 'rank-bronze';
      }

      return {
        ...item,
        rank: index + 1,
        rankBadge,
        rankClass,
        rankTitle
      };
    });
  }
};

window.PriorityEngine = PriorityEngine;
