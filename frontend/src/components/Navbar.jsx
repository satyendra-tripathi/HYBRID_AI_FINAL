import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMenu, FiX, FiLogOut, FiUser } from 'react-icons/fi';
import { auth } from '../utils/auth.js';
import { authAPI } from '../utils/api.js';

export const Navbar = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    auth.clearAuth();
    onLogout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-all">
              🛡️
            </div>
            <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 hidden sm:inline">
              AI-IDS
            </span>
          </Link>

          {/* Desktop Menu */}
          {user && (
            <div className="hidden md:flex items-center space-x-6">
              <Link
                to="/dashboard"
                className="text-slate-300 hover:text-cyan-400 transition-colors font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/logs"
                className="text-slate-300 hover:text-cyan-400 transition-colors font-medium"
              >
                Logs
              </Link>
              <Link
                to="/profile"
                className="text-slate-300 hover:text-cyan-400 transition-colors font-medium flex items-center space-x-1"
              >
                <FiUser className="w-4 h-4" />
                <span>{user.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-slate-300 hover:text-red-400 transition-colors font-medium flex items-center space-x-1"
              >
                <FiLogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden flex items-center text-slate-300 hover:text-cyan-400 transition-colors"
          >
            {isOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && user && (
          <div className="md:hidden pb-4 space-y-2">
            <Link
              to="/dashboard"
              className="block px-3 py-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/logs"
              className="block px-3 py-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
            >
              Logs
            </Link>
            <Link
              to="/profile"
              className="block px-3 py-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-slate-300 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
