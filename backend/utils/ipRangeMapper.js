/**
 * Map known IP ranges to organizations
 * @param {string} ip 
 * @returns {string}
 */
export const getIPOwner = (ip) => {
  if (!ip) return 'Unknown';

  // Google
  if (ip.startsWith('8.8.') || ip.startsWith('8.4.') || ip.startsWith('142.250.') || ip.startsWith('172.217.')) {
    return 'Google';
  }

  // Microsoft / Azure
  if (ip.startsWith('20.') || ip.startsWith('40.') || ip.startsWith('52.') || ip.startsWith('104.40.')) {
    return 'Microsoft / Azure';
  }

  // Amazon / AWS
  if (ip.startsWith('3.') || ip.startsWith('13.') || ip.startsWith('18.') || ip.startsWith('54.')) {
    return 'Amazon / AWS';
  }

  // Meta / Facebook / WhatsApp
  if (ip.startsWith('157.240.') || ip.startsWith('31.13.') || ip.startsWith('129.134.') || ip.startsWith('173.252.')) {
    return 'Meta / WhatsApp';
  }

  // Cloudflare
  if (ip.startsWith('104.') || ip.startsWith('172.64.') || ip.startsWith('172.67.') || ip.startsWith('108.162.') || ip.startsWith('1.1.1.1')) {
    return 'Cloudflare';
  }

  return 'Unknown';
};
