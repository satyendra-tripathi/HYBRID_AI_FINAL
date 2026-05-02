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

/**
 * Sync tab information from browser extension
 */
export const tabSync = asyncHandler(async (req, res) => {
  const { domain, title } = req.body;
  if (domain && title) {
    global.tabMap = global.tabMap || {};
    global.tabMap[domain] = title;
  }
  return res.status(200).json({ success: true });
});

/**
 * Send traffic data to AI service for analysis
 */
const callAIService = async (features) => {
  console.log(`[DEBUG] Calling AI Service at: ${process.env.AI_SERVICE_URL}/predict`);
  try {
    const response = await axios.post(
      `${process.env.AI_SERVICE_URL}/predict`,
      { features },
      {
        timeout: process.env.AI_SERVICE_TIMEOUT || 30000,
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      logger.error(`AI Service error [${error.response.status}]: ${JSON.stringify(error.response.data)}`);
    } else {
      logger.error(`AI Service error: ${error.message}`);
    }
    throw new AppError('AI service unavailable', 503);
  }
};

/**
 * Analyze traffic
 * POST /api/analyze
 */
export const analyzeTraffic = asyncHandler(async (req, res) => {
  const {
    protocol,
    src_port,
    dst_port,
    duration,
    bytes_sent,
    bytes_received,
    src_ip = null,
    dst_ip,
    flags,
    real_domain,
    detection_source,
    tab_title
  } = req.body;

  const startTime = Date.now();

  // Prepare features for AI model
  const features = {
    protocol: protocol === "TCP" ? 1 : protocol === "UDP" ? 2 : 0,
    src_port: Number(src_port),
    dst_port: Number(dst_port),
    duration: Number(duration),
    bytes_sent: Number(bytes_sent),
    bytes_received: Number(bytes_received),
    flags: Number(flags || 0),
  };

  // Call AI service
  const aiResult = await callAIService(features);

  const processingTime = Date.now() - startTime;

  // Determine severity
  let severity = 'Low';
  if (aiResult.isAnomaly && aiResult.confidence > 0.9) {
    severity = 'Critical';
  } else if (aiResult.isAnomaly && aiResult.attack_type !== 'Normal' && aiResult.confidence > 0.7) {
    severity = 'High';
  } else if (aiResult.isAnomaly) {
    severity = 'Medium';
  }

  // Determine predicted label
  const predicted_label = (aiResult.isAnomaly || aiResult.attack_type !== 'Normal') ? 1 : 0;

  // Create traffic log
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
      isAnomaly: aiResult.isAnomaly,
      anomalyScore: aiResult.anomaly_score || 0,
      clusterAssignment: aiResult.cluster || -1,
      attack_type: aiResult.attack_type || 'Unknown',
      confidence: aiResult.confidence || 0,
      attackProbabilities: aiResult.attack_probabilities || {},
      processingTime,
    },
    predicted_label,
    actual_label: predicted_label, // Default to predicted
    detected_by: 'AI Model',
    severity,
    status: aiResult.isAnomaly ? 'pending' : 'confirmed',
    source: 'api',
  });

  // Enhance with traffic info
  try {
    let [srcHost, dstHost] = await Promise.all([
      resolveIP(src_ip),
      resolveIP(dst_ip)
    ]);

    // Fallback to IP Owner if DNS fails
    if (srcHost === 'Unknown') {
      const owner = getIPOwner(src_ip);
      if (owner !== 'Unknown') srcHost = owner;
    }
    if (dstHost === 'Unknown') {
      const owner = getIPOwner(dst_ip);
      if (owner !== 'Unknown') dstHost = owner;
    }
    
    trafficLog.src_hostname = srcHost;
    trafficLog.dst_hostname = dstHost;
    trafficLog.src_domain = extractDomain(srcHost);
    trafficLog.dst_domain = extractDomain(dstHost);
    trafficLog.service_name = getServiceName(dst_port);

    // Enhanced Domain Detection Logic
    if (real_domain && real_domain !== 'Unknown') {
      trafficLog.real_domain = real_domain;
      trafficLog.detection_source = detection_source || 'Unknown';
      trafficLog.app_name = getDomainFriendlyName(real_domain, real_domain);
      trafficLog.tab_title = tab_title || (global.tabMap && global.tabMap[real_domain]) || null;
    } else {
      const cdnKeywords = ['cloudflare', 'amazonaws', 'akamai', 'cloudfront', 'googleusercontent', 'fastly'];
      const isCDN = cdnKeywords.some(kw => dstHost.toLowerCase().includes(kw));
      
      trafficLog.real_domain = isCDN ? 'Unknown Tab (CDN)' : (dstHost !== 'Unknown' ? dstHost : 'Unknown Tab');
      trafficLog.detection_source = 'DNS';
      trafficLog.app_name = getDomainFriendlyName(trafficLog.dst_domain, dstHost);
    }
    
    // Calculate anomaly name
    trafficLog.anomaly_name = getAnomalyName({
      aiResult,
      dst_port,
      dst_domain: trafficLog.dst_domain,
      protocol,
      bytes_sent,
      duration
    });
  } catch (err) {
    logger.error(`Error enhancing traffic log: ${err.message}`);
  }

  // Save to database
  await trafficLog.save();

  // Emit real-time update
  const io = req.app.get('io');
  if (io) {
    io.to(req.user._id.toString()).emit('new_log', trafficLog);
  }

  // Log if alert triggered
  if (trafficLog.alertTriggered) {
    logAIPrediction(trafficLog.analysis, req.user._id);
    triggerAlerts(trafficLog);
  }

  logger.info(`Traffic analyzed for user ${req.user._id}: ${trafficLog.analysis.attack_type}`);

  return res.status(200).json({
    success: true,
    message: 'Traffic analysis completed',
    data: {
      prediction: trafficLog.analysis,
      severity: trafficLog.severity,
      alertTriggered: trafficLog.alertTriggered,
      processingTime,
      logId: trafficLog._id,
    },
  });
});

