const admin = require('../config/firebase');
const db = require('../config/db');

/**
 * Send a push notification to a driver about an order event.
 * @param {string} userId - UUID of the user (driver).
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {object} data - Additional data payload.
 */
exports.sendOrderNotification = async (userId, title, body, data = {}) => {
    try {
        const result = await db.query('SELECT fcm_token FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];
        
        if (!user?.fcm_token) {
            console.log(`[Notification] No FCM token found for user ${userId}`);
            return;
        }

        const message = {
            token: user.fcm_token,
            notification: { title, body },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK', // For some older integrations if needed
            },
            android: {
                priority: 'high',
                notification: { 
                    channelId: 'order_updates', 
                    sound: 'default',
                    clickAction: 'default'
                },
            },
        };
        await admin.messaging().send(message);
        console.log(`[Notification] Sent to user ${userId}: ${title}`);
    } catch (error) {
        console.error(`[Notification] Failed to send to user ${userId}:`, error.message);
    }
};

/**
 * Broadcast a notification to all active delivery partners about a new order.
 */
exports.broadcastNewOrder = async (orderId, storeName) => {
    try {
        // Find all delivery partners who have a token
        const result = await db.query(
            "SELECT fcm_token FROM users WHERE role = 'delivery' AND approval_status = 'approved' AND fcm_token IS NOT NULL AND fcm_token != ''"
        );
        
        const tokens = result.rows.map(r => r.fcm_token);
        if (tokens.length === 0) return;

        const message = {
            notification: {
                title: 'New Order Available! 🚀',
                body: `A new order from ${storeName} is available for pickup.`,
            },
            data: {
                orderId: String(orderId),
                type: 'new_order'
            },
            android: {
                priority: 'high',
                notification: { 
                    channelId: 'order_updates', 
                    sound: 'default' 
                },
            },
            tokens: tokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[Notification] Broadcasted new order ${orderId} to ${response.successCount} partners.`);
    } catch (error) {
        console.error('[Notification] Broadcast failed:', error.message);
    }
};

