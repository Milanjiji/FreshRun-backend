const express = require('express');
const {
  createTicket,
  getTicketsByUser,
  getTicketDetails,
  addReply,
  getAllTickets,
  updateTicketStatus
} = require('../controllers/ticketController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Customer routes
router.post('/tickets', authMiddleware, createTicket);
router.get('/tickets', authMiddleware, getTicketsByUser);
router.get('/tickets/:id', authMiddleware, getTicketDetails);
router.post('/tickets/:id/replies', authMiddleware, addReply);

// Admin routes
router.get('/admin/tickets', authMiddleware, getAllTickets);
router.patch('/admin/tickets/:id', authMiddleware, updateTicketStatus);

module.exports = router;