/**
 * Batch analyze traffic
 * POST /api/analyze/batch
 */
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
      const features = {
        protocol: traffic.protocol === "TCP" ? 1 : traffic.protocol === "UDP" ? 2 : 0,
        src_port: Number(traffic.src_port),
        dst_port: Number(traffic.dst_port),
        duration: Number(traffic.duration),
        bytes_sent: Number(traffic.bytes_sent),
        bytes_received: Number(traffic.bytes_received),
        flags: Number(traffic.flags || 0),
      };

      const aiResult = await callAIService(features);

      let severity = 'Low';
      if (aiResult.isAnomaly && aiResult.confidence > 0.9) {
        severity = 'Critical';
      } else if (aiResult.isAnomaly && aiResult.attack_type !== 'Normal' && aiResult.confidence > 0.7) {
        severity = 'High';
      } else if (aiResult.isAnomaly) {
        severity = 'Medium';
      }

      // Determine predicted label
      const predicted_label = (aiResult.isAnomaly || aiResult.attack_type !== 'Normal') ? 1 : 0;

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
          isAnomaly: aiResult.isAnomaly,
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

      // Enhance with traffic info (Sync resolve for batch to avoid overwhelming DNS if many)
      try {
        let srcHost = await resolveIP(traffic.src_ip);
        let dstHost = await resolveIP(traffic.dst_ip);

        // Fallback to IP Owner if DNS fails
        if (srcHost === 'Unknown') {
          const owner = getIPOwner(traffic.src_ip);
          if (owner !== 'Unknown') srcHost = owner;
        }
        if (dstHost === 'Unknown') {
          const owner = getIPOwner(traffic.dst_ip);
          if (owner !== 'Unknown') dstHost = owner;
        }
        
        trafficLog.src_hostname = srcHost;
        trafficLog.dst_hostname = dstHost;
        trafficLog.src_domain = extractDomain(srcHost);
        trafficLog.dst_domain = extractDomain(dstHost);
        trafficLog.service_name = getServiceName(traffic.dst_port);

        // Enhanced Domain Detection Logic for Batch
        if (traffic.real_domain && traffic.real_domain !== 'Unknown') {
          trafficLog.real_domain = traffic.real_domain;
          trafficLog.detection_source = traffic.detection_source || 'Unknown';
          trafficLog.app_name = getDomainFriendlyName(traffic.real_domain, traffic.real_domain);
          trafficLog.tab_title = traffic.tab_title || (global.tabMap && global.tabMap[traffic.real_domain]) || null;
        } else {
          const cdnKeywords = ['cloudflare', 'amazonaws', 'akamai', 'cloudfront', 'googleusercontent', 'fastly'];
          const isCDN = cdnKeywords.some(kw => dstHost.toLowerCase().includes(kw));
          
          trafficLog.real_domain = isCDN ? 'Unknown Tab (CDN)' : (dstHost !== 'Unknown' ? dstHost : 'Unknown Tab');
          trafficLog.detection_source = 'DNS';
          trafficLog.app_name = getDomainFriendlyName(trafficLog.dst_domain, dstHost);
        }
        
        trafficLog.anomaly_name = getAnomalyName({
          aiResult,
          dst_port: traffic.dst_port,
          dst_domain: trafficLog.dst_domain,
          protocol: traffic.protocol,
          bytes_sent: traffic.bytes_sent,
          duration: traffic.duration
        });
      } catch (err) {
        logger.error(`Error enhancing batch traffic log: ${err.message}`);
      }

      if (trafficLog.alertTriggered) {
        triggerAlerts(trafficLog);
      }

      logs.push(trafficLog);
      
      // Emit real-time update for each log (or could do one batch event)
      const io = req.app.get('io');
      if (io) {
        io.to(req.user._id.toString()).emit('new_log', trafficLog);
      }

      results.push({
        success: true,
        prediction: trafficLog.analysis,
        severity,
      });
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
      });
    }
  }

  // Save all logs
  const savedLogs = await TrafficLog.insertMany(logs);

  const processingTime = Date.now() - startTime;

  logger.info(`Batch analysis completed: ${savedLogs.length} items processed for user ${req.user._id}`);

  return res.status(200).json({
    success: true,
    message: `Processed ${results.filter(r => r.success).length}/${results.length} items`,
    data: {
      results,
      totalProcessed: results.length,
      successCount: results.filter(r => r.success).length,
      processingTime,
    },
  });
});

