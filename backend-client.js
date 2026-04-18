/**
 * Blood Finder Backend Client
 * Handles API calls and WebSocket connections for real-time location tracking
 */

const API_BASE_URL = `${window.location.origin}/api`;
const WS_URL = window.location.origin;

class BloodFinderClient {
  constructor() {
    this.token = localStorage.getItem('bf_token');
    this.socket = null;
    this.user = null;
    this.locationWatchId = null;
    this.isLiveSharing = false;
    this.eventListeners = {};
  }

  // ==================== AUTHENTICATION ====================

  async register(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      
      if (data.success) {
        this.token = data.data.token;
        this.user = data.data.user;
        localStorage.setItem('bf_token', this.token);
        localStorage.setItem('bf_session', JSON.stringify(this.user));
      }
      
      return data;
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async login(credentials) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await response.json();
      
      if (data.success) {
        this.token = data.data.token;
        this.user = data.data.user;
        localStorage.setItem('bf_token', this.token);
        localStorage.setItem('bf_session', JSON.stringify(this.user));
      }
      
      return data;
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  logout() {
    this.stopLiveLocation();
    this.disconnectSocket();
    this.token = null;
    this.user = null;
    localStorage.removeItem('bf_token');
    localStorage.removeItem('bf_session');
  }

  isLoggedIn() {
    return !!this.token;
  }

  // ==================== SOCKET.IO ====================

  connectSocket() {
    if (!this.token) {
      console.error('Cannot connect socket: No token');
      return;
    }

    if (this.socket && this.socket.connected) {
      return;
    }

    // Load Socket.IO client dynamically
    if (typeof io === 'undefined') {
      console.error('Socket.IO client not loaded');
      return;
    }

    this.socket = io(WS_URL);

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      
      // Authenticate socket
      this.socket.emit('authenticate', {
        userId: this.user?.id,
        token: this.token
      });
    });

    this.socket.on('authenticated', (data) => {
      console.log('Socket authenticated:', data);
      this.emit('socketAuthenticated', data);
    });

    this.socket.on('location_updated', (data) => {
      this.emit('locationUpdated', data);
    });

    this.socket.on('live_donors', (data) => {
      this.emit('liveDonorsReceived', data);
    });

    this.socket.on('live_status', (data) => {
      this.isLiveSharing = data.isLive;
      this.emit('liveStatusChanged', data);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emit('socketError', error);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.emit('socketDisconnected');
    });
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // ==================== LOCATION SERVICES ====================

  async updateLocation(latitude, longitude, accuracy = null) {
    try {
      const response = await fetch(`${API_BASE_URL}/location/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ latitude, longitude, accuracy })
      });
      return await response.json();
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async enableLiveLocationSharing() {
    if (!this.token) {
      return { success: false, message: 'Not authenticated' };
    }

    // Connect socket if not connected
    this.connectSocket();

    // Enable via API
    try {
      const response = await fetch(`${API_BASE_URL}/location/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ isSharing: true })
      });
      const data = await response.json();

      if (data.success) {
        this.isLiveSharing = true;
        this.startLocationTracking();
        
        // Join live donors room via socket
        if (this.socket) {
          this.socket.emit('go_live', {
            bloodGroup: this.user?.bloodGroup,
            isAvailable: true
          });
        }
      }

      return data;
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async disableLiveLocationSharing() {
    this.stopLocationTracking();
    
    if (this.socket) {
      this.socket.emit('stop_live');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/location/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ isSharing: false })
      });
      
      const data = await response.json();
      if (data.success) {
        this.isLiveSharing = false;
      }
      return data;
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  startLocationTracking() {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    // Stop any existing tracking
    this.stopLocationTracking();

    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        // Send via socket if connected (real-time)
        if (this.socket && this.socket.connected) {
          this.socket.emit('location_update', {
            latitude,
            longitude,
            accuracy,
            timestamp: new Date()
          });
        }
        
        // Also update via API as backup
        this.updateLocation(latitude, longitude, accuracy);
        
        this.emit('positionUpdate', { latitude, longitude, accuracy });
      },
      (error) => {
        console.error('Geolocation error:', error);
        this.emit('positionError', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  }

  stopLocationTracking() {
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
  }

  stopLiveLocation() {
    this.stopLocationTracking();
    this.disableLiveLocationSharing();
  }

  // Get current position (one-time)
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // ==================== DONOR SEARCH ====================

  async findNearbyDonors(latitude, longitude, options = {}) {
    const { radius = 10000, bloodGroup = null } = options;
    
    try {
      const response = await fetch(`${API_BASE_URL}/donors/nearby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.token ? `Bearer ${this.token}` : ''
        },
        body: JSON.stringify({ latitude, longitude, radius, bloodGroup })
      });
      return await response.json();
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findNearbyDonorsViaSocket(latitude, longitude, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const { radius = 10000, bloodGroup = null } = options;

      // Set up one-time listener for response
      this.socket.once('live_donors', (data) => {
        resolve(data);
      });

      // Request live donors
      this.socket.emit('get_live_donors', {
        latitude,
        longitude,
        radius,
        bloodGroup
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Timeout waiting for live donors'));
      }, 10000);
    });
  }

  async getLiveDonors(latitude, longitude, options = {}) {
    // Try socket first for real-time data, fall back to REST API
    if (this.socket && this.socket.connected) {
      try {
        return await this.findNearbyDonorsViaSocket(latitude, longitude, options);
      } catch (error) {
        console.log('Socket search failed, using REST API:', error);
      }
    }
    return await this.findNearbyDonors(latitude, longitude, options);
  }

  // ==================== EVENT HANDLING ====================

  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  // ==================== UTILITY ====================

  async fetchWithAuth(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    return response;
  }
}

// Create global instance
const bfClient = new BloodFinderClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BloodFinderClient, bfClient };
}
