import axios from 'axios';
import TrafficLog from '../models/TrafficLog.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { logAIPrediction } from '../utils/logger.js';
import logger from '../utils/logger.js';
import { triggerAlerts } from '../utils/notifier.js';
import { resolveIP, extractDomain } from '../utils/resolveHost.js';
import { getServiceName } from '../utils/serviceMapper.js';
import { getDomainFriendlyName } from '../utils/domainNameMapper.js';
import { getIPOwner } from '../utils/ipRangeMapper.js';
import { getAnomalyName } from '../utils/anomalyLogic.js';

const normalizeDomain = (value = '') =>
  String(value).toLowerCase().replace(/^www\./, '').trim();

const isUnknown = (value) =>
  !value || ['unknown', 'unknown tab', 'unknown tab (cdn)'].includes(String(value).toLowerCase());

const findMatchingTab = (realDomain, dstDomain, dstHost) => {
  global.tabMap = global.tabMap || {};

  const candidates = [realDomain, dstDomain, dstHost]
    .filter(Boolean)
    .map(normalizeDomain)
    .filter(Boolean);

  const entries = Object.entries(global.tabMap);

  logger.debug(`[DEBUG] Tab matching - candidates: ${candidates.join(', ')}, available tabs: ${entries.length}`);

  for (const candidate of candidates) {
    // 1. Exact match
    if (global.tabMap[candidate]) {
      logger.debug(`[DEBUG] Exact match found: ${candidate} -> ${global.tabMap[candidate].title}`);
      return global.tabMap[candidate];
    }

    // 2. Subdomain match (e.g., sub.example.com matches example.com)
    const match = entries.find(([key]) =>
      candidate.includes(key) || key.includes(candidate)
    );

    if (match) {
      logger.debug(`[DEBUG] Subdomain match found: ${candidate} -> ${match[1].title}`);
      return match[1];
    }
  }

  logger.debug(`[DEBUG] No reliable tab match for candidates: ${candidates.join(', ')}`);
  return null;
};


const enhanceTrafficLog = async ({ trafficLog, traffic, aiResult }) => {
  let srcHost = 'Unknown';
  let dstHost = 'Unknown';

  try {
    [srcHost, dstHost] = await Promise.all([
      traffic.src_ip ? resolveIP(traffic.src_ip) : Promise.resolve('Unknown'),
      traffic.dst_ip ? resolveIP(traffic.dst_ip) : Promise.resolve('Unknown'),
    ]);

    if (srcHost === 'Unknown') {
      const owner = getIPOwner(traffic.src_ip);
      if (owner !== 'Unknown') srcHost = owner;
    }

    if (dstHost === 'Unknown') {
      const owner = getIPOwner(traffic.dst_ip);
      if (owner !== 'Unknown') dstHost = owner;
    }

    const srcDomain = extractDomain(srcHost);
    const dstDomain = extractDomain(dstHost);
    const realDomain = normalizeDomain(traffic.real_domain || '');
    const dstDomainClean = normalizeDomain(dstDomain);
    const dstHostClean = normalizeDomain(dstHost);

    trafficLog.src_hostname = srcHost;
    trafficLog.dst_hostname = dstHost;
    trafficLog.src_domain = srcDomain;
    trafficLog.dst_domain = dstDomain;
    trafficLog.service_name = getServiceName(traffic.dst_port);

    // Use new matching logic - NO active tab fallback
    const matchedTab = findMatchingTab(realDomain, dstDomainClean, dstHostClean);

    if (matchedTab) {
      // Priority 1: Matched tab found
      trafficLog.app_name = matchedTab.title;
      trafficLog.tab_title = matchedTab.title;
      trafficLog.real_domain = matchedTab.domain;
      trafficLog.detection_source = 'Chrome Extension';
      trafficLog.tab_url = matchedTab.url || null;
    } else if (!isUnknown(realDomain)) {
      // Priority 2: real_domain exists
      trafficLog.app_name = getDomainFriendlyName(realDomain, realDomain);
      trafficLog.tab_title = null;
      trafficLog.real_domain = realDomain;
      trafficLog.detection_source = traffic.detection_source || 'SNI/DNS';
    } else {
      // Priority 3: Fallback to DNS/domain logic
      const cdnKeywords = [
        'cloudflare',
        'amazonaws',
        'akamai',
        'cloudfront',
        'googleusercontent',
        'fastly',
      ];

      const isCDN = cdnKeywords.some((kw) =>
        String(dstHost).toLowerCase().includes(kw)
      );

      trafficLog.real_domain = isCDN
        ? 'Unknown Tab (CDN)'
        : dstHost !== 'Unknown'
          ? dstHost
          : 'Unknown Tab';

      trafficLog.detection_source = 'DNS';
      trafficLog.app_name = getDomainFriendlyName(dstDomain, dstHost);
      trafficLog.tab_title = null;
    }

    trafficLog.anomaly_name = getAnomalyName({
      aiResult,
      dst_port: traffic.dst_port,
      dst_domain: trafficLog.real_domain || trafficLog.dst_domain,
      protocol: traffic.protocol,
      bytes_sent: traffic.bytes_sent,
      duration: traffic.duration,
    });
  } catch (err) {
    logger.error(`Error enhancing traffic log: ${err.message}`);
  }
};

