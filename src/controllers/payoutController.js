const db = require('../config/db');

// Request a new withdrawal (Delivery Partner)
const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = parseFloat(req.body.amount);

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid withdrawal amount' });
    }

    // Fetch user profile to check details & available balance
    const userRes = await db.query(
      'SELECT total_earnings, withdrawable_earnings, bank_account_number, upi_id FROM users WHERE id = $1',
      [userId]
    );
    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if banking or UPI info is present
    if (!user.upi_id && !user.bank_account_number) {
      return res.status(400).json({
        success: false,
        error: 'Please set up your UPI ID or Bank Account details in your profile first.'
      });
    }

    const withdrawable = parseFloat(user.withdrawable_earnings) || 0;

    // Fetch total of current pending requests
    const pendingRes = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as pending_total FROM withdrawal_requests WHERE user_id = $1 AND status = 'pending'",
      [userId]
    );
    const pendingTotal = parseFloat(pendingRes.rows[0].pending_total) || 0;

    if (amount + pendingTotal > withdrawable) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. You have ₹${withdrawable.toFixed(2)} available, but you already have ₹${pendingTotal.toFixed(2)} in pending requests.`
      });
    }

    // Insert request
    const insertRes = await db.query(
      'INSERT INTO withdrawal_requests (user_id, amount, status) VALUES ($1, $2, \'pending\') RETURNING *',
      [userId, amount]
    );

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully.',
      request: insertRes.rows[0]
    });

  } catch (error) {
    console.error('Request Withdrawal Error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit withdrawal request' });
  }
};

// Get logged-in user's withdrawal requests
const getMyRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      'SELECT * FROM withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.status(200).json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('Get My Payout Requests Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch withdrawal requests' });
  }
};

// Get all withdrawal requests (Admin only)
const getAllRequests = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT wr.*, 
              u.full_name, 
              u.phone, 
              u.email, 
              u.bank_account_number, 
              u.bank_ifsc, 
              u.upi_id,
              u.total_earnings, 
              u.withdrawable_earnings
       FROM withdrawal_requests wr
       JOIN users u ON wr.user_id = u.id
       ORDER BY wr.created_at DESC`
    );
    res.status(200).json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('Get All Payout Requests Error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve withdrawal requests' });
  }
};

// Approve a withdrawal request (Admin only)
const approveWithdrawal = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Lock and get request details
    const requestRes = await client.query(
      'SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE',
      [id]
    );
    const request = requestRes.rows[0];

    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Withdrawal request not found' });
    }

    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Only pending requests can be approved' });
    }

    // Lock user for update to prevent race conditions
    const userRes = await client.query(
      'SELECT withdrawable_earnings FROM users WHERE id = $1 FOR UPDATE',
      [request.user_id]
    );
    const user = userRes.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'User associated with request not found' });
    }

    const withdrawable = parseFloat(user.withdrawable_earnings) || 0;
    const requestAmount = parseFloat(request.amount);

    if (requestAmount > withdrawable) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. User has only ₹${withdrawable.toFixed(2)} withdrawable, but request is for ₹${requestAmount.toFixed(2)}.`
      });
    }

    // Deduct user's withdrawable earnings
    await client.query(
      'UPDATE users SET withdrawable_earnings = COALESCE(withdrawable_earnings, 0) - $1 WHERE id = $2',
      [requestAmount, request.user_id]
    );

    // Record payout in earnings_transactions
    await client.query(
      `INSERT INTO earnings_transactions (user_id, amount, type, description) 
       VALUES ($1, $2, 'payout', $3)`,
      [request.user_id, requestAmount, `Withdrawal request #${id} approved and processed`]
    );

    // Update request status to approved
    await client.query(
      "UPDATE withdrawal_requests SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Withdrawal request approved and processed successfully.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve Withdrawal Request Error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve withdrawal request' });
  } finally {
    client.release();
  }
};

// Reject a withdrawal request (Admin only)
const rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const requestRes = await db.query(
      'SELECT * FROM withdrawal_requests WHERE id = $1',
      [id]
    );
    const request = requestRes.rows[0];

    if (!request) {
      return res.status(404).json({ success: false, error: 'Withdrawal request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Only pending requests can be rejected' });
    }

    await db.query(
      "UPDATE withdrawal_requests SET status = 'rejected', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [rejectionReason || 'Details provided were incorrect', id]
    );

    res.status(200).json({ success: true, message: 'Withdrawal request rejected successfully.' });

  } catch (error) {
    console.error('Reject Withdrawal Request Error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject withdrawal request' });
  }
};

module.exports = {
  requestWithdrawal,
  getMyRequests,
  getAllRequests,
  approveWithdrawal,
  rejectWithdrawal
};
