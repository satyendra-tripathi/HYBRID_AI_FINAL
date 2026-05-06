/**
 * Map common destination ports to service names
 * @param {number} port 
 * @returns {string}
 */
export const getServiceName = (port) => {
  const portMap = {
    80: 'HTTP',
    443: 'HTTPS',
    53: 'DNS',
    22: 'SSH',
    21: 'FTP',
    25: 'SMTP',
    110: 'POP3',
    143: 'IMAP',
    3306: 'MySQL',
    5432: 'PostgreSQL',
    27017: 'MongoDB',
    3389: 'RDP',
    5060: 'SIP',
    1935: 'RTMP',
    8080: 'HTTP-Proxy',
    3000: 'Dev-Server',
    5001: 'Backend-API',
  };

  return portMap[port] || `Port ${port}`;
};
