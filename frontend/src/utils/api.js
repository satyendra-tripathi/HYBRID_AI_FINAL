// import axios from 'axios';

// // Get API base URL from environment
// const API_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000';

// // Create axios instance
// const api = axios.create({
//   baseURL: API_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// /**
//  * Add JWT token to request headers
//  */
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem('token');
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// }, (error) => {
//   return Promise.reject(error);
// });

// /**
//  * Handle response errors
//  */
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response?.status === 401) {
//       // Clear token and redirect to login
//       localStorage.removeItem('token');
//       localStorage.removeItem('user');
//       window.location.href = '/login';
//     }
//     return Promise.reject(error);
//   }
// );

// /**
//  * Auth endpoints
//  */
// export const authAPI = {
//   register: (data) => api.post('/api/auth/register', data),
//   login: (data) => api.post('/api/auth/login', data),
//   getCurrentUser: () => api.get('/api/auth/me'),
//   updateProfile: (data) => api.put('/api/auth/profile', data),
//   updatePreferences: (data) => api.patch('/api/auth/preferences', data),
//   logout: () => api.post('/api/auth/logout'),
// };

// /**
//  * Analysis endpoints
//  */
// export const analyzeAPI = {
//   analyzeTraffic: (data) => api.post('/api/analyze', data),
//   analyzeTrafficBatch: (data) => api.post('/api/analyze/batch', data),
//   getStatistics: (days = 7) => api.get(`/api/analyze/statistics?days=${days}`),
//   getSeverityTimeline: (days = 7) => api.get(`/api/analyze/severity-timeline?days=${days}`),
// };

// /**
//  * Logs endpoints
//  */
// export const logsAPI = {
//   getLogs: (page = 1, limit = 20, attackType = 'All', severity = 'All') =>
//     api.get(`/api/logs?page=${page}&limit=${limit}&attackType=${attackType}&severity=${severity}`),
//   getLogById: (id) => api.get(`/api/logs/${id}`),
//   searchLogs: (params) => api.get('/api/logs/search', { params }),
//   updateLogStatus: (id, data) => api.patch(`/api/logs/${id}/status`, data),
//   killLog: (id) => api.post(`/api/logs/${id}/kill`),
//   deleteLog: (id) => api.delete(`/api/logs/${id}`),
//   getLogStats: (days = 30) => api.get(`/api/logs/stats?days=${days}`),
//   exportLogsCSV: () => api.get('/api/logs/export/csv'),
// };

// /**
//  * Metrics endpoints
//  */
// export const metricsAPI = {
//   getMetrics: () => api.get('/api/metrics'),
// };

// export default api;



import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_APP_API_URL ||
  "https://hybrid-ai-final-1.onrender.com";

const api = axios.create({
  baseURL: API_URL.replace(/\/$/, ""),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginPage = window.location.pathname === "/login";
    const isRegisterPage = window.location.pathname === "/register";

    if (
      error.response?.status === 401 &&
      !isLoginPage &&
      !isRegisterPage
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => {
    const payload = {
      name: data.name?.trim(),
      email: data.email?.trim().toLowerCase(),
      password: data.password,
    };

    return api.post("/api/auth/register", payload);
  },

  login: (data) => {
    const payload = {
      email: data.email?.trim().toLowerCase(),
      password: data.password,
    };

    return api.post("/api/auth/login", payload);
  },

  getCurrentUser: () => api.get("/api/auth/me"),
  updateProfile: (data) => api.put("/api/auth/profile", data),
  updatePreferences: (data) => api.patch("/api/auth/preferences", data),
  logout: () => api.post("/api/auth/logout"),
};

export const analyzeAPI = {
  analyzeTraffic: (data) => api.post("/api/analyze", data),
  analyzeTrafficBatch: (data) => api.post("/api/analyze/batch", data),
  getStatistics: (days = 7) =>
    api.get("/api/analyze/statistics", { params: { days } }),
  getSeverityTimeline: (days = 7) =>
    api.get("/api/analyze/severity-timeline", { params: { days } }),
};

export const logsAPI = {
  getLogs: (page = 1, limit = 20, attackType = "All", severity = "All") =>
    api.get("/api/logs", {
      params: { page, limit, attackType, severity },
    }),

  getLogById: (id) => api.get(`/api/logs/${id}`),
  searchLogs: (params) => api.get("/api/logs/search", { params }),
  updateLogStatus: (id, data) => api.patch(`/api/logs/${id}/status`, data),
  killLog: (id) => api.post(`/api/logs/${id}/kill`),
  deleteLog: (id) => api.delete(`/api/logs/${id}`),
  getLogStats: (days = 30) =>
    api.get("/api/logs/stats", { params: { days } }),
  exportLogsCSV: () =>
    api.get("/api/logs/export/csv", {
      responseType: "blob",
    }),
};

export const metricsAPI = {
  getMetrics: () => api.get("/api/metrics"),
};

export default api;