require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const userRoutes = require('./routes/userRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const chefRoutes = require('./routes/chefRoutes'); // New chef routes
const chefRequestRoutes = require('./routes/chefRequestRoutes'); // Import chef request routes
const ratingRoutes = require('./routes/ratingRoutes'); // Import rating routes
const homeRoutes = require('./routes/homeRoutes'); // Import home routes
const menuItemRoutes = require('./routes/menuItemRoutes'); // Import menu item routes

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/chefs', chefRoutes); // Register chef routes
app.use('/api/chef-requests', chefRequestRoutes); // Register chef request routes
app.use('/api/ratings', ratingRoutes); // Register rating routes
app.use('/api/home', homeRoutes); // Register home routes
app.use('/api/menu-items', menuItemRoutes); // Register menu item routes

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Naanly API' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

// Get port from environment or use default
const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;