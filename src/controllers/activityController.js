const db = require('../config/db');

/**
 * Get recent activity logs for admin dashboard
 * GET /activity
 */
const getActivityLogs = async (req, res) => {
  try {
    // Only allow admin role (or bypass if origin matched authMiddleware)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied: Admin only' });
    }

    const result = await db.query(
      `SELECT id, phone, ip_address, device_info, action_type, status, error_message, created_at
       FROM activity_logs
       ORDER BY created_at DESC
       LIMIT 200`
    );

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = {
  getActivityLogs
};
