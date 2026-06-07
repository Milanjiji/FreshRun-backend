const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const orderRoutes = require('./routes/orderRoutes');
const driverRoutes = require('./routes/driverRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const db = require('./config/db');
const socketUtils = require('./utils/socket');


const app = express();
const server = http.createServer(app);
socketUtils.init(server);

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("FreshRun Backend Running ✅");
});

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/stores', storeRoutes);
app.use('/products', productRoutes);
app.use('/settings', settingsRoutes);
app.use('/orders', orderRoutes);
app.use('/drivers', driverRoutes);
app.use('/payments', paymentRoutes);


// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
