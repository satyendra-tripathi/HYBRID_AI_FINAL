import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './utils/auth.js';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Pages
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Logs from './pages/Logs.jsx';
import Profile from './pages/Profile.jsx';

import './index.css';

import { Toaster } from 'react-hot-toast';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = auth.getUser();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  return (
    <Router>
      <Toaster position="top-right" />
      {user && <Navbar user={user} onLogout={handleLogout} />}
      <Routes>
        {/* Public Routes */}
        <Route path="/register" element={<Register onLogin={handleLogin} />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute>
              <Logs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Redirect */}
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
