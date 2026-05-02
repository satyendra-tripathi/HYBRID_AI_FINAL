/**
 * Generate a descriptive anomaly name based on traffic features and AI results
 * @param {Object} data 
 * @returns {string}
 */
export const getAnomalyName = ({ aiResult, dst_port, dst_domain, protocol, bytes_sent, duration }) => {
  const isAnomaly = aiResult.isAnomaly || aiResult.attack_type !== 'Normal';
  
  if (!isAnomaly) {
    return 'Normal Traffic';
  }

  // Domain specific logic
  if (dst_domain && dst_domain.includes('meet.google.com')) {
    return 'Suspicious Google Meet Traffic';
  }

  // Port specific heuristics
  if (dst_port === 53 && bytes_sent > 100000) {
    return 'Possible DNS Flood';
  }

  if (dst_port === 22 && duration > 60) {
    return 'Possible SSH Brute Force';
  }

  // Protocol / Port Scan heuristic
  if (aiResult.attack_type === 'Port Scan') {
    return 'Possible Port Scan';
  }

  // DoS heuristic
  if (bytes_sent > 1000000 && duration < 5) {
    return 'Possible DoS Attack';
  }

  // AI Classification Fallback
  if (aiResult.attack_type && aiResult.attack_type !== 'Normal' && aiResult.attack_type !== 'Unknown') {
    return `${aiResult.attack_type} Detected`;
  }

  // Default for anomalies
  if (aiResult.isAnomaly) {
    return 'Unclassified Suspicious Traffic';
  }

  return 'Suspicious Activity';
};