/**
 * Get analysis statistics
 * GET /api/analyze/statistics
 */
export const getStatistics = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const daysBack = parseInt(req.query.days) || 7;

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - daysBack);

  // Get overall statistics
  const stats = await TrafficLog.getStatistics(userId, dateFrom);

  // Get attack distribution
  const attacks = await TrafficLog.getAttackDistribution(userId, dateFrom);

  // Get severity distribution
  const severities = await TrafficLog.getSeverityDistribution(userId, dateFrom);

  // Get recent alerts
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
      recentAlerts: recentAlerts.map(log => ({
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
        detection_source: log.detection_source
      })),
    },
  });
});

/**
 * Get severity timeline data
 * GET /api/analyze/severity-timeline
 */
export const getSeverityTimeline = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const daysBack = parseInt(req.query.days) || 7;

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - daysBack);

  // Aggregate logs by 1-hour intervals (or 5-min for short ranges)
  const interval = daysBack <= 1 ? 5 * 60 * 1000 : 60 * 60 * 1000; // 5 mins or 1 hour

  const logs = await TrafficLog.find({
    userId,
    createdAt: { $gte: dateFrom }
  }).sort({ createdAt: 1 });

  const timelineMap = new Map();

  logs.forEach(log => {
    const time = new Date(Math.floor(log.createdAt.getTime() / interval) * interval);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!timelineMap.has(timeStr)) {
      timelineMap.set(timeStr, { time: timeStr, Low: 0, Medium: 0, High: 0, Critical: 0 });
    }
    
    const entry = timelineMap.get(timeStr);
    entry[log.severity] = (entry[log.severity] || 0) + 1;
  });

  const timelineData = Array.from(timelineMap.values());

  return res.status(200).json({
    success: true,
    data: timelineData
  });
});

export default {
  analyzeTraffic,
  analyzeTrafficBatch,
  getStatistics,
  getSeverityTimeline,
};