export const tabSync = asyncHandler(async (req, res) => {
  const { domain, title, url, tabId, windowId, active, lastSeenAt } = req.body;

  if (!domain) {
    throw new AppError('Domain is required', 400);
  }

  const cleanDomain = normalizeDomain(domain);

  global.tabMap = global.tabMap || {};

  global.tabMap[cleanDomain] = {
    title: title || cleanDomain,
    url: url || '',
    domain: cleanDomain,
    tabId: tabId || null,
    windowId: windowId || null,
    active: Boolean(active),
    lastSeenAt: lastSeenAt || new Date().toISOString(),
  };

  logger.info(`Tab synced: ${cleanDomain} -> ${title || cleanDomain}`);
  return res.status(200).json({
    success: true,
    message: 'Tab synced successfully',
  });
});

export const tabSyncBatch = asyncHandler(async (req, res) => {
  const { tabs } = req.body;

  if (!Array.isArray(tabs)) {
    throw new AppError('Tabs must be an array', 400);
  }

  global.tabMap = global.tabMap || {};

  // Reset active status for all existing tabs in the map
  Object.keys(global.tabMap).forEach((key) => {
    global.tabMap[key].active = false;
  });

  tabs.forEach((tab) => {
    if (!tab.domain) return;
    const cleanDomain = normalizeDomain(tab.domain);
    global.tabMap[cleanDomain] = {
      title: tab.title || cleanDomain,
      url: tab.url || '',
      domain: cleanDomain,
      tabId: tab.tabId || null,
      windowId: tab.windowId || null,
      active: Boolean(tab.active),
      lastSeenAt: tab.lastSeenAt || new Date().toISOString(),
    };
  });

  logger.info(`Batch synced ${tabs.length} tabs`);
  logger.debug(`[DEBUG] Current tab map: ${Object.keys(global.tabMap).join(', ')}`);

  return res.status(200).json({
    success: true,
    message: `Synced ${tabs.length} tabs successfully`,
  });
});


