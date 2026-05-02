/**
 * Map domains to friendly application names
 * @param {string} domain 
 * @param {string} hostname
 * @returns {string}
 */
export const getDomainFriendlyName = (domain, hostname = '') => {
  const fullContext = (domain + ' ' + hostname).toLowerCase();

  if (fullContext.includes('meet.google.com')) return 'Google Meet Tab';
  if (fullContext.includes('mail.google.com')) return 'Gmail Tab';
  if (fullContext.includes('youtube.com')) return 'YouTube Tab';
  if (fullContext.includes('google.com')) return 'Google Search Tab';
  if (fullContext.includes('github.com')) return 'GitHub Tab';
  if (fullContext.includes('facebook.com')) return 'Facebook Tab';
  if (fullContext.includes('web.whatsapp.com') || fullContext.includes('whatsapp.net')) return 'WhatsApp Web Tab';
  if (fullContext.includes('slack.com')) return 'Slack Tab';
  if (fullContext.includes('discord.com')) return 'Discord Tab';
  if (fullContext.includes('zoom.us')) return 'Zoom Tab';
  if (fullContext.includes('microsoft.com') || fullContext.includes('office.com') || fullContext.includes('live.com') || fullContext.includes('outlook.com')) return 'Microsoft / Office Tab';
  if (fullContext.includes('cloudflare.com')) return 'Cloudflare Service';
  if (fullContext.includes('amazonaws.com')) return 'AWS Service';
  if (fullContext.includes('googleusercontent.com')) return 'Google Content Tab';
  if (fullContext.includes('fbcdn.net')) return 'Facebook / Meta Content';
  if (fullContext.includes('mongodb.net')) return 'MongoDB Atlas';
  if (fullContext.includes('apple.com') || fullContext.includes('icloud.com')) return 'Apple Service';
  if (fullContext.includes('netflix.com')) return 'Netflix Tab';
  if (fullContext.includes('twitter.com') || fullContext.includes('x.com')) return 'Twitter / X Tab';
  if (fullContext.includes('linkedin.com')) return 'LinkedIn Tab';
  if (fullContext.includes('spotify.com')) return 'Spotify Tab';

  if (domain === 'Unknown') return 'Unknown Tab';
  
  // Prevent double 'Tab' if already present
  if (domain.toLowerCase().includes('tab') || domain.toLowerCase().includes('service')) {
    return domain;
  }
  
  return `${domain} Tab`;
};
