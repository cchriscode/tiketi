import axios from 'axios';

// Use relative URL for production (works with nginx proxy)
// Falls back to localhost for local development without proxy
// Supports WSL IP addresses (e.g., 172.17.x.x) for WSL-based development
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  const hostname = window.location.hostname;

  // localhost: use localhost:3001
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }

  // WSL IP or other local IP: use same IP with port 3001
  if (hostname.match(/^(172\.|192\.168\.|10\.)/)) {
    return `http://${hostname}:3001`;
  }

  // Production: use relative URL (empty string)
  return '';
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Show user-friendly message
      const errorCode = error.response?.data?.code;
      if (errorCode === 'USER_NOT_FOUND') {
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      } else {
        alert('인증이 필요합니다. 로그인해주세요.');
      }

      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs - Routed through Backend API Gateway (port 3001)
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

// Events APIs
export const eventsAPI = {
  getAll: (params) => api.get('/events', { params }),
  getById: (id) => api.get(`/events/${id}`),
};

// Tickets APIs
export const ticketsAPI = {
  getByEvent: (eventId) => api.get(`/tickets/event/${eventId}`),
  checkAvailability: (ticketTypeId) => api.get(`/tickets/availability/${ticketTypeId}`),
};

// Reservations APIs
export const reservationsAPI = {
  create: (data) => api.post('/reservations', data),
  getMy: () => api.get('/reservations/my'),
  getById: (id) => api.get(`/reservations/${id}`),
  cancel: (id) => api.post(`/reservations/${id}/cancel`),
};

// Seats APIs
export const seatsAPI = {
  getByEvent: (eventId) => api.get(`/seats/events/${eventId}`),
  reserve: (data) => api.post('/seats/reserve', data),
};

// Payments APIs
export const paymentsAPI = {
  prepare: (data) => api.post('/payments/prepare', data),
  confirm: (data) => api.post('/payments/confirm', data),
  process: (data) => api.post('/payments/process', data),
};

// Stats APIs
export const statsAPI = {
  getOverview: () => api.get('/stats/overview'),
  getDaily: (days) => api.get('/stats/daily', { params: { days } }),
  getEvents: (params) => api.get('/stats/events', { params }),
  getPayments: () => api.get('/stats/payments'),
  getRevenue: (params) => api.get('/stats/revenue', { params }),
  getHourlyTraffic: (days) => api.get('/stats/hourly-traffic', { params: { days } }),
  getConversion: (days) => api.get('/stats/conversion', { params: { days } }),
  getCancellations: (days) => api.get('/stats/cancellations', { params: { days } }),
  getRealtime: () => api.get('/stats/realtime'),
  getSeatPreferences: () => api.get('/stats/seat-preferences'),
  getUserBehavior: (days) => api.get('/stats/user-behavior', { params: { days } }),
  getPerformance: () => api.get('/stats/performance'),
};

// Admin APIs
export const adminAPI = {
  getDashboardStats: () => api.get('/admin/dashboard/stats'),

  // Events
  createEvent: (data) => api.post('/admin/events', data),
  updateEvent: (id, data) => api.put(`/admin/events/${id}`, data),
  deleteEvent: (id) => api.delete(`/admin/events/${id}`),
  cancelEvent: (id) => api.post(`/admin/events/${id}/cancel`),

  // Tickets
  createTicket: (eventId, data) => api.post(`/admin/events/${eventId}/tickets`, data),
  updateTicket: (id, data) => api.put(`/admin/tickets/${id}`, data),

  // Reservations
  getAllReservations: (params) => api.get('/admin/reservations', { params }),
  updateReservationStatus: (id, data) => api.patch(`/admin/reservations/${id}/status`, data),
};

export const imageAPI = {
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);

    return api.post('/image/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }
}

// News APIs
// ⚠️ TODO: Migrate /news endpoints from legacy backend to microservices
// Currently only available in legacy backend, not in microservices architecture
export const newsAPI = {
  getAll: (params) => api.get('/news', { params }),
  getById: (id) => api.get(`/news/${id}`),
  create: (data) => api.post('/news', data),
  update: (id, data) => api.put(`/news/${id}`, data),
  delete: (id) => api.delete(`/news/${id}`),
};

export default api;

