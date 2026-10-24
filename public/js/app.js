/**
 * AppController: Main Application Coordinator, Role Navigation, Fullscreen Authentication & Toasts
 */
class AppController {
  constructor() {
    this.currentPortal = 'passenger';
    this.selectedLoginRole = 'passenger';
  }

  init() {
    // 1. Detect flavor immediately on startup from window, Android service, or localStorage
    let flavor = window.APP_FLAVOR;
    if (!flavor && window.AndroidGpsService && typeof window.AndroidGpsService.getFlavor === 'function') {
      try {
        const f = window.AndroidGpsService.getFlavor();
        if (f && f !== 'all') flavor = f;
      } catch (e) {}
    }
    if (!flavor) {
      try {
        const cached = localStorage.getItem('citybus_app_flavor');
        if (cached && cached !== 'all') flavor = cached;
      } catch (e) {}
    }

    if (flavor && flavor !== 'all') {
      this.appFlavor = flavor;
      window.APP_FLAVOR = flavor;
      try { localStorage.setItem('citybus_app_flavor', flavor); } catch (e) {}
    }

    try {
      const savedPassengers = JSON.parse(localStorage.getItem('citybus_registered_passengers') || '[]');
      if (Array.isArray(savedPassengers) && savedPassengers.length > 0) {
        if (!window.appState.users) window.appState.users = [];
        savedPassengers.forEach(sp => {
          if (!window.appState.users.some(u => u.email && u.email.toLowerCase() === sp.email.toLowerCase())) {
            window.appState.users.push(sp);
          }
        });
      }
    } catch (e) {}

    const user = window.appState.currentUser;

    if (user) {
      this.showMainApp(user);
    } else {
      this.showInitialLoginScreen();
    }

    if (this.appFlavor && this.appFlavor !== 'all') {
      this.applyAppFlavor(this.appFlavor);
    }

    // Auto-update Active Buses Live network badge whenever bus states change
    if (window.appState && typeof window.appState.subscribe === 'function') {
      window.appState.subscribe(() => {
        this.updateActiveBusesBadge();
      });
    }
    this.updateActiveBusesBadge();

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  /**
   * Applies dedicated UI mode when running as a dedicated flavor (Passenger, Driver, or Admin app)
   */
  applyAppFlavor(flavor) {
    if (!flavor || flavor === 'all') return;
    this.appFlavor = flavor;
    try { localStorage.setItem('citybus_app_flavor', flavor); } catch (e) {}

    // Filter role-selector buttons on login screen so only the relevant role is shown
    const roleBtns = document.querySelectorAll('.role-select-btn');
    roleBtns.forEach(btn => {
      const btnRole = btn.getAttribute('data-role');
      if (btnRole === flavor) {
        btn.style.setProperty('display', 'inline-flex', 'important');
        btn.classList.add('active');
      } else {
        btn.style.setProperty('display', 'none', 'important');
        btn.classList.remove('active');
      }
    });

    // Auto-select this flavor's role
    this.selectLoginRole(flavor);

    // If user is already logged in, enforce role tab visibility
    const user = window.appState.currentUser;
    if (user) {
      this.syncRoleBasedTabs(user);
    }
  }

  /**
   * Displays the initial full-screen login barrier before the home page
   */
  showInitialLoginScreen() {
    const loginOverlay = document.getElementById('loginScreenView');
    const mainWrapper = document.getElementById('appMainWrapper');

    if (loginOverlay) loginOverlay.classList.add('active');
    if (mainWrapper) mainWrapper.style.display = 'none';

    if (this.appFlavor && this.appFlavor !== 'all') {
      this.applyAppFlavor(this.appFlavor);
    } else {
      document.querySelectorAll('.role-select-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-role') === 'passenger');
      });
    }
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Unlocks the main application interface upon successful authentication
   */
  showMainApp(user) {
    const loginOverlay = document.getElementById('loginScreenView');
    const mainWrapper = document.getElementById('appMainWrapper');

    if (loginOverlay) loginOverlay.classList.remove('active');
    if (mainWrapper) mainWrapper.style.display = 'block';

    // Strictly enforce role-based tab visibility in header
    this.syncRoleBasedTabs(user);

    this.renderAuthPill();

    // Route user to their role-specific home portal
    if (user.role === 'admin') {
      this.navigate('admin');
    } else if (user.role === 'Bus') {
      this.navigate('Bus');
    } else {
      this.navigate('passenger');
    }
  }

  /**
   * Strictly filters header navigation tabs according to the logged-in user's role
   */
  syncRoleBasedTabs(user) {
    const tabPassenger = document.getElementById('navTabPassenger');
    const tabWimb = document.getElementById('navTabWimb');
    const tabBus = document.getElementById('navTabBus');
    const tabAdmin = document.getElementById('navTabAdmin');

    if (!user) return;

    const genderToggle = document.getElementById('passengerGenderToggle');

    if (user.role === 'passenger') {
      // Passenger only sees Passenger search and Where Is My Bus (initially hidden)
      if (tabPassenger) tabPassenger.style.display = 'inline-flex';
      if (tabWimb) tabWimb.style.display = 'none';
      if (tabBus) tabBus.style.display = 'none';
      if (tabAdmin) tabAdmin.style.display = 'none';
      if (genderToggle) genderToggle.style.display = 'inline-flex';
    } else if (user.role === 'Bus') {
      // Bus only sees Bus console - NO male/female controls
      if (tabPassenger) tabPassenger.style.display = 'none';
      if (tabWimb) tabWimb.style.display = 'none';
      if (tabBus) tabBus.style.display = 'inline-flex';
      if (tabAdmin) tabAdmin.style.display = 'none';
      if (genderToggle) genderToggle.style.display = 'none';
      document.body.classList.remove('female-mode');
    } else if (user.role === 'admin') {
      // Admin sees Fleet Admin control center - NO male/female controls
      if (tabPassenger) tabPassenger.style.display = 'none';
      if (tabWimb) tabWimb.style.display = 'none';
      if (tabBus) tabBus.style.display = 'none';
      if (tabAdmin) tabAdmin.style.display = 'inline-flex';
      if (genderToggle) genderToggle.style.display = 'none';
      document.body.classList.remove('female-mode');
    }
  }

  /**
   * Switches the active role tab highlight only — user types credentials manually
   */
  selectLoginRole(role) {
    this.selectedLoginRole = role;

    // Highlight selected tab, clear fields for fresh manual entry
    document.querySelectorAll('.role-select-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-role') === role);
    });

    // Switch back to login form mode if user was on registration
    this.toggleAuthMode('login');

    // Show registration toggle and guest access ONLY on passenger tab
    const authToggle = document.getElementById('passengerAuthToggle');
    const guestAction = document.getElementById('passengerGuestAction');
    if (authToggle) {
      authToggle.style.display = role === 'passenger' ? 'block' : 'none';
    }
    if (guestAction) {
      guestAction.style.display = role === 'passenger' ? 'block' : 'none';
    }

    // Clear fields across all portals - no auto-fill
    const emailInput = document.getElementById('fsLoginEmail');
    const passInput  = document.getElementById('fsLoginPassword');
    if (emailInput) { emailInput.value = ''; emailInput.focus(); }
    if (passInput)  { passInput.value  = ''; }
  }

  /**
   * Toggles between Login and Register views for passengers
   */
  toggleAuthMode(mode) {
    const loginForm = document.getElementById('fullscreenLoginForm');
    const registerForm = document.getElementById('fullscreenRegisterForm');

    if (!loginForm || !registerForm) return;

    if (mode === 'register') {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      const nameInput = document.getElementById('fsRegName');
      if (nameInput) nameInput.focus();
    } else {
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';
      const emailInput = document.getElementById('fsLoginEmail');
      if (emailInput) emailInput.focus();
    }

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Saves newly registered passenger to local browser store so accounts persist
   * even across serverless cold starts or stateless cloud hosts
   */
  saveLocalRegisteredPassenger(user) {
    try {
      const list = JSON.parse(localStorage.getItem('citybus_registered_passengers') || '[]');
      const idx = list.findIndex(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());
      if (idx >= 0) {
        list[idx] = user;
      } else {
        list.push(user);
      }
      localStorage.setItem('citybus_registered_passengers', JSON.stringify(list));
      
      // Also sync into current session appState users
      if (!window.appState.users) window.appState.users = [];
      const stateIdx = window.appState.users.findIndex(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());
      if (stateIdx >= 0) {
        window.appState.users[stateIdx] = user;
      } else {
        window.appState.users.push(user);
      }
    } catch (e) {
      console.warn('Failed to save local passenger:', e);
    }
  }

  /**
   * Finds a user across local storage registered passengers and appState users
   */
  findLocalUser(email, password, expectedRole) {
    const cleanEmail = (email || '').trim().toLowerCase();
    
    // Check locally saved passengers first
    let localPassengers = [];
    try {
      localPassengers = JSON.parse(localStorage.getItem('citybus_registered_passengers') || '[]');
    } catch (e) {}

    const fromSaved = localPassengers.find(u => 
      u.email && u.email.toLowerCase() === cleanEmail && u.password === password
    );
    if (fromSaved) return fromSaved;

    // Check appState users (populated from Supabase or data.json)
    const allUsers = window.appState?.users || [];
    const matched = allUsers.find(u => 
      ((u.email && u.email.toLowerCase() === cleanEmail) || u.id === email || u.busId === email || u.bus_id === email) && 
      String(u.password) === String(password)
    );
    if (matched) return matched;

    // Hardcoded built-in offline credentials (guarantees offline access in mobile APK)
    const defaultAccounts = [
      {
        id: 'user-admin',
        email: 'admin@123',
        password: 'admin@123',
        name: 'Nellai Transit Control Officer',
        role: 'admin'
      },
      {
        id: 'bus-user-870',
        email: 'bus@1',
        password: '1',
        name: '1',
        role: 'Bus',
        busId: 'BUS-1',
        bus_id: 'BUS-1'
      }
    ];

    const hardcoded = defaultAccounts.find(u =>
      (u.email.toLowerCase() === cleanEmail || u.id === email || u.busId === email) &&
      String(u.password) === String(password)
    );
    return hardcoded || null;
  }

  /**
   * Handles new passenger self-registration
   */
  async handlePassengerRegister(event) {
    event.preventDefault();
    const name = document.getElementById('fsRegName').value.trim();
    const email = document.getElementById('fsRegEmail').value.trim();
    const phone = document.getElementById('fsRegPhone').value.trim();
    const password = document.getElementById('fsRegPassword').value;
    const confirmPassword = document.getElementById('fsRegConfirmPassword').value;

    if (password !== confirmPassword) {
      this.showToast('Passwords do not match. Please re-check.', 'error');
      return;
    }

    if (password.length < 6) {
      this.showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    const newUser = {
      id: 'user-pass-' + Math.floor(Math.random() * 9000 + 1000),
      name,
      email,
      phone,
      password,
      role: 'passenger'
    };

    // Always save locally so account is permanently remembered on this browser
    this.saveLocalRegisteredPassenger(newUser);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, role: 'passenger' })
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        this.saveLocalRegisteredPassenger(data.user);
        window.appState.setCurrentUser(data.user);
        this.showMainApp(data.user);
        this.showToast(`Account created successfully! Welcome, ${data.user.name}! 🎉`, 'success');
        return;
      }
    } catch (err) {
      console.warn('Backend register request failed, falling back to local persistent store:', err);
    }

    // Success with local persistent account
    window.appState.setCurrentUser(newUser);
    this.showMainApp(newUser);
    this.showToast(`Account created! Welcome, ${newUser.name}! 🎉`, 'success');
  }

  /**
   * Handles manual credential submission from the initial login screen with strict role validation
   */
  async handleFullscreenLogin(event) {
    event.preventDefault();
    const email = document.getElementById('fsLoginEmail').value.trim();
    const password = document.getElementById('fsLoginPassword').value.trim();
    const expectedRole = this.selectedLoginRole || 'passenger';

    // 1. Direct Supabase Cloud Auth Check (Works in APK with live database)
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('users')
          .select('*')
          .or(`email.ilike.${email},id.eq.${email}`)
          .eq('password', password)
          .limit(1);

        if (!error && data && data.length > 0) {
          const user = Object.assign({}, data[0]);
          let userRole = user.role;
          if (userRole === 'conductor') userRole = 'Bus';

          if (userRole !== expectedRole) {
            const actualRole = userRole.toUpperCase();
            this.showToast(`Access Denied: This is a ${actualRole} account. Please click the ${actualRole} tab to sign in.`, 'error');
            return;
          }
          user.role = userRole;
          if (user.bus_id && !user.busId) user.busId = user.bus_id;

          window.appState.setCurrentUser(user);
          this.showMainApp(user);
          this.showToast(`Welcome back, ${user.name}! (${user.role.toUpperCase()})`, 'success');
          return;
        }
      } catch (sbErr) {
        console.warn('Supabase direct auth attempt notice:', sbErr);
      }
    }

    // 2. REST backend fetch (for web/hosted environments)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, expectedRole })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          if (data.user.role !== expectedRole) {
            const actualRole = data.user.role.toUpperCase();
            this.showToast(`Access Denied: This is a ${actualRole} account. Please click the ${actualRole} tab to sign in.`, 'error');
            return;
          }
          window.appState.setCurrentUser(data.user);
          this.showMainApp(data.user);
          this.showToast(`Welcome back, ${data.user.name}! (${data.user.role.toUpperCase()})`, 'success');
          return;
        }
      }
    } catch (err) {
      console.warn('Network auth error, attempting local lookup:', err);
    }

    // 3. Local persistent account fallback (Works 100% offline in APK)
    const localUser = this.findLocalUser(email, password, expectedRole);
    if (localUser) {
      let userRole = localUser.role;
      if (userRole === 'conductor') userRole = 'Bus';

      if (userRole !== expectedRole) {
        const actualRole = userRole.toUpperCase();
        this.showToast(`Access Denied: This is a ${actualRole} account. Please click the ${actualRole} tab to sign in.`, 'error');
        return;
      }
      localUser.role = userRole;
      if (localUser.bus_id && !localUser.busId) localUser.busId = localUser.bus_id;

      window.appState.setCurrentUser(localUser);
      this.showMainApp(localUser);
      this.showToast(`Welcome back, ${localUser.name}! (${localUser.role.toUpperCase()})`, 'success');
      return;
    }

    this.showToast('Invalid email or password. Please verify your credentials.', 'error');
  }

  /**
   * Fast guest passenger entry
   */
  continueAsGuest() {
    const guestUser = {
      id: 'guest-' + Math.floor(Math.random() * 1000),
      name: 'Guest Passenger',
      email: 'guest@citybus.com',
      role: 'passenger'
    };

    window.appState.setCurrentUser(guestUser);
    this.showMainApp(guestUser);
    this.showToast('Continuing as Guest Passenger. Welcome!', 'info');
  }

  /**
   * Portal Navigation
   */
  navigate(portalName) {
    this.currentPortal = portalName;

    // Update nav tab active states
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      if (tab.getAttribute('data-portal') === portalName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Toggle portal sections
    document.querySelectorAll('.portal-view').forEach((view) => {
      view.classList.remove('active');
    });

    const targetSection = {
      'passenger': 'portalPassenger',
      'where-is-my-bus': 'portalWhereIsMyBus',
      'Bus': 'portalBus',
      'admin': 'portalAdmin'
    }[portalName];

    const targetEl = document.getElementById(targetSection);
    if (targetEl) {
      targetEl.classList.add('active');
    }

    const tabWimb = document.getElementById('navTabWimb');
    if (tabWimb && portalName !== 'where-is-my-bus') {
      tabWimb.style.display = 'none';
    }

    // Gender toggle is visible in Passenger portal & Where Is My Bus tracking screen (never in Bus or Admin)
    const genderToggle = document.getElementById('passengerGenderToggle');
    if (genderToggle) {
      genderToggle.style.display = (portalName === 'passenger' || portalName === 'where-is-my-bus') ? 'inline-flex' : 'none';
    }

    // Apply female-mode theme across all passenger screens (Passenger, Where Is My Bus, Nearest Stop Map)
    // Strictly removed only when in staff portals (Bus or admin)
    if (portalName === 'Bus' || portalName === 'admin') {
      document.body.classList.remove('female-mode');
    } else {
      const g = localStorage.getItem('citybus_passenger_gender') || 'male';
      if (g === 'female') {
        document.body.classList.add('female-mode');
      } else {
        document.body.classList.remove('female-mode');
      }
    }

    // Trigger subsystem init
    if (portalName === 'passenger' && window.passenger) {
      window.passenger.init();
    } else if (portalName === 'where-is-my-bus' && window.wimb) {
      window.wimb.init();
    } else if (portalName === 'Bus' && window.Bus) {
      window.Bus.init();
    } else if (portalName === 'admin' && window.admin) {
      window.admin.init();
    }

    // Always ensure Active Buses Live count is refreshed upon switching portals
    this.updateActiveBusesBadge();

    if (window.lucide) {
      setTimeout(() => lucide.createIcons(), 50);
    }
  }

  /**
   * Returns exact count of currently online live-tracking buses
   */
  getActiveLiveBusesCount() {
    if (!window.appState || !Array.isArray(window.appState.buses)) return 0;
    return window.appState.buses.filter(b => {
      return Boolean(b.isTripActive && b.status === 'Running');
    }).length;
  }

  /**
   * Dynamically updates the global Active Buses Live network badge across all portals (Passenger, Bus, Admin)
   */
  updateActiveBusesBadge() {
    const badgeText = document.getElementById('activeBusesCountText');
    const badgeWrap = document.getElementById('liveNetworkBadge');
    const pulseDot = document.getElementById('liveNetworkPulseDot') || document.querySelector('.live-network-badge .pulse-dot');
    if (!badgeText) return;

    const count = this.getActiveLiveBusesCount();
    if (badgeWrap) {
      badgeWrap.classList.toggle('idle', count === 0);
    }

    if (count === 0) {
      badgeText.textContent = '0 Active Buses Live';
      if (pulseDot) {
        pulseDot.className = 'pulse-dot amber';
      }
    } else if (count === 1) {
      badgeText.textContent = '1 Active Bus Live';
      if (pulseDot) {
        pulseDot.className = 'pulse-dot green';
      }
    } else {
      badgeText.textContent = `${count} Active Buses Live`;
      if (pulseDot) {
        pulseDot.className = 'pulse-dot green';
      }
    }
  }

  // Auth UI in Header
  renderAuthPill() {
    const pill = document.getElementById('userAuthPill');
    if (!pill) return;

    const user = window.appState.currentUser;

    if (user) {
      pill.innerHTML = `
        <div class="user-badge-pill">
          <i data-lucide="user-check" style="width: 16px; height: 16px; color: #2563eb;"></i>
          <span>${user.name}</span>
          <span class="role-tag">${user.role}</span>
          <button class="btn btn-xs btn-outline" onclick="app.logout()" title="Sign Out" style="padding: 0.2rem 0.5rem; margin-left: 0.25rem;">
            <i data-lucide="log-out" style="width: 12px; height: 12px;"></i> Logout
          </button>
        </div>
      `;
    } else {
      pill.innerHTML = `
        <button class="btn btn-outline btn-sm" onclick="app.showInitialLoginScreen()">
          <i data-lucide="log-in"></i> Sign In
        </button>
      `;
    }

    if (window.lucide) lucide.createIcons();
  }

  openLoginModal() {
    this.showInitialLoginScreen();
  }

  closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
  }

  logout() {
    window.appState.setCurrentUser(null);
    this.renderAuthPill();
    this.showInitialLoginScreen();
    this.showToast('You have been signed out.', 'info');
  }

  // Toast Notification Engine
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

window.app = new AppController();

// Boot application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
