/**
 * i18n.js - Internationalization Module for Nellai72 Smart Transit
 * Supports English ('en') and Tamil ('ta') with zero external dependencies.
 * Default language: English ('en'). Persisted in localStorage.
 */
(function() {
  const STORAGE_KEY = 'citybus_lang';

  const translations = {
    en: {
      // Header
      brandName: "Nellai",
      brandHighlight: "72",
      brandTagline: "Tirunelveli Smart Transit",
      navPassenger: "Passenger",
      navWimb: "Where Is My Bus?",
      navBus: "Bus",
      navAdmin: "Admin",
      liveBadge: "LIVE",
      activeBusesLive: "Active Buses Live",
      activeBusLive: "Active Bus Live",
      male: "Male",
      female: "Female",
      signIn: "Sign In",
      logout: "Logout",

      // Passenger Hero & Search
      findNearestStop: "Find Nearest Stop",
      heroChip: "Tirunelveli Real-Time GPS Connected",
      heroTitle: "Track City Buses in Real Time",
      heroSubtitle: "Live real-time transit tracking for active city routes. See which bus arrives first with smart live ETA ranking.",
      myDailyCommute: "⭐ My Daily Commute",
      myDailyCommuteSub: "Starred routes & stops • 1-Tap instant live radar tracking",
      addCommute: "Add Commute",
      starCommute: "Star Commute",
      starredCommute: "Starred",
      trackByRoute: "1. Track by Route & Stop",
      selectRoute: "Select Route",
      yourBoardingStop: "Your Boarding Stop",
      destinationStop: "Destination Stop",
      anyDestination: "Any Destination",
      trackLive: "Track Live",
      trackByBusNumber: "2. Track by Bus Number",
      findBusLabel: "Find Bus #",
      findBusPlaceholder: "e.g. 1, 101, 102, 202",

      // Priority Leaderboard & Arrival Cards
      arrivalPriorityFor: "Live Bus Arrival Priority for",
      allStops: "All Stops",
      priorityDesc: "Dynamic multi-bus priority ranked by Earliest Live ETA (not just physical distance). Updates in real-time as buses move.",
      autoSync: "Live Auto-Sync",
      arrivingFirst: "🥇 ARRIVING FIRST",
      arrivingSecond: "🥈 2ND ARRIVAL",
      arrivingThird: "🥉 3RD ARRIVAL",
      crowd: "Crowd",
      crowdLow: "Low",
      crowdModerate: "Moderate",
      crowdHeavy: "Heavy",
      comfortRecommended: "Recommended for Comfort • Seats Available",
      estimatedArrivalAt: "Estimated Arrival at",
      driverNotice: "Driver Notice:",
      distanceToStop: "Distance to Stop",
      movingSpeed: "Moving Speed",
      currentStop: "Current Stop",
      nextStop: "Next Stop",
      enRoute: "En route",
      onRoute: "On Route",
      ticketFare: "Ticket Fare",
      standardFare: "Standard Fare",
      vetriPayanamFree: "Vetri Payanam • FREE",
      freeWomenTravelTag: "(Women Free Travel)",
      freeWomenTravelFull: "₹0 FREE (Women Free Travel)",
      ticketFareFreeText: "₹0 FREE",
      whereIsMyBusBtn: "Where Is My Bus",
      alarmBtn: "Alarm",
      noActiveBusesSegment: "No active buses currently operating on this route segment.",
      noStopsAvailable: "No stops available",

      // Smart Suggestion Tip
      smartTipTitle: "Smart Travel Tip: Low Crowd Bus on Same Route!",
      smartTipSeats: "has 🟢 Seats Available (Low Crowd) arriving in",
      smartTipPeaceful: "Take this bus for a peaceful ride!",
      smartTipTrackBtn: "Track BUS",

      // Ticket Price Info Box
      ticketPriceInfo: "Ticket Price Info",
      ticketFrom: "From",
      ticketTo: "to",
      ticketVetriBusLabel: "Vetri Payanam Buses:",
      ticketStandardBusLabel: "Standard Buses:",
      ticketSchemeActiveNotice: "Zero-fare transit scheme active for female passengers.",
      ticketStandardNotice: "TNSTC standard government transit fare.",

      // Where Is My Bus Live Tracking Screen
      wimbLiveFleetTracking: "Live Fleet Tracking",
      wimbTransitRadar: "Real-Time Transit Radar",
      wimbVetriBanner: "Vetri Payanam Scheme Bus — Free Travel for Women Passengers",
      wimbVetriSubtitle: "• Vetri Payanam: Free for Women",
      wimbStatusLabel: "Status",
      wimbStatusRunning: "🟢 Running",
      wimbStatusStopped: "🟡 Stopped",
      wimbStatusOffline: "🔴 Offline",
      wimbLiveCrowdLabel: "Live Crowd",
      wimbLiveSpeedLabel: "Live Speed",
      wimbNextStopLabel: "Next Stop",
      wimbNextEtaLabel: "Next Stop ETA",
      wimbGpsFreshnessLabel: "GPS Freshness",
      wimbUpdatedLive: "Updated live",
      wimbFollowBus: "Follow Bus",
      wimbStopFollowing: "Stop Following",
      wimbFullRoute: "Full Route",
      wimbWakeMeUp: "Wake Me Up",
      wimbOfflineTitle: "This Bus is Currently Offline",
      wimbOfflineDesc: "The bus has ended its trip and is not broadcasting a live GPS signal.",
      wimbBackBtn: "Back to Passenger Portal",
      wimbTimelineHeading: "Live Journey Timeline",
      wimbNextApproaching: "Next Approaching Stop",
      wimbStopsReached: "Stops Reached",

      // Nearest Stop Map
      nearestStopTitle: "Nearest Bus Stop Map",
      nearestStopDesc: "View your location, the nearest stop, and full stop details.",
      backBtn: "Back",
      metersAway: "meters away",
      youAreHere: "You are here",
      noNearbyStopsFound: "Could not find any nearby stops.",
      locationPermissionDenied: "Could not access your location. Please grant location permissions.",
      nearestStopFoundToast: "Nearest stop found:"
    },

    ta: {
      // Header
      brandName: "நெல்லை",
      brandHighlight: "72",
      brandTagline: "திருநெல்வேலி ஸ்மார்ட் பேருந்து சேவை",
      navPassenger: "பயணியர்",
      navWimb: "என் பேருந்து எங்கே?",
      navBus: "பேருந்து",
      navAdmin: "நிர்வாகம்",
      liveBadge: "நேரலை",
      activeBusesLive: "செயலில் உள்ள பேருந்துகள்",
      activeBusLive: "செயலில் உள்ள பேருந்து",
      male: "ஆண்",
      female: "பெண்",
      signIn: "உள்நுழைக",
      logout: "வெளியேறு",

      // Passenger Hero & Search
      findNearestStop: "அருகிலுள்ள நிறுத்தம்",
      heroChip: "திருநெல்வேலி நேரடி ஜி.பி.எஸ் இணைப்பு",
      heroTitle: "நகரப் பேருந்துகளை நேரலையில் கண்காணிக்கவும்",
      heroSubtitle: "செயலில் உள்ள நகர வழித்தடங்களுக்கான நேரலை கண்காணிப்பு. ஸ்மார்ட் ETA மூலம் எந்த பேருந்து முதலில் வரும் என்பதை உடனே தெரிந்துகொள்ளுங்கள்.",
      myDailyCommute: "⭐ எனது தினசரி பயணம்",
      myDailyCommuteSub: "விருப்பமான வழித்தடங்கள் • ஒரு தொடுதலில் நேரடி ரேடார் கண்காணிப்பு",
      addCommute: "பயணத்தை சேர்",
      starCommute: "சேமிக்க",
      starredCommute: "சேமிக்கப்பட்டது",
      trackByRoute: "1. வழித்தடம் & நிறுத்தம் மூலம் தேட",
      selectRoute: "வழித்தடத்தைத் தேர்ந்தெடுக்கவும்",
      yourBoardingStop: "நீங்கள் ஏறும் பேருந்து நிறுத்தம்",
      destinationStop: "இறங்கும் நிறுத்தம் (Destination)",
      anyDestination: "அனைத்து நிறுத்தங்களும்",
      trackLive: "நேரலையைக் காண்க",
      trackByBusNumber: "2. பேருந்து எண் மூலம் தேட",
      findBusLabel: "பேருந்து எண் தேட",
      findBusPlaceholder: "எ.கா. 1, 101, 102, 202",

      // Priority Leaderboard & Arrival Cards
      arrivalPriorityFor: "பேருந்துகள் வந்து சேரும் வரிசை:",
      allStops: "அனைத்து நிறுத்தங்கள்",
      priorityDesc: "பேருந்துகளின் நேரடி வருகை நேரத்தின் (ETA) அடிப்படையில் வரிசைப்படுத்தப்பட்டுள்ளது. பேருந்து நகரும்போது தானாகப் புதுப்பிக்கப்படும்.",
      autoSync: "நேரடி தானியங்கி புதுப்பிப்பு",
      arrivingFirst: "🥇 முதலில் வந்து சேரும்",
      arrivingSecond: "🥈 2-வதாக வரும்",
      arrivingThird: "🥉 3-வதாக வரும்",
      crowd: "கூட்டம்",
      crowdLow: "குறைவு",
      crowdModerate: "மிதமான",
      crowdHeavy: "அதிக கூட்டம்",
      comfortRecommended: "இருக்கைகள் உள்ளன • சௌகரியமான பயணம்",
      estimatedArrivalAt: "வந்து சேரும் நேரம்:",
      driverNotice: "ஓட்டுநர் தகவல்:",
      distanceToStop: "நிறுத்தத்திற்கான தூரம்",
      movingSpeed: "இயங்கும் வேகம்",
      currentStop: "தற்போதைய நிறுத்தம்",
      nextStop: "அடுத்த நிறுத்தம்",
      enRoute: "வழியில் உள்ளது",
      onRoute: "பயணத்தில் உள்ளது",
      ticketFare: "பயணக் கட்டணம்",
      standardFare: "வழக்கமான கட்டணம்",
      vetriPayanamFree: "வெற்றிப் பயணம் • இலவசம்",
      freeWomenTravelTag: "(மகளிர் இலவசப் பயணம்)",
      freeWomenTravelFull: "₹0 இலவசம் (மகளிர் இலவசப் பயணம்)",
      ticketFareFreeText: "₹0 இலவசம்",
      whereIsMyBusBtn: "என் பேருந்து எங்கே?",
      alarmBtn: "அலாரம்",
      noActiveBusesSegment: "இந்த வழித்தடத்தில் தற்போது எந்த பேருந்தும் இயக்கத்தில் இல்லை.",
      noStopsAvailable: "நிறுத்தங்கள் இல்லை",

      // Smart Suggestion Tip
      smartTipTitle: "பயணக் குறிப்பு: இதே வழித்தடத்தில் குறைந்த கூட்டமுள்ள பேருந்து வருகிறது!",
      smartTipSeats: "பேருந்தில் 🟢 இருக்கைகள் காலியாக உள்ளன. வந்து சேரும் நேரம்:",
      smartTipPeaceful: "அமைதியான பயணத்திற்கு இப்பேருந்தை பயன்படுத்தவும்!",
      smartTipTrackBtn: "பேருந்தைக் காண்க",

      // Ticket Price Info Box
      ticketPriceInfo: "கட்டண விவரம்",
      ticketFrom: "புறப்படும் இடம்:",
      ticketTo: "சென்றடையும் இடம்:",
      ticketVetriBusLabel: "வெற்றிப் பயணப் பேருந்துகள்:",
      ticketStandardBusLabel: "வழக்கமான பேருந்துகள்:",
      ticketSchemeActiveNotice: "மகளிர் பயணிகளுக்கு கட்டணமில்லா பயணத் திட்டம் செயலில் உள்ளது.",
      ticketStandardNotice: "அரசு விரைவுப் போக்குவரத்துக் கழக கட்டணம்.",

      // Where Is My Bus Live Tracking Screen
      wimbLiveFleetTracking: "நேரடி பேருந்து கண்காணிப்பு",
      wimbTransitRadar: "நிகழ்நேர போக்குவரத்து ரேடார்",
      wimbVetriBanner: "வெற்றிப் பயணம் திட்டம் — மகளிர் பயணிகளுக்கு கட்டணமில்லா பேருந்து சேவை",
      wimbVetriSubtitle: "• வெற்றிப் பயணம்: பெண்களுக்கு இலவசம்",
      wimbStatusLabel: "நிலை",
      wimbStatusRunning: "🟢 இயக்கத்தில் உள்ளது",
      wimbStatusStopped: "🟡 நிறுத்தப்பட்டுள்ளது",
      wimbStatusOffline: "🔴 இயக்கத்தில் இல்லை",
      wimbLiveCrowdLabel: "கூட்ட நெரிசல்",
      wimbLiveSpeedLabel: "நேரடி வேகம்",
      wimbNextStopLabel: "அடுத்த நிறுத்தம்",
      wimbNextEtaLabel: "அடுத்த நிறுத்த ETA",
      wimbGpsFreshnessLabel: "GPS நிலை",
      wimbUpdatedLive: "நேரலையில் புதுப்பிக்கப்பட்டது",
      wimbFollowBus: "பேருந்தை பின்தொடர்",
      wimbStopFollowing: "பின்தொடர்வதை நிறுத்து",
      wimbFullRoute: "முழு வழித்தடம்",
      wimbWakeMeUp: "அலாரம் வை",
      wimbOfflineTitle: "இந்தப் பேருந்து தற்போது இயக்கத்தில் இல்லை",
      wimbOfflineDesc: "பேருந்து தனது பயணத்தை முடித்துவிட்டது, தற்போது நேரடி GPS தகவல் அனுப்பப்படவில்லை.",
      wimbBackBtn: "பயணியர் பக்கத்திற்குத் திரும்புக",
      wimbTimelineHeading: "பயண நிறுத்தங்கள் & காலவரிசை",
      wimbNextApproaching: "அடுத்து வரும் நிறுத்தம்",
      wimbStopsReached: "நிறுத்தங்கள் கடக்கப்பட்டது",

      // Nearest Stop Map
      nearestStopTitle: "அருகிலுள்ள பேருந்து நிறுத்தம் வரைபடம்",
      nearestStopDesc: "உங்கள் இருப்பிடம், அருகிலுள்ள நிறுத்தம் மற்றும் வழித்தட விவரங்கள்.",
      backBtn: "பின்செல்",
      metersAway: "மீட்டர் தொலைவில்",
      youAreHere: "நீங்கள் இருக்கும் இடம்",
      noNearbyStopsFound: "அருகில் நிறுத்தங்கள் எதுவும் கண்டறியப்படவில்லை.",
      locationPermissionDenied: "உங்கள் இருப்பிடத்தை அணுக முடியவில்லை. Location அனுமதியை வழங்கவும்.",
      nearestStopFoundToast: "அருகிலுள்ள நிறுத்தம் கண்டறியப்பட்டது:"
    }
  };

  // Well-crafted bilingual translation dictionary for Tirunelveli bus stops
  const stopTranslations = {
    "Junction Railway Station": "சந்திப்பு ரயில் நிலையம்",
    "Junction Bus Stand": "சந்திப்பு பேருந்து நிலையம்",
    "Aravind Eye Hospital": "அரவிந்த் கண் மருத்துவமனை",
    "Aravind  Eye Hospital": "அரவிந்த் கண் மருத்துவமனை",
    "Science center": "அறிவியல் மையம் (Science Centre)",
    "Science Center": "அறிவியல் மையம் (Science Centre)",
    "Vannerpettai": "வண்ணார்பேட்டை",
    "Vannarpettai": "வண்ணார்பேட்டை",
    "Cathedral Church": "கத்தீட்ரல் பேராலயம்",
    "TVS Showroom": "டி.வி.எஸ் ஷோரூம்",
    "Palayamkottai Bus Stand": "பாளையங்கோட்டை பேருந்து நிலையம்",
    "Market": "மார்க்கெட்",
    "Old Police Station": "பழைய காவல் நிலையம்",
    "Samathanapuram": "சமாதானபுரம்",
    "Court": "நீதிமன்றம்",
    "New Bus Stand": "புதிய பேருந்து நிலையம் (வேய்ந்தான்குளம்)",
    "New Bus Stand (Vaeinthaankulam)": "புதிய பேருந்து நிலையம் (வேய்ந்தான்குளம்)",
    "VOC Ground / St. Xavier's": "வ.உ.சி மைதானம் / சேவியர் கல்லூரி",
    "Nellai Railway Junction": "நெல்லை ரயில்வே சந்திப்பு",
    "Tirunelveli Town Swami Nellaiappar Temple": "திருநெல்வேலி டவுன் நெல்லையப்பர் கோவில்",
    "Vannarpettai Bridge Bypass": "வண்ணார்பேட்டை பாலம் பைபாஸ்",
    "Tirunelveli Collectorate & Court": "திருநெல்வேலி ஆட்சியர் அலுவலகம் & நீதிமன்றம்",
    "TVMCH Medical College Hospital (High Ground)": "நெல்லை அரசு மருத்துவக் கல்லூரி மருத்துவமனை (ஹை கிரவுண்ட்)",
    "Reddiarpatti Hill Road": "ரெட்டியார்பட்டி மலைச் சாலை",
    "Anna Stadium & Armed Reserve": "அண்ணா விளையாட்டரங்கம் & ஆயுதப்படை"
  };

  // Route Name Dictionary
  const routeTranslations = {
    "Junction Railway Station to New Bus Stand": "சந்திப்பு ரயில் நிலையம் முதல் புதிய பேருந்து நிலையம் வரை",
    "New Bus Stand to Junction Railway Station": "புதிய பேருந்து நிலையம் முதல் சந்திப்பு ரயில் நிலையம் வரை",
    "Palayamkottai to Town": "பாளையங்கோட்டை முதல் டவுன் வரை",
    "Town to Palayamkottai": "டவுன் முதல் பாளையங்கோட்டை வரை"
  };

  class I18nManager {
    constructor() {
      let saved = 'en';
      try {
        saved = localStorage.getItem(STORAGE_KEY) || 'en';
      } catch (e) {}
      this.currentLang = (saved === 'ta') ? 'ta' : 'en';

      if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
          setTimeout(() => this.init(), 0);
        }
      }
    }

    init() {
      if (typeof document === 'undefined') return;
      document.documentElement.lang = this.currentLang;
      document.body.classList.toggle('lang-ta', this.currentLang === 'ta');
      this.applyTranslations();
      this.updateSwitcherUI();
    }

    getLanguage() {
      return this.currentLang;
    }

    setLanguage(lang) {
      this.currentLang = (lang === 'ta') ? 'ta' : 'en';
      try {
        localStorage.setItem(STORAGE_KEY, this.currentLang);
      } catch (e) {}

      document.documentElement.lang = this.currentLang;
      document.body.classList.toggle('lang-ta', this.currentLang === 'ta');

      this.applyTranslations();
      this.updateSwitcherUI();

      // Trigger re-renders across passenger & where-is-my-bus controllers
      if (window.passenger && typeof window.passenger.render === 'function') {
        window.passenger.populateRouteDropdown();
        window.passenger.populateStopDropdown();
        window.passenger.populateDestDropdown();
        window.passenger.render();
      }

      if (window.wimb && typeof window.wimb.render === 'function') {
        if (window.wimb.currentBusId) {
          window.wimb.loadBus(window.wimb.currentBusId);
        } else {
          window.wimb.render();
        }
      }

      if (window.app && typeof window.app.updateActiveBusesBadge === 'function') {
        window.app.updateActiveBusesBadge();
      }
    }

    t(key, fallback = '') {
      const dict = translations[this.currentLang] || translations.en;
      if (dict && dict[key] !== undefined) {
        return dict[key];
      }
      const enDict = translations.en;
      if (enDict && enDict[key] !== undefined) {
        return enDict[key];
      }
      return fallback || key;
    }

    getStopName(name) {
      if (!name) return '';
      if (this.currentLang === 'ta') {
        const clean = name.trim();
        return stopTranslations[clean] || name;
      }
      return name;
    }

    getRouteName(name) {
      if (!name) return '';
      if (this.currentLang === 'ta') {
        const clean = name.trim();
        if (routeTranslations[clean]) return routeTranslations[clean];

        // Dynamic translate "X to Y"
        if (clean.includes(' to ')) {
          const parts = clean.split(' to ');
          const from = stopTranslations[parts[0].trim()] || parts[0].trim();
          const to = stopTranslations[parts[1].trim()] || parts[1].trim();
          return `${from} முதல் ${to} வரை`;
        }
      }
      return name;
    }

    applyTranslations() {
      // 1. Elements with data-i18n
      const elements = document.querySelectorAll('[data-i18n]');
      elements.forEach((el) => {
        const key = el.getAttribute('data-i18n');
        const translated = this.t(key);
        if (translated) {
          el.textContent = translated;
        }
      });

      // 2. Elements with data-i18n-html
      const htmlElements = document.querySelectorAll('[data-i18n-html]');
      htmlElements.forEach((el) => {
        const key = el.getAttribute('data-i18n-html');
        const translated = this.t(key);
        if (translated) {
          el.innerHTML = translated;
        }
      });

      // 3. Placeholders with data-i18n-placeholder
      const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
      placeholderElements.forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = this.t(key);
        if (translated) {
          el.setAttribute('placeholder', translated);
        }
      });
    }

    updateSwitcherUI() {
      const btnEn = document.getElementById('langBtnEn');
      const btnTa = document.getElementById('langBtnTa');
      if (btnEn && btnTa) {
        btnEn.classList.toggle('active', this.currentLang === 'en');
        btnTa.classList.toggle('active', this.currentLang === 'ta');
      }
    }
  }

  window.I18n = new I18nManager();
})();
