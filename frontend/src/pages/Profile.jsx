import React, { useState, useEffect } from 'react';
import { FiUser, FiMail, FiLock } from 'react-icons/fi';
import { authAPI } from '../utils/api.js';
import { auth } from '../utils/auth.js';

export const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [profileForm, setProfileForm] = useState({ name: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const storedUser = auth.getUser();
        setUser(storedUser);
        setProfileForm({ name: storedUser?.name || '' });
      } catch (error) {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!profileForm.name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      await authAPI.updateProfile(profileForm);
      const updated = { ...user, name: profileForm.name };
      setUser(updated);
      auth.setAuth(auth.getToken(), updated);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    try {
      await authAPI.updateProfile({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setSuccess('Password updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update password');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-cyan-500"></div>
          <p className="mt-4 text-slate-300">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white">Profile Settings</h1>
          <p className="text-slate-400">Manage your account and preferences</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-900/20 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2 font-medium transition-all ${
              activeTab === 'profile'
                ? 'text-cyan-400 border-b-2 border-cyan-500'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`pb-2 font-medium transition-all ${
              activeTab === 'password'
                ? 'text-cyan-400 border-b-2 border-cyan-500'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Change Password
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && user && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-slate-400 text-sm">User Email</p>
                <p className="text-white font-semibold">{user.email}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-3 text-slate-500 w-5 h-5" />
                  <input
                    type="text"
                    name="name"
                    value={profileForm.name}
                    onChange={handleProfileChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-3 text-slate-500 w-5 h-5" />
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/50"
              >
                Save Changes
              </button>
            </form>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 backdrop-blur-sm">
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-3 text-slate-500 w-5 h-5" />
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter current password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  />
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-3 text-slate-500 w-5 h-5" />
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-3 text-slate-500 w-5 h-5" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Confirm new password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/50"
              >
                Update Password
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
