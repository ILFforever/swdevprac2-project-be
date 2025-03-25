const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const cors = require('cors');

// Load env vars
dotenv.config();

// Create Express app
const app = express();

// Apply middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Simple health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: 'Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// Import route files
const cars = require('./routes/cars');
const rents = require('./routes/rents');
const auth = require('./routes/auth');
const provide = require('./routes/Car_Provider'); // Case must match filename exactly

// Connect to database before mounting routes
let dbConnection = null;

// Async initialization
const initializeApp = async () => {
  try {
    // Connect to MongoDB
    dbConnection = await connectDB();
    
    // Mount routers only after successful DB connection
    app.use('/api/v1/cars', cars);
    app.use('/api/v1/rents', rents);
    app.use('/api/v1/car-provider', provide); // Use kebab-case for URL routes
    app.use('/api/v1/auth', auth);
    
    // Add error handler
    app.use(errorHandler);
    
    const PORT = process.env.PORT || 5000;
    
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Failed to initialize app: ${error.message}`);
    // Add fallback routes when DB fails to connect
    app.use('*', (req, res) => {
      res.status(503).json({ 
        success: false, 
        message: 'Service temporarily unavailable. Database connection failed.' 
      });
    });
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running in limited mode on port ${PORT}`);
    });
  }
};

// For serverless environments, we need a different approach
if (process.env.VERCEL) {
  // For Vercel, we'll attempt DB connection on each request if needed
  app.use(async (req, res, next) => {
    if (!dbConnection) {
      try {
        dbConnection = await connectDB();
      } catch (error) {
        console.error(`Failed to connect to database: ${error.message}`);
        return res.status(503).json({
          success: false,
          message: 'Database connection failed'
        });
      }
    }
    next();
  });
  
  // Mount routes regardless
  app.use('/api/v1/cars', cars);
  app.use('/api/v1/rents', rents);
  app.use('/api/v1/car-provider', provide); // Use kebab-case for URL routes
  app.use('/api/v1/auth', auth);
  
  // Add error handler
  app.use(errorHandler);
} else {
  // For traditional environments
  initializeApp();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  // Don't exit the process in a serverless environment
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});

// Export the app for serverless deployment
module.exports = app;