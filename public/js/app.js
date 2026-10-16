/**
 * AppController: Main Application Coordinator, Role Navigation, Fullscreen Authentication & Toasts
 */
class AppController {
  constructor() {
    this.currentPortal = 'passenger';
    this.selectedLoginRole = 'passenger';
  }

  init() {
    const user = window.appState.currentUser;

    if (user) {
      this.showMainApp(user);
    } else {
      this.showInitialLoginScreen();
    }

    if (window.lucide) {
      lucide.createIcons();
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

    // Just highlight passenger tab by default, fields stay empty for manual input
    document.querySelectorAll('.role-select-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-role') === 'passenger');
    });
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

    if (user.role === 'passenger') {
      // Passenger only sees Passenger search and Where Is My Bus (initially hidden)
      if (tabPassenger) tabPassenger.style.display = 'inline-flex';
      if (tabWimb) tabWimb.style.display = 'none';
      if (tabBus) tabBus.style.display = 'none';
      if (tabAdmin) tabAdmin.style.display = 'none';
    } else if (user.role === 'Bus') {
      // Bus only sees Bus console
      if (tabPassenger) tabPassenger.style.display = 'none';
      if (tabWimb) tabWimb.style.display = 'none';
      if (tabBus) tabBus.style.display = 'inline-flex';
      if (tabAdmin) tabAdmin.style.display = 'none';
    } else if (user.role === 'admin') {
      // Admin sees Fleet Admin control center
      if (tabPassenger) tabPassenger.style.display = 'none';
      if (tabWimb) tabWimb.style.display = 'none';
      if (tabBus) tabBus.style.display = 'none';
      if (tabAdmin) tabAdmin.style.display = 'inline-flex';
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

    // Show registration toggle ONLY on passenger tab (Buss and admins are pre-assigned)
    const authToggle = document.getElementById('passengerAuthToggle');
    if (authToggle) {
      authToggle.style.display = role === 'passenger' ? 'block' : 'none';
    }

    // Clear fields so user types fresh
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

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, role: 'passenger' })
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        window.appState.setCurrentUser(data.user);
        this.showMainApp(data.user);
        this.showToast(`Account created successfully! Welcome, ${data.user.name}! 🎉`, 'success');
      } else {
        this.showToast(data.error || 'Could not complete registration.', 'error');
      }
    } catch (err) {
      // Local fallback registration
      const existing = (window.appState.users || []).find((u) => u.email === email);
      if (existing) {
        this.showToast('An account with this email already exists.', 'error');
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

      if (!window.appState.users) window.appState.users = [];
      window.appState.users.push(newUser);

      window.appState.setCurrentUser(newUser);
      this.showMainApp(newUser);
      this.showToast(`Account created! Welcome, ${newUser.name}! 🎉`, 'success');
    }
  }

  /**
   * Handles manual credential submission from the initial login screen with strict role validation
   */
  async handleFullscreenLogin(event) {
    event.preventDefault();
    const email = document.getElementById('fsLoginEmail').value.trim();
    const password = document.getElementById('fsLoginPassword').value.trim();
    const expectedRole = this.selectedLoginRole || 'passenger';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, expectedRole })
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        if (data.user.role !== expectedRole) {
          const actualRole = data.user.role.toUpperCase();
          this.showToast(`Access Denied: This is a ${actualRole} account. Please click the ${actualRole} tab to sign in.`, 'error');
          return;
        }
        window.appState.setCurrentUser(data.user);
        this.showMainApp(data.user);
        this.showToast(`Welcome back, ${data.user.name}! (${data.user.role.toUpperCase()})`, 'success');
      } else {
        this.showToast(data.error || 'Invalid email or password.', 'error');
      }
    } catch (err) {
      // Local fallback lookup with strict role verification
      const matched = (window.appState.users || []).find(
        (u) => (u.email === email || u.id === email || u.busId === email) && u.password === password
      );

      if (matched) {
        if (matched.role !== expectedRole) {
          const actualRole = matched.role.toUpperCase();
          this.showToast(`Access Denied: This is a ${actualRole} account. Please click the ${actualRole} tab to sign in.`, 'error');
          return;
        }
        window.appState.setCurrentUser(matched);
        this.showMainApp(matched);
        this.showToast(`Logged in as ${matched.name} (${matched.role.toUpperCase()})`, 'success');
      } else {
        this.showToast('Invalid credentials. Please verify your email and password.', 'error');
      }
    }
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

    if (window.lucide) {
      setTimeout(() => lucide.createIcons(), 50);
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
