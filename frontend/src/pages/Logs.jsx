import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { FiSearch, FiDownload, FiFilter, FiSlash, FiShield, FiCpu, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import { logsAPI } from '../utils/api.js';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || import.meta.env.VITE_APP_API_URL || 'http://localhost:5001';

export const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    attackType: 'All',
    severity: 'All',
    search: '',
  });
  const [socketConnected, setSocketConnected] = useState(false);
  const [pendingLogs, setPendingLogs] = useState(0);
  const socketRef = useRef(null);
  const paginationRef = useRef(pagination);

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    console.log('🔐 Auth check - Token:', !!token, 'User:', !!user);
    if (user) {
      try {
        const userData = JSON.parse(user);
        console.log('👤 User data:', userData);
      } catch (e) {
        console.error('❌ Invalid user data in localStorage');
      }
    }
  }, []);
  
  // Kill Modal State
  const [killModal, setKillModal] = useState({ open: false, log: null });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      console.log('📡 Fetching logs with params:', {
        page: pagination.page,
        limit: pagination.limit,
        attackType: filters.attackType,
        severity: filters.severity
      });
      const response = await logsAPI.getLogs(
        pagination.page,
        pagination.limit,
        filters.attackType,
        filters.severity
      );

      console.log('📨 Logs response:', response.data);
      console.log('📊 Pagination data:', response.data.data.pagination);
      console.log('📋 Logs array:', response.data.data.logs);
      setLogs(response.data.data.logs);
      setPagination(response.data.data.pagination);
      console.log('✅ Logs loaded:', response.data.data.logs.length, 'items');
    } catch (error) {
      toast.error('Failed to fetch logs');
      setError('Failed to fetch logs');
      console.error('❌ Error fetching logs:', error);
      console.error('Error response:', error.response);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters, pagination.page]);

  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  useEffect(() => {
    // Initialize Socket
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 20000,
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ Socket connected successfully to:', SOCKET_URL);
      setSocketConnected(true);
      const user = JSON.parse(localStorage.getItem('user'));
      console.log('👤 Current user from localStorage:', user);
      if (user && user._id) {
        const userId = user._id.toString();
        console.log('📥 Joining socket room', userId, 'type:', typeof userId);
        newSocket.emit('join', userId);
        console.log('📤 Join event emitted');
      } else {
        console.warn('⚠️ Socket join skipped: no user ID found in localStorage');
        console.log('localStorage user:', localStorage.getItem('user'));
      }
    });

    newSocket.on('disconnect', () => {
      setSocketConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setSocketConnected(false);
    });

    newSocket.on('new_log', (newLog) => {
      console.log('🔥 Received new_log event:', newLog);
      if (paginationRef.current.page === 1) {
        setLogs(prev => [newLog, ...prev.slice(0, paginationRef.current.limit - 1)]);
      } else {
        setPendingLogs((count) => count + 1);
      }
    });

    newSocket.on('log_updated', (updatedLog) => {
      console.log('🔄 Received log_updated event:', updatedLog);
      setLogs(prev => prev.map(log => log._id === updatedLog._id ? updatedLog : log));
    });

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await logsAPI.updateLogStatus(id, { status });
      toast.success(`Status updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleKillClick = (log) => {
    setKillModal({ open: true, log });
  };

  const handleKillConfirm = async () => {
    const { log } = killModal;
    if (!log) return;

    try {
      const response = await logsAPI.killLog(log._id);
      toast.success(response.data.message || 'IP blocked successfully');
      setKillModal({ open: false, log: null });
      // UI update is handled by socket
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to block IP');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-red-500/20 text-red-400';
      case 'High': return 'bg-orange-500/20 text-orange-400';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white">Traffic Logs</h1>
            <p className="text-slate-400">Analyze and manage detected traffic</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => logsAPI.exportLogsCSV().then(res => {
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'traffic-logs.csv');
                document.body.appendChild(link);
                link.click();
                link.parentElement.removeChild(link);
              })}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-all shadow-lg"
            >
              <FiDownload className="w-5 h-5" /> Export CSV
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${socketConnected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                {socketConnected ? 'Live logs enabled' : 'Live logs disconnected'}
              </span>
              {pendingLogs > 0 && (
                <button
                  onClick={() => {
                    fetchLogs();
                    setPendingLogs(0);
                  }}
                  className="inline-flex items-center rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600 transition-all"
                >
                  {pendingLogs} new log{pendingLogs > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4 text-white font-semibold">
            <FiFilter className="w-5 h-5" /> Filters
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Attack Type</label>
              <select
                value={filters.attackType}
                onChange={(e) => handleFilterChange('attackType', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
              >
                <option>All</option>
                <option>Normal</option>
                <option>DDoS</option>
                <option>Port Scan</option>
                <option>Brute Force</option>
                <option>Malware</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => handleFilterChange('severity', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
              >
                <option>All</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ attackType: 'All', severity: 'All', search: '' })}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition-all"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-cyan-500 mb-4"></div>
          </div>
        ) : (
          <div className="overflow-x-auto bg-slate-800/50 border border-slate-700 rounded-xl backdrop-blur-sm">
            <table className="w-full text-left">
              <thead className="border-b border-slate-700 bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-300">Timestamp</th>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-300">IP (Src → Dst)</th>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-300">Domain/App</th>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-300">Anomaly</th>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-300">Attack Type</th>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-300">Detected By</th>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-300">Severity</th>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className={`border-b border-slate-700 hover:bg-slate-700/50 transition-all ${log.isBlocked ? 'opacity-60 bg-red-900/5' : ''}`}>
                    <td className="px-6 py-4 text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col">
                        <span className="text-slate-200">{log.src_ip || 'Internal'}</span>
                        <span className="text-xs text-slate-500">→ {log.dst_ip || 'Local'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs" title={`Detected via ${log.detection_source}`}>
                            {
  log.detection_source === 'SNI' ||
  log.detection_source === 'HTTP'
    ? '🌐'
    : log.detection_source === 'EXTENSION'
    ? '🧩'
    : '☁️'
}
                          </span>
                          <span className="text-slate-200 font-bold truncate max-w-[200px]" title={log.tab_title || log.real_domain || log.app_name || log.dst_domain}>
                            {log.tab_title || log.real_domain || log.app_name || log.dst_domain || 'Unknown'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 truncate max-w-[200px] flex items-center gap-1" title={log.real_domain}>
                           {log.tab_title && log.real_domain !== 'Unknown' ? (
                             <><span className="opacity-50">at</span> {log.real_domain}</>
                           ) : (
                             <><span className="opacity-50">via</span> {log.app_name !== 'Unknown App' ? log.app_name : (log.dst_hostname !== 'Unknown' ? log.dst_hostname : 'Direct IP')}</>
                           )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-200">
                        {log.anomaly_name || 'Normal Traffic'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-bold ${log.analysis.attack_type === 'Normal' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                        {log.analysis.attack_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-xs text-slate-300">
                        {log.detected_by === 'AI Model' ? <FiCpu className="text-cyan-400" /> : <FiShield className="text-emerald-400" />}
                        {log.detected_by || 'AI Model'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getSeverityColor(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {log.status === 'Blocked' ? (
                        <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-md font-bold flex items-center gap-1">
                          <FiSlash className="w-3 h-3" /> Blocked
                        </span>
                      ) : (
                        <span className="text-slate-400 capitalize">{log.status}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {log.status === 'pending' && !log.isBlocked && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(log._id, 'confirmed')}
                              className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 rounded border border-emerald-600/50 transition-colors"
                              title="Confirm Detection"
                            >
                              <FiCheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(log._id, 'false_positive')}
                              className="p-1.5 bg-orange-600/20 text-orange-400 hover:bg-orange-600/40 rounded border border-orange-600/50 transition-colors"
                              title="Mark False Positive"
                            >
                              <FiSlash className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleKillClick(log)}
                              className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded border border-red-600/50 transition-colors"
                              title="Kill Connection / Block IP"
                            >
                              <FiSlash className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Kill Confirmation Modal */}
        {killModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <div className="p-3 bg-red-500/10 rounded-full">
                  <FiAlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Confirm Block</h3>
              </div>
              <p className="text-slate-300 mb-6 leading-relaxed">
                Are you sure you want to block IP <span className="font-mono text-white bg-slate-700 px-1.5 py-0.5 rounded">{killModal.log?.src_ip}</span>?
                This will terminate the connection and prevent future access.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setKillModal({ open: false, log: null })}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleKillConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all shadow-lg shadow-red-600/20"
                >
                  Confirm Block
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Logs;
