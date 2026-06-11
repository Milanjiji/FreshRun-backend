const db = require('../config/db');
const { sendOrderNotification } = require('../utils/notification');

// Create a new support ticket
const createTicket = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { order_id, category, message, device_info, attachment_url, upi_id, upi_qr_url } = req.body;

    if (!category || !message) {
      return res.status(400).json({ success: false, error: 'Category and message are required' });
    }

    const query = `
      INSERT INTO support_tickets (user_id, order_id, category, message, device_info, attachment_url, upi_id, upi_qr_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [user_id, order_id || null, category, message, device_info || null, attachment_url || null, upi_id || null, upi_qr_url || null];
    const result = await db.query(query, values);
    const newTicket = result.rows[0];

    res.status(201).json({ success: true, ticket: newTicket });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get all tickets for a specific user
const getTicketsByUser = async (req, res) => {
  try {
    const user_id = req.user.id;
    const query = `
      SELECT t.*, o.total_amount, s.name as store_name
      FROM support_tickets t
      LEFT JOIN orders o ON t.order_id = o.id
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC;
    `;
    const result = await db.query(query, [user_id]);
    res.status(200).json({ success: true, tickets: result.rows });
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get details of a single ticket and its replies timeline
const getTicketDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const is_admin = req.user.role === 'admin';

    // Fetch the ticket with order/store context (including store phone)
    const ticketQuery = `
      SELECT t.*, u.full_name as user_name, u.phone as user_phone, o.total_amount, s.name as store_name, s.phone as store_phone
      FROM support_tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN orders o ON t.order_id = o.id
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE t.id = $1;
    `;
    const ticketRes = await db.query(ticketQuery, [id]);
    const ticket = ticketRes.rows[0];

    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    // Security check: Only owner of the ticket or admin can view details
    if (!is_admin && ticket.user_id !== user_id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Fetch replies
    const repliesQuery = `
      SELECT * FROM ticket_replies
      WHERE ticket_id = $1
      ORDER BY created_at ASC;
    `;
    const repliesRes = await db.query(repliesQuery, [id]);

    res.status(200).json({
      success: true,
      ticket,
      replies: repliesRes.rows
    });
  } catch (error) {
    console.error('Error fetching ticket details:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Add a reply to a support ticket
const addReply = async (req, res) => {
  try {
    const { id } = req.params;
    const sender_id = req.user.id;
    const { message, attachment_url, sender_type } = req.body; // sender_type is 'user' or 'admin'

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Verify ticket exists
    const ticketRes = await db.query('SELECT * FROM support_tickets WHERE id = $1', [id]);
    const ticket = ticketRes.rows[0];
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    // Security check: Only owner or admin can reply
    if (req.user.role !== 'admin' && ticket.user_id !== sender_id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Insert the reply
    const insertQuery = `
      INSERT INTO ticket_replies (ticket_id, sender_type, sender_id, message, attachment_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const insertValues = [id, sender_type || 'user', sender_id, message, attachment_url || null];
    const replyRes = await db.query(insertQuery, insertValues);
    const newReply = replyRes.rows[0];

    // Update the ticket status & updated_at timestamp
    const nextStatus = sender_type === 'admin' ? 'in_progress' : 'open';
    await db.query(
      'UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [nextStatus, id]
    );

    // Send push notification if admin is replying to user
    if (sender_type === 'admin' && ticket.user_id) {
      const notificationTitle = 'Support Reply Received 💬';
      const notificationBody = message.length > 60 ? `${message.substring(0, 57)}...` : message;
      await sendOrderNotification(ticket.user_id, notificationTitle, notificationBody, {
        ticketId: String(id),
        type: 'ticket_reply'
      });
    }

    res.status(201).json({ success: true, reply: newReply });
  } catch (error) {
    console.error('Error adding ticket reply:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Admin: Get all tickets
const getAllTickets = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const query = `
      SELECT t.*, u.full_name as user_name, u.phone as user_phone, o.total_amount, s.name as store_name
      FROM support_tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN orders o ON t.order_id = o.id
      LEFT JOIN stores s ON o.store_id = s.id
      ORDER BY 
        CASE WHEN t.status = 'open' THEN 0 WHEN t.status = 'in_progress' THEN 1 ELSE 2 END,
        t.updated_at DESC;
    `;
    const result = await db.query(query);
    res.status(200).json({ success: true, tickets: result.rows });
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Admin: Update ticket status/resolution
const updateTicketStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    const { id } = req.params;
    const { status } = req.body; // 'open', 'in_progress', 'resolved'

    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const query = `
      UPDATE support_tickets
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await db.query(query, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    res.status(200).json({ success: true, ticket: result.rows[0] });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  createTicket,
  getTicketsByUser,
  getTicketDetails,
  addReply,
  getAllTickets,
  updateTicketStatus
};
