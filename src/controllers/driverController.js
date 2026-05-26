const db = require('../config/db');

// Update driver FCM token
exports.updateFcmToken = async (req, res) => {
    const { driverId } = req.params;
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ success: false, error: 'Token is required' });
    }

    try {
        // Update fcm_token in the users table for the given driver (user) ID
        const result = await db.query(
            'UPDATE users SET fcm_token = $1 WHERE id = $2 RETURNING id',
            [token, driverId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        return res.status(200).json({ success: true, message: 'FCM token updated' });
    } catch (err) {
        console.error('Error updating FCM token:', err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

