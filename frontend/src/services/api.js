import axios from 'axios';

// API base URL
const API_URL = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8080' : '');

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
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

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      alert('인증이 필요합니다. 다시 로그인해주세요.');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verifyToken: () => api.get('/auth/verify'),
};

// Events API
export const eventsAPI = {
  getAll: (params) => api.get('/events', { params }),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
};

// Reservations API
export const reservationsAPI = {
  getAll: (params) => api.get('/reservations', { params }),
  getById: (id) => api.get(`/reservations/${id}`),
  create: (data) => api.post('/reservations', data),
  cancel: (id) => api.delete(`/reservations/${id}`),
};

// Seats API
export const seatsAPI = {
  getByEvent: (eventId) => api.get(`/seats/event/${eventId}`),
  reserve: (data) => api.post('/seats/reserve', data),
};

// Tickets API
export const ticketsAPI = {
  getByEvent: (eventId) => api.get(`/tickets/event/${eventId}`),
};

// Queue API
export const queueAPI = {
  join: (data) => api.post('/queue/join', data),
  getStatus: (userId, eventId) => api.get(`/queue/status/${userId}/${eventId}`),
};

// Payments API
export const paymentsAPI = {
  create: (data) => api.post('/payments', data),
  verify: (id) => api.get(`/payments/${id}/verify`),
  getByReservation: (reservationId) => api.get(`/payments/reservation/${reservationId}`),
};

// Admin API
export const adminAPI = {
  getDashboardStats: () => api.get('/stats/dashboard'),
  getStats: () => api.get('/stats/summary'),
  getReservations: (params) => api.get('/stats/reservations', { params }),
  getEvents: (params) => api.get('/events', { params }),
  updateEvent: (id, data) => api.put(`/events/${id}`, data),
  deleteEvent: (id) => api.delete(`/events/${id}`),
};

// News API (구현 예정)
export const newsAPI = {
  getAll: (params) => api.get('/news', { params }),
  getById: (id) => api.get(`/news/${id}`),
};

// Image API (mock)
export const imageAPI = {
  upload: async (file) => {
    // Mock implementation
    return { data: { url: '/images/placeholder.svg' } };
  },
};

export default api;
