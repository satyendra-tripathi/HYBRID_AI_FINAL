import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { FiAlertCircle, FiCheckCircle, FiTrendingUp, FiPackage, FiActivity, FiTarget, FiZap, FiRefreshCcw } from 'react-icons/fi';
import { analyzeAPI, logsAPI, metricsAPI } from '../utils/api.js';
import TrafficChart from '../components/TrafficChart.jsx';
import SeverityTimelineChart from '../components/SeverityTimelineChart.jsx';

const SOCKET_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_APP_API_URL || 'https://backend-service-ot4f.onrender.com';

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [logStats, setLogStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [latestAnomaly, setLatestAnomaly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [daysFilter, setDaysFilter] = useState(7);
  const [socket, setSocket] = useState(null);

  const fetchData = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const [statsRes, logStatsRes, metricsRes, timelineRes] = await Promise.all([
        analyzeAPI.getStatistics(daysFilter),
        logsAPI.getLogStats(daysFilter),
        metricsAPI.getMetrics(),
        analyzeAPI.getSeverityTimeline(daysFilter)
      ]);

      setStats(statsRes.data.data);
      setLogStats(logStatsRes.data.data);
      setMetrics(metricsRes.data.data);
      setTimelineData(timelineRes.data.data);

      // Set latest anomaly from recent alerts or logs
      if (statsRes.data.data.recentAlerts && statsRes.data.data.recentAlerts.length > 0) {
        setLatestAnomaly(statsRes.data.data.recentAlerts[0]);
      }

      if (statsRes.data.data.recentAlerts) {
        setRecentAlerts(statsRes.data.data.recentAlerts.slice(0, 5));
      }
    } catch (error) {
      if (showLoader) setError('Failed to fetch statistics');
      console.error(error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to backend Socket.IO', SOCKET_URL);
      const user = JSON.parse(localStorage.getItem('user'));
      if (user && user._id) {
        console.log('📥 Joining socket room', user._id);
        socket.emit('join', user._id);
      } else {
        console.warn('⚠️ Socket join skipped: no user ID found in localStorage');
      }
    });

    socket.on('new_log', (data) => {
      console.log('🔥 Live Data:', data);
      setLatestAnomaly(data);
      setRecentAlerts((prev) => [data, ...prev.slice(0, 4)]);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err);
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [daysFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-cyan-500"></div>
          <p className="mt-4 text-slate-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, change, color = 'cyan' }) => (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 backdrop-blur-sm hover:border-slate-600 transition-all group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-2 text-${color}-400`}>{value}</p>
          {change && <p className="text-sm text-slate-500 mt-2">{change}</p>}
        </div>
        <div className={`p-3 bg-${color}-500/10 rounded-lg group-hover:scale-110 transition-transform`}>
          <Icon className={`w-6 h-6 text-${color}-400`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-slate-400">Real-time intrusion detection and analysis</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg border border-slate-700 transition-all"
          >
            <FiRefreshCcw className="w-4 h-4" />
            Sync Now
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Time Filter */}
        <div className="flex gap-2 mb-6">
          {[7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => setDaysFilter(days)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${daysFilter === days
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
            >
              Last {days} days
            </button>
          ))}
        </div>

        {/* Model Performance Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FiActivity className="text-cyan-400 w-5 h-5" />
            <h2 className="text-xl font-bold text-white">Model Performance</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={FiTarget}
              label="Accuracy"
              value={`${((metrics?.accuracy || 0) * 100).toFixed(1)}%`}
              color="emerald"
            />
            <StatCard
              icon={FiZap}
              label="Precision"
              value={`${((metrics?.precision || 0) * 100).toFixed(1)}%`}
              color="blue"
            />
            <StatCard
              icon={FiRefreshCcw}
              label="Recall"
              value={`${((metrics?.recall || 0) * 100).toFixed(1)}%`}
              color="purple"
            />
            <StatCard
              icon={FiTrendingUp}
              label="F1 Score"
              value={`${((metrics?.f1_score || 0) * 100).toFixed(2)}`}
              color="orange"
            />
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              icon={FiPackage}
              label="Total Packets"
              value={stats.summary?.totalPackets || 0}
              color="blue"
            />
            <StatCard
              icon={FiAlertCircle}
              label="Anomalies"
              value={stats.summary?.anomalies || 0}
              color="yellow"
            />
            <StatCard
              icon={FiCheckCircle}
              label="Alerts"
              value={stats.summary?.alerts || 0}
              color="red"
            />
            <StatCard
              icon={FiTrendingUp}
              label="Avg Confidence"
              value={`${((stats.summary?.avgConfidence || 0) * 100).toFixed(1)}%`}
              color="emerald"
            />
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Attack Distribution */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-white mb-4">Attack Distribution</h3>
            {stats?.attackDistribution && stats.attackDistribution.length > 0 ? (
              <TrafficChart
                data={stats.attackDistribution.map(item => ({
                  name: item._id || 'Unknown',
                  value: item.count,
                }))}
                type="pie"
              />
            ) : (
              <p className="text-slate-500 text-center py-12">No data available</p>
            )}
          </div>

          {/* Severity Distribution */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-white mb-4">Severity Distribution</h3>
            {stats?.severityDistribution && stats.severityDistribution.length > 0 ? (
              <TrafficChart
                data={stats.severityDistribution.map(item => ({
                  name: item._id || 'Unknown',
                  value: item.count,
                }))}
                type="bar"
              />
            ) : (
              <p className="text-slate-500 text-center py-12">No data available</p>
            )}
          </div>
        </div>

        {/* Severity Timeline Chart */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 backdrop-blur-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Severity Timeline</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-xs text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Low</span>
              <span className="flex items-center gap-1 text-xs text-yellow-400"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Medium</span>
              <span className="flex items-center gap-1 text-xs text-orange-400"><span className="w-2 h-2 rounded-full bg-orange-500"></span> High</span>
              <span className="flex items-center gap-1 text-xs text-red-400"><span className="w-2 h-2 rounded-full bg-red-500"></span> Critical</span>
            </div>
          </div>
          <SeverityTimelineChart data={timelineData} />
        </div>

        {/* Live Detected Anomaly & Recent Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Detected Anomaly Card */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 backdrop-blur-sm h-full">
              <div className="flex items-center gap-2 mb-6">
                <FiZap className="text-yellow-400 w-5 h-5 animate-pulse" />
                <h3 className="text-xl font-bold text-white">Live Detected Anomaly</h3>
              </div>

              {latestAnomaly ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${latestAnomaly.severity === 'Critical' ? 'bg-red-500/10 border-red-500/30' :
                      latestAnomaly.severity === 'High' ? 'bg-orange-500/10 border-orange-500/30' :
                        'bg-yellow-500/10 border-yellow-500/30'
                    }`}>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Latest Threat</p>
                    <p className="text-lg font-bold text-white mb-2">{latestAnomaly.anomaly_name || latestAnomaly.attackType}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="font-mono" title={latestAnomaly.src_hostname}>{latestAnomaly.src_hostname !== 'Unknown' ? latestAnomaly.src_hostname : (latestAnomaly.src_ip || 'Internal')}</span>
                      <span>→</span>
                      <span className="font-mono text-cyan-400" title={latestAnomaly.dst_hostname}>{latestAnomaly.dst_hostname !== 'Unknown' ? latestAnomaly.dst_hostname : (latestAnomaly.dst_ip || 'Local')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                      <p className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        {latestAnomaly.detection_source === 'SNI' || latestAnomaly.detection_source === 'HTTP' ? '🌐' : '☁️'}
                        Application / Tab
                      </p>
                      <p className="text-sm font-bold text-slate-200 truncate" title={latestAnomaly.tab_title || latestAnomaly.real_domain}>
                        {latestAnomaly.tab_title || (latestAnomaly.real_domain && latestAnomaly.real_domain !== 'Unknown' ? latestAnomaly.real_domain : (latestAnomaly.app_name !== 'Unknown App' ? latestAnomaly.app_name : 'Unknown Tab'))}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                      <p className="text-[10px] text-slate-500 uppercase">Confidence</p>
                      <p className="text-sm font-semibold text-cyan-400">{(latestAnomaly.confidence * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-700">
                    <span>{new Date(latestAnomaly.timestamp).toLocaleTimeString()}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${latestAnomaly.severity === 'Critical' ? 'bg-red-500/20 text-red-400' :
                        latestAnomaly.severity === 'High' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                      }`}>{latestAnomaly.severity}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 italic">
                  <FiCheckCircle className="w-12 h-12 mb-3 opacity-20" />
                  No live anomalies detected
                </div>
              )}
            </div>
          </div>

          {/* Recent Alerts List */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 backdrop-blur-sm">
              <h3 className="text-xl font-bold text-white mb-4">Recent Alerts</h3>
              {recentAlerts.length > 0 ? (
                <div className="space-y-3">
                  {recentAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
                    >
                      <div className="flex-1">
                        <p className="text-white font-medium">{alert.attackType}</p>
                        <p className="text-sm text-slate-400">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${alert.severity === 'Critical'
                              ? 'bg-red-500/20 text-red-400'
                              : alert.severity === 'High'
                                ? 'bg-orange-500/20 text-orange-400'
                                : alert.severity === 'Medium'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-blue-500/20 text-blue-400'
                            }`}
                        >
                          {alert.severity}
                        </span>
                        <span className="text-cyan-400 font-semibold">
                          {(alert.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">No alerts in this period</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;