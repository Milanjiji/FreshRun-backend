const db = require('../config/db');

/**
 * Parses user-agent string into a clean, human-readable device name/browser
 */
const parseUserAgent = (userAgent) => {
  if (!userAgent) return 'Unknown Device';
  
  const ua = userAgent.toLowerCase();
  
  // Custom headers or specific package User-Agents
  if (ua.includes('okhttp') || ua.includes('react-native') || ua.includes('expo')) {
    if (ua.includes('android')) return 'Android App';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS App';
    return 'Mobile App';
  }
  
  if (ua.includes('postmanruntime')) return 'Postman / API client';
  if (ua.includes('curl')) return 'Curl / CLI tool';
  
  // Standard Browsers
  if (ua.includes('chrome') && !ua.includes('chromium')) {
    if (ua.includes('android')) return 'Chrome (Android)';
    if (ua.includes('iphone')) return 'Chrome (iPhone)';
    if (ua.includes('macintosh')) return 'Chrome (Mac)';
    if (ua.includes('windows')) return 'Chrome (Windows)';
    return 'Chrome Browser';
  }
  if (ua.includes('safari') && !ua.includes('chrome')) {
    if (ua.includes('iphone') || ua.includes('ipad')) return 'Safari (iOS)';
    if (ua.includes('macintosh')) return 'Safari (Mac)';
    return 'Safari Browser';
  }
  if (ua.includes('firefox')) {
    if (ua.includes('android')) return 'Firefox (Android)';
    if (ua.includes('iphone')) return 'Firefox (iPhone)';
    return 'Firefox Browser';
  }
  
  // Fallbacks
  if (ua.includes('android')) return 'Android Device';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('macintosh')) return 'Apple Device';
  if (ua.includes('windows')) return 'Windows PC';
  if (ua.includes('linux')) return 'Linux PC';

  return userAgent.length > 50 ? userAgent.substring(0, 47) + '...' : userAgent;
};

/**
 * Logs a login/verification/OTP request activity
 */
const logActivity = async (req, phone, actionType, status, errorMessage = null) => {
  try {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
    // Clean up IPv6 loopback or proxy arrays
    const ip = rawIp.split(',')[0].trim().replace(/^::ffff:/, '');
    
    const rawUserAgent = req.headers['user-agent'] || 'Unknown User-Agent';
    const deviceInfo = parseUserAgent(rawUserAgent);

    await db.query(
      `INSERT INTO activity_logs (phone, ip_address, device_info, action_type, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [phone || 'unknown', ip, deviceInfo, actionType, status, errorMessage]
    );
  } catch (error) {
    console.error('[activityLogger] Failed to write activity log:', error);
  }
};

module.exports = {
  logActivity,
  parseUserAgent
};
