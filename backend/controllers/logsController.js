import TrafficLog from '../models/TrafficLog.js';
import { asyncHandler, NotFoundError, AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Get all logs for current user
 * GET /api/logs
 */
export const getLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, attackType = 'All', severity = 'All' } = req.validatedQuery;
  const userId = req.user._id;

  // Build filter
  const filter = { userId };

  if (attackType !== 'All') {
    filter['analysis.attack_type'] = attackType;
  }

  if (severity !== 'All') {
    filter.severity = severity;
  }

  // Calculate skip
  const skip = (page - 1) * limit;

  // Get total count
  const total = await TrafficLog.countDocuments(filter);

  // Get logs with pagination
  const logs = await TrafficLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  logger.info(`Logs retrieved for user ${userId}: page ${page}, limit ${limit}`);

  return res.status(200).json({
    success: true,
    message: 'Logs retrieved',
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Get single log by ID
 * GET /api/logs/:id
 */
export const getLogById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const log = await TrafficLog.findById(id);

  if (!log) {
    throw new NotFoundError('Traffic log');
  }

  // Check ownership
  if (log.userId.toString() !== userId.toString()) {
    throw new AppError('You do not have access to this log', 403);
  }

  logger.info(`Log retrieved for user ${userId}: ${id}`);

  return res.status(200).json({
    success: true,
    message: 'Log retrieved',
    data: { log },
  });
});

/**
 * Search logs
 * GET /api/logs/search
 */
export const searchLogs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    attackType = 'All',
    severity = 'All',
    dateFrom,
    dateTo,
  } = req.validatedQuery;

  const userId = req.user._id;

  // Build filter
  const filter = { userId };

  if (attackType !== 'All') {
    filter['analysis.attack_type'] = attackType;
  }

  if (severity !== 'All') {
    filter.severity = severity;
  }

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) {
      filter.createdAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      filter.createdAt.$lte = new Date(dateTo);
    }
  }

  // Calculate skip
  const skip = (page - 1) * limit;

  // Get total count
  const total = await TrafficLog.countDocuments(filter);

  // Get logs with pagination
  const logs = await TrafficLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  logger.info(`Logs searched for user ${userId}: ${total} results`);

  return res.status(200).json({
    success: true,
    message: 'Search completed',
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Update log status
 * PATCH /api/logs/:id/status
 */
export const updateLogStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const userId = req.user._id;

  const validStatuses = ['pending', 'reviewing', 'confirmed', 'false_positive', 'ignored', 'Blocked'];

  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid status value', 400);
  }

  const log = await TrafficLog.findById(id);

  if (!log) {
    throw new NotFoundError('Traffic log');
  }

  // Check ownership
  if (log.userId.toString() !== userId.toString()) {
    throw new AppError('You do not have access to this log', 403);
  }

  log.status = status;
  
  // Feature 3: Label Correction
  if (status === 'confirmed') {
    log.actual_label = log.predicted_label;
  } else if (status === 'false_positive') {
    // If it's a false positive, actual label is opposite of predicted
    log.actual_label = log.predicted_label === 1 ? 0 : 1;
  }

  if (notes) {
    log.notes = notes;
  }

  await log.save();

  // Emit real-time update
  const io = req.app.get('io');
  if (io) {
    io.to(userId.toString()).emit('log_updated', log);
    io.to(userId.toString()).emit('metrics_updated');
  }

  logger.info(`Log status updated for user ${userId}: ${id} -> ${status}`);

  return res.status(200).json({
    success: true,
    message: 'Log status updated',
    data: { log },
  });
});

import BlockedIP from '../models/BlockedIP.js';

/**
 * Kill attack and block source IP
 * POST /api/logs/:id/kill
 */
export const killLogAttack = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const log = await TrafficLog.findById(id);

  if (!log) {
    throw new NotFoundError('Traffic log');
  }

  // Check ownership
  if (log.userId.toString() !== userId.toString()) {
    throw new AppError('You do not have access to this log', 403);
  }

  const srcIp = log.src_ip;
  if (!srcIp) {
    throw new AppError('Source IP not found in log', 400);
  }

  // 1. Check if already blocked
  const existingBlock = await BlockedIP.findOne({ 
    ip: srcIp, 
    userId, 
    isActive: true 
  });

  if (!existingBlock) {
    // 2. Create BlockedIP entry
    await BlockedIP.create({
      ip: srcIp,
      reason: `Automated block from log ${id}: ${log.analysis.attack_type}`,
      logId: id,
      userId,
      attackType: log.analysis.attack_type,
      severity: log.severity,
      blockedAt: new Date(),
    });
    
    logger.info(`IP ${srcIp} added to blocked_ips collection`);
  }

  // 3. Update TrafficLog
  log.status = 'Blocked';
  log.isBlocked = true;
  log.blockedAt = new Date();
  log.blockedBy = userId;
  await log.save();

  // 4. Firewall Simulation
  const firewallMode = process.env.FIREWALL_MODE || 'simulation';
  let firewallMessage = 'Firewall simulation mode active: IP stored in DB.';
  
  if (firewallMode === 'real') {
    // Future: Execute OS commands or call firewall API
    // firewallMessage = `Real firewall command executed for ${srcIp}`;
    firewallMessage = 'Real firewall integration not yet configured. Simulated instead.';
  }

  // 5. Emit real-time update
  const io = req.app.get('io');
  if (io) {
    io.to(userId.toString()).emit('log_updated', log);
    io.to(userId.toString()).emit('metrics_updated');
  }

  logger.info(`Kill attack triggered for IP ${srcIp} by user ${userId}`);

  return res.status(200).json({
    success: true,
    message: `Attack killed. IP ${srcIp} has been blocked.`,
    data: {
      log,
      firewall: {
        mode: firewallMode,
        message: firewallMessage
      }
    }
  });
});

