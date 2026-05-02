import dns from 'dns';
const dnsPromises = dns.promises;

// Cache for DNS results
const dnsCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

/**
 * Resolve an IP address to a hostname
 * @param {string} ip - IP address to resolve
 * @returns {Promise<string>} - Resolved hostname or "Unknown"
 */
export const resolveIP = async (ip) => {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'Local') {
    return 'Local Device';
  }

  // Check cache
  const cached = dnsCache.get(ip);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.hostname;
  }

  try {
    // Reverse DNS lookup with timeout
    const reversePromise = dnsPromises.reverse(ip);
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DNS Timeout')), 2000)
    );

    // Race the lookup against the timeout
    const hostnames = await Promise.race([reversePromise, timeoutPromise]);
    
    const hostname = hostnames && hostnames.length > 0 ? hostnames[0] : 'Unknown';
    
    // Store in cache
    dnsCache.set(ip, { hostname, timestamp: Date.now() });
    
    return hostname;
  } catch (error) {
    // Fallback if DNS fails or times out
    dnsCache.set(ip, { hostname: 'Unknown', timestamp: Date.now() });
    return 'Unknown';
  }
};

/**
 * Extract domain from hostname
 * @param {string} hostname 
 * @returns {string}
 */
export const extractDomain = (hostname) => {
  if (!hostname || hostname === 'Unknown' || hostname === 'Local Device') {
    return 'Unknown';
  }
  
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
};
