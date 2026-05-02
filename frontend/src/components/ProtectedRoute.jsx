import React from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../utils/auth.js';

/**
 * ProtectedRoute component
 * Redirects to login if not authenticated
 */
export const ProtectedRoute = ({ children }) => {
  const isAuthenticated = auth.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
