// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Auth API
const authAPI = {
  register: (userData) => apiCall('/auth/register', {
    method: 'POST',
    body: userData
  }),

  login: (credentials) => apiCall('/auth/login', {
    method: 'POST',
    body: credentials
  }),

  getMe: () => apiCall('/auth/me'),

  updateProfile: (updates) => apiCall('/auth/profile', {
    method: 'PUT',
    body: updates
  }),

  updateAvailability: (availability) => apiCall('/auth/availability', {
    method: 'PUT',
    body: { availability }
  }),

  getNotifications: () => apiCall('/auth/notifications'),

  markNotificationsRead: () => apiCall('/auth/notifications/read', {
    method: 'PUT'
  }),

  logout: () => apiCall('/auth/logout', {
    method: 'POST'
  })
};

// Donor API
const donorAPI = {
  search: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/donors/search?${queryString}`);
  },

  nearby: (lat, lng, radius = 50, bloodType = '') => {
    const params = new URLSearchParams({ lat, lng, radius: radius.toString() });
    if (bloodType) params.append('bloodType', bloodType);
    return apiCall(`/donors/nearby?${params.toString()}`);
  },

  getAll: (page = 1, limit = 20) => 
    apiCall(`/donors?page=${page}&limit=${limit}`),

  getById: (id) => apiCall(`/donors/${id}`)
};

// Blood Request API
const requestAPI = {
  create: (requestData) => apiCall('/requests', {
    method: 'POST',
    body: requestData
  }),

  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/requests?${queryString}`);
  },

  getMyRequests: () => apiCall('/requests/my/requests'),

  getMyDonations: () => apiCall('/requests/my/donations'),

  getById: (id) => apiCall(`/requests/${id}`),

  respond: (id, message = '') => apiCall(`/requests/${id}/respond`, {
    method: 'POST',
    body: { message }
  }),

  acceptDonor: (id, donorId) => apiCall(`/requests/${id}/accept`, {
    method: 'PUT',
    body: { donorId }
  }),

  cancel: (id) => apiCall(`/requests/${id}/cancel`, {
    method: 'PUT'
  }),

  delete: (id) => apiCall(`/requests/${id}`, {
    method: 'DELETE'
  })
};

// OTP API
const otpAPI = {
  sendOTP: (phone, userId) => apiCall('/otp/send', {
    method: 'POST',
    body: { phone, userId }
  }),

  verifyOTP: (phone, otp, userId) => apiCall('/otp/verify', {
    method: 'POST',
    body: { phone, otp, userId }
  }),

  resendOTP: (phone, userId) => apiCall('/otp/resend', {
    method: 'POST',
    body: { phone, userId }
  }),

  getStatus: () => apiCall('/otp/status')
};

// Message API
const messageAPI = {
  send: (recipientId, content, relatedRequest = null) => apiCall('/messages', {
    method: 'POST',
    body: { recipient: recipientId, content, relatedRequest }
  }),

  getConversations: () => apiCall('/messages/conversations'),

  getMessages: (userId, page = 1, limit = 50) => 
    apiCall(`/messages/${userId}?page=${page}&limit=${limit}`),

  markAsRead: (userId) => apiCall(`/messages/read/${userId}`, {
    method: 'PUT'
  }),

  getUnreadCount: () => apiCall('/messages/unread/count'),

  delete: (id) => apiCall(`/messages/${id}`, {
    method: 'DELETE'
  })
};

// Export all APIs
window.bloodFinderAPI = {
  auth: authAPI,
  donors: donorAPI,
  requests: requestAPI,
  messages: messageAPI,
  otp: otpAPI
};
