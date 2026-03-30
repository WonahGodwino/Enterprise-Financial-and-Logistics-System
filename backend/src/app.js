// backend/src/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
import apiRoutes from './routes/api.routes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Performance middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined')); // More detailed logging than 'dev'

// Request timestamp middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    service: 'mapsi-efms-backend',
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// API v1 (versioned) mounted first so versioned paths match before the generic mount
app.use('/api/v1', apiRoutes); // Same routes available under /api/v1

// API Routes - Mount the centralized router (generic)
app.use('/api', apiRoutes); // All routes from api.routes.js will be prefixed with /api

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    originalError: err.originalError ? { message: err.originalError.message, stack: err.originalError.stack } : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Default error status and message
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Send error response
  res.status(status).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'development' ? {
      stack: err.stack,
      details: err.details || null
    } : undefined,
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║     MAPSI-EFMS Backend Server Running        ║
  ╠══════════════════════════════════════════════╣
  ║ Port: ${PORT.toString().padEnd(36)} ║
  ║ Environment: ${(process.env.NODE_ENV || 'development').padEnd(30)} ║
  ║ API Base: /api                               ║
  ║ Health: /health                               ║
  ║ Timestamp: ${new Date().toISOString().padEnd(30)} ║
  ╚══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;