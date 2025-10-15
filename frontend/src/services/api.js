import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

// Auth APIs
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
  process: (data) => api.post('/payments/process', data),
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

export default api;