/**
 * Delete log
 * DELETE /api/logs/:id
 */
export const deleteLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const log = await TrafficLog.findById(id);

  if (!log) {
    throw new NotFoundError('Traffic log');
  }

  // Check ownership
  if (log.userId.toString() !== userId.toString()) {
    throw new AppError('You do not have access to this log', 403);
  }

  await TrafficLog.findByIdAndDelete(id);

  logger.info(`Log deleted for user ${userId}: ${id}`);

  return res.status(200).json({
    success: true,
    message: 'Log deleted',
  });
});

/**
 * Export logs as CSV
 * GET /api/logs/export/csv
 */
export const exportLogsCSV = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { attackType = 'All', severity = 'All' } = req.query;

  // Build filter
  const filter = { userId };

  if (attackType !== 'All') {
    filter['analysis.attack_type'] = attackType;
  }

  if (severity !== 'All') {
    filter.severity = severity;
  }

  // Get logs
  const logs = await TrafficLog.find(filter).sort({ createdAt: -1 }).limit(10000);

  // Build CSV
  const headers = [
    'ID',
    'Timestamp',
    'Protocol',
    'Source Port',
    'Dest Port',
    'Duration',
    'Bytes Sent',
    'Bytes Received',
    'Attack Type',
    'Confidence',
    'Severity',
    'Status',
  ];

  const rows = logs.map(log => [
    log._id.toString(),
    log.createdAt.toISOString(),
    log.protocol,
    log.src_port,
    log.dst_port,
    log.duration,
    log.bytes_sent,
    log.bytes_received,
    log.analysis.attack_type,
    log.analysis.confidence.toFixed(4),
    log.severity,
    log.status,
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  logger.info(`Logs exported for user ${userId}: ${logs.length} records`);

  res.status(200)
    .header('Content-Type', 'text/csv')
    .header('Content-Disposition', 'attachment; filename="traffic-logs.csv"')
    .send(csv);
});

/**
 * Get log statistics
 * GET /api/logs/stats
 */
export const getLogStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const daysBack = parseInt(req.query.days) || 30;

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - daysBack);

  // Total logs
  const totalLogs = await TrafficLog.countDocuments({
    userId,
    createdAt: { $gte: dateFrom },
  });

  // Alerts count
  const alertCount = await TrafficLog.countDocuments({
    userId,
    alertTriggered: true,
    createdAt: { $gte: dateFrom },
  });

  // Confirmed threats
  const confirmedThreats = await TrafficLog.countDocuments({
    userId,
    status: 'confirmed',
    createdAt: { $gte: dateFrom },
  });

  // False positives
  const falsePositives = await TrafficLog.countDocuments({
    userId,
    status: 'false_positive',
    createdAt: { $gte: dateFrom },
  });

  // Average confidence
  const avgResult = await TrafficLog.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: dateFrom },
      },
    },
    {
      $group: {
        _id: null,
        avgConfidence: { $avg: '$analysis.confidence' },
        avgAnomalyScore: { $avg: '$analysis.anomalyScore' },
      },
    },
  ]);

  const avgConfidence = avgResult[0]?.avgConfidence || 0;
  const avgAnomalyScore = avgResult[0]?.avgAnomalyScore || 0;

  return res.status(200).json({
    success: true,
    message: 'Statistics retrieved',
    data: {
      period: { days: daysBack, from: dateFrom, to: new Date() },
      totalLogs,
      alertCount,
      confirmedThreats,
      falsePositives,
      avgConfidence: parseFloat(avgConfidence.toFixed(4)),
      avgAnomalyScore: parseFloat(avgAnomalyScore.toFixed(4)),
      detectionRate: ((alertCount / Math.max(totalLogs, 1)) * 100).toFixed(2) + '%',
    },
  });
});

export default {
  getLogs,
  getLogById,
  searchLogs,
  updateLogStatus,
  killLogAttack,
  deleteLog,
  exportLogsCSV,
  getLogStats,
};
