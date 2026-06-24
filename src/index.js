const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const orderRoutes = require('./routes/orderRoutes');
const driverRoutes = require('./routes/driverRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const db = require('./config/db');
const socketUtils = require('./utils/socket');


const app = express();
const server = http.createServer(app);
socketUtils.init(server);

const PORT = process.env.PORT || 5000;

// Rate Limiters
// 1. General Limiter: 200 requests per 15 minutes (excludes health checks and root)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, 
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 15 minutes.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => req.path === '/health' || req.path === '/',
});

// 2. Auth Limiter: 10 requests per 10 minutes
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  message: {
    success: false,
    error: 'Too many login/OTP requests. Please try again after 10 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(generalLimiter);

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("FreshRun Backend Running ✅");
});

app.use('/auth', authLimiter, authRoutes);
app.use('/user', userRoutes);
app.use('/stores', storeRoutes);
app.use('/products', productRoutes);
app.use('/settings', settingsRoutes);
app.use('/orders', orderRoutes);
app.use('/drivers', driverRoutes);
app.use('/payments', paymentRoutes);
app.use('/support', ticketRoutes);
app.use('/categories', categoryRoutes);
app.use('/payouts', payoutRoutes);
app.use('/banners', bannerRoutes);


// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
