// Logout functionality for Blood Finder

// Main logout function
async function logoutUser() {
  try {
    // Call logout API (optional - for server-side tracking)
    const token = localStorage.getItem('token');
    if (token && window.bloodFinderAPI) {
      try {
        await window.bloodFinderAPI.auth.logout();
      } catch (error) {
        console.log('Logout API call failed, continuing with local logout');
      }
    }

    // Disconnect socket if connected
    if (window.socketService) {
      window.socketService.disconnect();
    }

    // Clear all auth-related data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    localStorage.removeItem('tempPhone');
    localStorage.removeItem('tempUserId');

    // Show success message
    showLogoutMessage();

    // Redirect to login page after short delay
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);

  } catch (error) {
    console.error('Logout error:', error);
    // Force logout even if API fails
    forceLogout();
  }
}

// Force logout without API call
function forceLogout() {
  // Disconnect socket
  if (window.socketService) {
    window.socketService.disconnect();
  }

  // Clear all storage
  localStorage.clear();
  sessionStorage.clear();

  // Redirect to login
  window.location.href = 'login.html';
}

// Show logout success message
function showLogoutMessage() {
  // Create toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-family: 'Outfit', sans-serif;
    font-weight: 500;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideInRight 0.3s ease;
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  toast.innerHTML = `
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
    </svg>
    Logged out successfully!
  `;

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Confirm logout with dialog
function confirmLogout() {
  // Create custom confirm dialog
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 32px;
    border-radius: 20px;
    max-width: 400px;
    width: 90%;
    text-align: center;
    animation: scaleIn 0.2s ease;
  `;

  dialog.innerHTML = `
    <div style="width: 64px; height: 64px; background: #FEE2E2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
      <svg width="32" height="32" fill="none" stroke="#DC2626" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
      </svg>
    </div>
    <h3 style="font-size: 20px; font-weight: 700; color: #1A1A2E; margin-bottom: 8px;">Logout?</h3>
    <p style="color: #6B7280; margin-bottom: 24px;">Are you sure you want to logout from your account?</p>
    <div style="display: flex; gap: 12px;">
      <button id="cancelLogout" style="flex: 1; padding: 12px; border: 2px solid #E5E7EB; background: white; border-radius: 10px; font-weight: 600; color: #6B7280; cursor: pointer;">Cancel</button>
      <button id="confirmLogout" style="flex: 1; padding: 12px; border: none; background: linear-gradient(135deg, #D62839 0%, #B51F2E 100%); border-radius: 10px; font-weight: 600; color: white; cursor: pointer;">Logout</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Add animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  `;
  document.head.appendChild(style);

  // Event listeners
  document.getElementById('cancelLogout').addEventListener('click', () => {
    overlay.remove();
  });

  document.getElementById('confirmLogout').addEventListener('click', () => {
    overlay.remove();
    logoutUser();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Check if user is logged in
function isLoggedIn() {
  return !!localStorage.getItem('token');
}

// Protect route - redirect to login if not authenticated
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Get current user data
function getCurrentUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// Export functions
window.logoutUser = logoutUser;
window.forceLogout = forceLogout;
window.confirmLogout = confirmLogout;
window.isLoggedIn = isLoggedIn;
window.requireAuth = requireAuth;
window.getCurrentUser = getCurrentUser;
