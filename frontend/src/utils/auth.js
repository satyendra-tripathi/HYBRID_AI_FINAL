/**
 * Auth utility functions for token and user management
 */

export const auth = {
  /**
   * Store auth data (token and user)
   */
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  /**
   * Get stored token
   */
  getToken: () => {
    return localStorage.getItem('token');
  },

  /**
   * Get stored user
   */
  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  /**
   * Clear auth data (logout)
   */
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /**
   * Check if token is expired (basic check)
   */
  isTokenExpired: (token) => {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch (error) {
      return true;
    }
  },
};

export default auth;