const callAIService = async (features) => {
  const aiServiceBaseUrl = (process.env.AI_SERVICE_URL || 'https://ai-x9px.onrender.com').replace(/\/+$/, '');
  const predictUrl = `${aiServiceBaseUrl}/predict`;

  logger.info(`[DEBUG] Calling AI Service at: ${predictUrl}`);

  try {
    const response = await axios.post(
      predictUrl,
      { features },
      {
        timeout: Number(process.env.AI_SERVICE_TIMEOUT) || 30000,
      }
    );

    logger.info(`[DEBUG] AI Service response: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      logger.error(
        `AI Service error [${error.response.status}]: ${JSON.stringify(error.response.data)}`
      );
    } else {
      logger.error(`AI Service error: ${error.message}`);
    }

    throw new AppError('AI service unavailable', 503);
  }
};

export const analyzeTraffic = asyncHandler(async (req, res) => {  console.log('🔍 Analyze endpoint called');
  console.log('📨 Request body:', req.body);
  console.log('👤 Authenticated user:', req.user ? { id: req.user._id, email: req.user.email } : 'No user');

  if (!req.user || !req.user._id) {
    console.error('❌ No authenticated user found');
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  const {
    protocol,
    src_port,
    dst_port,
    duration,
    bytes_sent,
    bytes_received,
    src_ip = null,
    dst_ip,
    flags = 0,
    real_domain,
    detection_source,
    tab_title,
    domain,
  } = req.body;

  // Validate protocol
  const validProtocols = ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS'];
  if (!validProtocols.includes(protocol)) {
    throw new AppError(`Invalid protocol: ${protocol}. Must be one of: ${validProtocols.join(', ')}`, 400);
  }

  // Validate ports
  const srcPortNum = Number(src_port);
  const dstPortNum = Number(dst_port);
  if (srcPortNum < 1 || srcPortNum > 65535 || dstPortNum < 1 || dstPortNum > 65535) {
    throw new AppError('Port numbers must be between 1 and 65535', 400);
  }

  const startTime = Date.now();

  const features = {
    protocol: protocol === 'TCP' ? 1 : protocol === 'UDP' ? 2 : 0,
    src_port: Number(src_port),
    dst_port: Number(dst_port),
    duration: Number(duration),
    bytes_sent: Number(bytes_sent),
    bytes_received: Number(bytes_received),
    flags: Number(flags || 0),
  };

  let aiResult;
  try {
    aiResult = await callAIService(features);
  } catch (aiError) {
    logger.warn(`AI service failed, using fallback analysis: ${aiError.message}`);
    // Fallback analysis when AI service is unavailable
    aiResult = {
      isAnomaly: false,
      anomaly_score: 0.1,
      cluster: 0,
      attack_type: 'Normal',
      confidence: 0.5,
      attack_probabilities: {
        Normal: 0.8,
        DDoS: 0.05,
        PortScan: 0.05,
        BruteForce: 0.05,
        Malware: 0.05,
      },
    };
  }
  const processingTime = Date.now() - startTime;

  let severity = 'Low';

  if (aiResult.isAnomaly && aiResult.confidence > 0.9) {
    severity = 'Critical';
  } else if (
    aiResult.isAnomaly &&
    aiResult.attack_type !== 'Normal' &&
    aiResult.confidence > 0.7
  ) {
    severity = 'High';
  } else if (aiResult.isAnomaly) {
    severity = 'Medium';
  }

  const predicted_label =
    aiResult.isAnomaly || aiResult.attack_type !== 'Normal' ? 1 : 0;

  console.log('👤 Creating traffic log for user:', req.user._id, 'type:', typeof req.user._id);

  const trafficLog = new TrafficLog({
    userId: req.user._id,
    protocol,
    src_port,
    dst_port,
    src_ip,
    dst_ip,
    duration,
    bytes_sent,
    bytes_received,
    flags,
    analysis: {
      isAnomaly: Boolean(aiResult.isAnomaly),
      anomalyScore: aiResult.anomaly_score || 0,
      clusterAssignment: aiResult.cluster || -1,
      attack_type: aiResult.attack_type || 'Unknown',
      confidence: aiResult.confidence || 0,
      attackProbabilities: aiResult.attack_probabilities || {},
      processingTime,
    },
    predicted_label,
    actual_label: predicted_label,
    detected_by: 'AI Model',
    severity,
    status: aiResult.isAnomaly ? 'pending' : 'confirmed',
    source: 'api',
  });

  await enhanceTrafficLog({
    trafficLog,
    traffic: {
      protocol,
      src_port,
      dst_port,
      duration,
      bytes_sent,
      bytes_received,
      src_ip,
      dst_ip,
      flags,
      real_domain,
      detection_source,
      tab_title,
      domain,
    },
    aiResult,
  });

  try {
    await trafficLog.save();
    logger.info(`✅ Traffic log saved successfully: ${trafficLog._id}`);
  } catch (saveError) {
    logger.error(`❌ Failed to save traffic log: ${saveError.message}`);
    logger.error(`Save error details:`, saveError);
    throw saveError;
  }

  const io = req.app.get('io');
  if (io) {
      const userId = req.user._id.toString();
      logger.info(`📡 Emitting new_log to room: ${userId}`);
      logger.info(`📡 Current socket rooms:`, Array.from(io.sockets.adapter.rooms.keys()));
      logger.info(`📡 Connected sockets:`, Array.from(io.sockets.sockets.keys()));

      // Check if room exists
      const roomExists = io.sockets.adapter.rooms.has(userId);
      logger.info(`📡 Room ${userId} exists:`, roomExists);

      io.to(userId).emit('new_log', trafficLog);
      logger.info(`📡 Emitted new_log event to room ${userId} with log ID: ${trafficLog._id}`);
  } else {
    logger.warn('⚠️ Socket.io not available for emitting new_log');
  }

  if (trafficLog.alertTriggered) {
    logAIPrediction(trafficLog.analysis, req.user._id);
    triggerAlerts(trafficLog);
  }

  logger.info(
    `Traffic analyzed for user ${req.user._id}: ${trafficLog.analysis.attack_type}`
  );

  return res.status(200).json({
    success: true,
    message: 'Traffic analysis completed',
    data: {
      prediction: trafficLog.analysis,
      severity: trafficLog.severity,
      alertTriggered: trafficLog.alertTriggered,
      processingTime,
      logId: trafficLog._id,
      app_name: trafficLog.app_name,
      tab_title: trafficLog.tab_title,
      real_domain: trafficLog.real_domain,
      anomaly_name: trafficLog.anomaly_name,
    },
  });
});

export const analyzeTrafficBatch = asyncHandler(async (req, res) => {
  const { trafficList } = req.body;

  if (!Array.isArray(trafficList) || trafficList.length === 0) {
    throw new AppError('trafficList must be a non-empty array', 400);
  }

  if (trafficList.length > 1000) {
    throw new AppError('Maximum 1000 items per batch', 400);
  }

  const results = [];
  const logs = [];
  const startTime = Date.now();

  for (const traffic of trafficList) {
    try {
      // Validate protocol
      const validProtocols = ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS'];
      if (!validProtocols.includes(traffic.protocol)) {
        results.push({
          success: false,
          error: `Invalid protocol: ${traffic.protocol}. Must be one of: ${validProtocols.join(', ')}`,
        });
        continue;
      }

      // Validate ports
      const srcPortNum = Number(traffic.src_port);
      const dstPortNum = Number(traffic.dst_port);
      if (srcPortNum < 1 || srcPortNum > 65535 || dstPortNum < 1 || dstPortNum > 65535) {
        results.push({
          success: false,
          error: 'Port numbers must be between 1 and 65535',
        });
        continue;
      }

      const features = {
        protocol: traffic.protocol === 'TCP' ? 1 : traffic.protocol === 'UDP' ? 2 : 0,
        src_port: Number(traffic.src_port),
        dst_port: Number(traffic.dst_port),
        duration: Number(traffic.duration),
        bytes_sent: Number(traffic.bytes_sent),
        bytes_received: Number(traffic.bytes_received),
        flags: Number(traffic.flags || 0),
      };

      let aiResult;
      try {
        aiResult = await callAIService(features);
      } catch (aiError) {
        logger.warn(`AI service failed for batch item, using fallback analysis: ${aiError.message}`);
        // Fallback analysis when AI service is unavailable
        aiResult = {
          isAnomaly: false,
          anomaly_score: 0.1,
          cluster: 0,
          attack_type: 'Normal',
          confidence: 0.5,
          attack_probabilities: {
            Normal: 0.8,
            DDoS: 0.05,
            PortScan: 0.05,
            BruteForce: 0.05,
            Malware: 0.05,
          },
        };
      }

      let severity = 'Low';

      if (aiResult.isAnomaly && aiResult.confidence > 0.9) {
        severity = 'Critical';
      } else if (
        aiResult.isAnomaly &&
        aiResult.attack_type !== 'Normal' &&
        aiResult.confidence > 0.7
      ) {
        severity = 'High';
      } else if (aiResult.isAnomaly) {
        severity = 'Medium';
      }

      const predicted_label =
        aiResult.isAnomaly || aiResult.attack_type !== 'Normal' ? 1 : 0;

      const trafficLog = new TrafficLog({
        userId: req.user._id,
        protocol: traffic.protocol,
        src_port: traffic.src_port,
        dst_port: traffic.dst_port,
        src_ip: traffic.src_ip || null,
        dst_ip: traffic.dst_ip || null,
        duration: traffic.duration,
        bytes_sent: traffic.bytes_sent,
        bytes_received: traffic.bytes_received,
        flags: traffic.flags || 0,
        analysis: {
          isAnomaly: Boolean(aiResult.isAnomaly),
          anomalyScore: aiResult.anomaly_score || 0,
          clusterAssignment: aiResult.cluster || -1,
          attack_type: aiResult.attack_type || 'Unknown',
          confidence: aiResult.confidence || 0,
          attackProbabilities: aiResult.attack_probabilities || {},
        },
        predicted_label,
        actual_label: predicted_label,
        detected_by: 'AI Model',
        severity,
        status: aiResult.isAnomaly ? 'pending' : 'confirmed',
        source: 'import',
      });

      await enhanceTrafficLog({
        trafficLog,
        traffic,
        aiResult,
      });

      if (trafficLog.alertTriggered) {
        triggerAlerts(trafficLog);
      }

      logs.push(trafficLog);

      const io = req.app.get('io');
      if (io) {
        io.to(req.user._id.toString()).emit('new_log', trafficLog);
      }

      results.push({
        success: true,
        prediction: trafficLog.analysis,
        severity,
        app_name: trafficLog.app_name,
        tab_title: trafficLog.tab_title,
        real_domain: trafficLog.real_domain,
        anomaly_name: trafficLog.anomaly_name,
      });
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
      });
    }
  }

  let savedLogs = [];
  try {
    savedLogs = await TrafficLog.insertMany(logs);
    logger.info(`✅ Batch analysis saved ${savedLogs.length} logs successfully`);
  } catch (saveError) {
    logger.error(`❌ Failed to save batch traffic logs: ${saveError.message}`);
    logger.error(`Save error details:`, saveError);
    // Try to save individually to identify which logs are failing
    logger.info('Attempting to save logs individually...');
    const individualResults = [];
    for (let i = 0; i < logs.length; i++) {
      try {
        const savedLog = await logs[i].save();
        individualResults.push(savedLog);
      } catch (individualError) {
        logger.error(`Failed to save log ${i}: ${individualError.message}`);
        individualResults.push(null);
      }
    }
    savedLogs = individualResults.filter(log => log !== null);
    logger.info(`Saved ${savedLogs.length}/${logs.length} logs individually`);
  }

  const processingTime = Date.now() - startTime;

  logger.info(
    `Batch analysis completed: ${savedLogs.length} items processed for user ${req.user._id}`
  );

  return res.status(200).json({
    success: true,
    message: `Processed ${results.filter((r) => r.success).length}/${results.length} items`,
    data: {
      results,
      totalProcessed: results.length,
      successCount: results.filter((r) => r.success).length,
      processingTime,
    },
  });
});

export const getStatistics = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const daysBack = parseInt(req.query.days, 10) || 7;

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - daysBack);

  const stats = await TrafficLog.getStatistics(userId, dateFrom);
  const attacks = await TrafficLog.getAttackDistribution(userId, dateFrom);
  const severities = await TrafficLog.getSeverityDistribution(userId, dateFrom);

  const recentAlerts = await TrafficLog.find({
    userId,
    alertTriggered: true,
    createdAt: { $gte: dateFrom },
  })
    .sort({ createdAt: -1 })
    .limit(10);

  return res.status(200).json({
    success: true,
    message: 'Statistics retrieved',
    data: {
      dateRange: {
        from: dateFrom,
        to: new Date(),
        days: daysBack,
      },
      summary: stats,
      attackDistribution: attacks,
      severityDistribution: severities,
      recentAlerts: recentAlerts.map((log) => ({
        id: log._id,
        timestamp: log.createdAt,
        attackType: log.analysis.attack_type,
        severity: log.severity,
        confidence: log.analysis.confidence,
        anomaly_name: log.anomaly_name,
        app_name: log.app_name,
        service_name: log.service_name,
        src_ip: log.src_ip,
        dst_ip: log.dst_ip,
        src_hostname: log.src_hostname,
        dst_hostname: log.dst_hostname,
        src_domain: log.src_domain,
        dst_domain: log.dst_domain,
        real_domain: log.real_domain,
        tab_title: log.tab_title,
        detection_source: log.detection_source,
      })),
    },
  });
});

export const getSeverityTimeline = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const daysBack = parseInt(req.query.days, 10) || 7;

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - daysBack);

  const interval = daysBack <= 1 ? 5 * 60 * 1000 : 60 * 60 * 1000;

  const logs = await TrafficLog.find({
    userId,
    createdAt: { $gte: dateFrom },
  }).sort({ createdAt: 1 });

  const timelineMap = new Map();

  logs.forEach((log) => {
    const time = new Date(
      Math.floor(log.createdAt.getTime() / interval) * interval
    );

    const timeStr = time.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (!timelineMap.has(timeStr)) {
      timelineMap.set(timeStr, {
        time: timeStr,
        Low: 0,
        Medium: 0,
        High: 0,
        Critical: 0,
      });
    }

    const entry = timelineMap.get(timeStr);
    entry[log.severity] = (entry[log.severity] || 0) + 1;
  });

  return res.status(200).json({
    success: true,
    data: Array.from(timelineMap.values()),
  });
});

export default {
  tabSync,
  tabSyncBatch,
  analyzeTraffic,

  analyzeTrafficBatch,
  getStatistics,
  getSeverityTimeline,
};