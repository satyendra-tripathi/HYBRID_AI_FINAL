import mongoose from 'mongoose';

const TrafficLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Network features
    protocol: {
      type: String,
      required: true,
      enum: ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS'],
    },

    src_port: {
      type: Number,
      required: true,
      min: 1,
      max: 65535,
    },

    dst_port: {
      type: Number,
      required: true,
      min: 1,
      max: 65535,
    },

    src_ip: {
      type: String,
      default: null,
    },

    dst_ip: {
      type: String,
      default: null,
    },

    duration: {
      type: Number,
      required: true,
      min: 0,
    },

    bytes_sent: {
      type: Number,
      required: true,
      min: 0,
    },

    bytes_received: {
      type: Number,
      required: true,
      min: 0,
    },

    flags: {
      type: Number,
      default: 0,
    },

    // AI Analysis Results
    analysis: {
      // K-Means Anomaly Detection
      isAnomaly: {
        type: Boolean,
        required: true,
      },

      anomalyScore: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },

      clusterAssignment: {
        type: Number,
        default: -1,
      },

      // LSTM Attack Classification
      attack_type: {
        type: String,
        required: true,
        enum: ['Normal', 'DDoS', 'Port Scan', 'Brute Force', 'Malware', 'Unknown'],
        default: 'Unknown',
      },

      confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },

      // Attack probabilities
      attackProbabilities: {
        Normal: Number,
        DDoS: Number,
        PortScan: Number,
        BruteForce: Number,
        Malware: Number,
      },

      // Processing info
      processingTime: {
        type: Number, // milliseconds
        default: 0,
      },

      modelVersion: {
        type: String,
        default: '1.0.0',
      },
    },

    // Production Fields
    detected_by: {
      type: String,
      enum: ['AI Model', 'Rule Engine'],
      default: 'AI Model',
    },

    predicted_label: {
      type: Number, // 0: Normal, 1: Attack
      enum: [0, 1],
    },

    actual_label: {
      type: Number, // 0: Normal, 1: Attack
      enum: [0, 1],
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    blockedAt: {
      type: Date,
      default: null,
    },

    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Alert and Severity
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Low',
    },

    alertTriggered: {
      type: Boolean,
      default: false,
    },

    alertMessage: {
      type: String,
      default: null,
    },

    // Investigation status
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'confirmed', 'false_positive', 'ignored', 'Blocked'],
      default: 'pending',
    },

    notes: {
      type: String,
      default: null,
    },

    // Metadata
    source: {
      type: String,
      default: 'api',
      enum: ['api', 'import', 'realtime'],
    },

    rawPacketData: {
      type: String,
      default: null,
      select: false,
    },

    // Enhanced Traffic Info
    src_hostname: {
      type: String,
      default: 'Unknown',
    },
    dst_hostname: {
      type: String,
      default: 'Unknown',
    },
    src_domain: {
      type: String,
      default: 'Unknown',
    },
    dst_domain: {
      type: String,
      default: 'Unknown',
    },
    app_name: {
      type: String,
      default: 'Unknown',
    },
    service_name: {
      type: String,
      default: 'Unknown',
    },
    anomaly_name: {
      type: String,
      default: 'Normal Traffic',
    },
    real_domain: {
      type: String,
      default: 'Unknown',
    },
    tab_title: {
      type: String,
      default: null,
    },
    detection_source: {
      type: String,
      enum: ['SNI', 'HTTP', 'DNS', 'Unknown', 'DNS-Cache', 'DNS-Reverse'],
      default: 'Unknown',
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, createdAt: -1 },
      { severity: 1, alertTriggered: 1 },
      { 'analysis.attack_type': 1 },
      { createdAt: -1 },
    ],
  }
);

/**
 * Determine severity based on analysis
 */
TrafficLogSchema.pre('save', function (next) {
  const analysis = this.analysis;

  if (!analysis) {
    this.severity = 'Low';
    return next();
  }

  // Critical: Anomaly detected + High confidence attack
  if (analysis.isAnomaly && analysis.confidence > 0.9) {
    this.severity = 'Critical';
    this.alertTriggered = true;
  }
  // High: Confirmed attack with high confidence
  else if (
    analysis.attack_type !== 'Normal' &&
    analysis.confidence > 0.7 &&
    analysis.isAnomaly
  ) {
    this.severity = 'High';
    this.alertTriggered = true;
  }
  // Medium: Suspicious pattern detected
  else if (analysis.isAnomaly && analysis.anomalyScore > 0.7) {
    this.severity = 'Medium';
    this.alertTriggered = true;
  }
  // Low: Normal traffic
  else {
    this.severity = 'Low';
    this.alertTriggered = false;
  }

  // Set alert message
  if (this.alertTriggered) {
    this.alertMessage = `${analysis.attack_type} detected (${(analysis.confidence * 100).toFixed(1)}% confidence)`;
  }

  next();
});

/**
 * Get formatted log data
 */
TrafficLogSchema.methods.toJSON = function () {
  const obj = this.toObject();
  
  // Don't expose raw packet data unless specifically needed
  delete obj.rawPacketData;
  
  // Format analysis data
  if (obj.analysis) {
    obj.analysis.anomalyScore = parseFloat(obj.analysis.anomalyScore.toFixed(4));
    obj.analysis.confidence = parseFloat(obj.analysis.confidence.toFixed(4));
  }

  return obj;
};

/**
 * Static method to get statistics
 */
TrafficLogSchema.statics.getStatistics = async function (userId, dateFrom = null) {
  const match = { userId };
  
  if (dateFrom) {
    match.createdAt = { $gte: dateFrom };
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalPackets: { $sum: 1 },
        anomalies: {
          $sum: { $cond: ['$analysis.isAnomaly', 1, 0] },
        },
        alerts: {
          $sum: { $cond: ['$alertTriggered', 1, 0] },
        },
        avgConfidence: { $avg: '$analysis.confidence' },
        avgAnomalyScore: { $avg: '$analysis.anomalyScore' },
      },
    },
  ]);

  return stats[0] || {
    totalPackets: 0,
    anomalies: 0,
    alerts: 0,
    avgConfidence: 0,
    avgAnomalyScore: 0,
  };
};

/**
 * Static method to get attack type distribution
 */
TrafficLogSchema.statics.getAttackDistribution = async function (userId, dateFrom = null) {
  const match = { userId, alertTriggered: true };
  
  if (dateFrom) {
    match.createdAt = { $gte: dateFrom };
  }

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$analysis.attack_type',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$analysis.confidence' },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

/**
 * Static method to get severity distribution
 */
TrafficLogSchema.statics.getSeverityDistribution = async function (userId, dateFrom = null) {
  const match = { userId };
  
  if (dateFrom) {
    match.createdAt = { $gte: dateFrom };
  }

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$severity',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const TrafficLog = mongoose.model('TrafficLog', TrafficLogSchema);

export default TrafficLog;
