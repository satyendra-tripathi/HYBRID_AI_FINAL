// import dotenv from 'dotenv';
// dotenv.config();
// import express from 'express';
// import { createServer } from 'http';
// import { Server } from 'socket.io';
// import morgan from 'morgan';
// import connectDB from './config/database.js';
// import {
//   helmetConfig,
//   corsConfig,
//   createRateLimiter,
//   SECURITY_CONFIG,
// } from './config/security.js';
// import {
//   notFoundHandler,
//   errorHandler,
//   asyncHandler,
//   AppError,
// } from './middleware/errorHandler.js';
// import { logHttpRequest } from './utils/logger.js';
// import logger from './utils/logger.js';

// // Import routes
// import authRoutes from './routes/auth.js';
// import analyzeRoutes from './routes/analyze.js';
// import logsRoutes from './routes/logs.js';
// import metricsRoutes from './routes/metrics.js';
// import tabRoutes from './routes/tabRoutes.js';
// import logsController from './controllers/logsController.js';
// import { authenticate } from './middleware/auth.js';

// // Initialize Express app
// const app = express();
// const httpServer = createServer(app);

// // Initialize Socket.io
// const io = new Server(httpServer, {
//   cors: {
//     origin: process.env.CLIENT_URL || '*',
//     methods: ['GET', 'POST'],
//   },
// });

// // Make io accessible in routes
// app.set('io', io);

// io.on('connection', (socket) => {
//   logger.info(`🔌 Client connected: ${socket.id}`);

//   socket.on('join', (room) => {
//     socket.join(room);
//     logger.info(`👤 Client ${socket.id} joined room: ${room}`);
//   });

//   socket.on('disconnect', () => {
//     logger.info(`🔌 Client disconnected: ${socket.id}`);
//   });
// });

// // ============================================================================
// // MIDDLEWARE SETUP
// // ============================================================================

// // Security: Helmet
// app.use(helmetConfig);

// // CORS
// app.use(corsConfig);

// // Body parser
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// // HTTP logging

// app.get("/", (req, res) => {
//   res.send("API is running 🚀");
// });
// app.use(morgan('combined', {
//   skip: (req) => req.path === '/health',
// }));

// // Custom HTTP request logger
// app.use(logHttpRequest);

// // General rate limiter (100 requests per 15 minutes)
// const limiter = createRateLimiter(15 * 60 * 1000, 100);
// app.use(limiter);

// // ============================================================================
// // HEALTH CHECK & UTILITY ROUTES
// // ============================================================================

// /**
//  * Health check endpoint
//  */
// app.get('/health', asyncHandler(async (req, res) => {
//   const db = await connectDB.checkDBHealth?.() || { status: 'unknown' };
  
//   return res.status(200).json({
//     success: true,
//     message: 'Server is healthy',
//     timestamp: new Date().toISOString(),
//     environment: process.env.NODE_ENV,
//     database: db,
//   });
// }));

// /**
//  * API info endpoint
//  */
// app.get('/api/info', (req, res) => {
//   res.status(200).json({
//     name: 'AI Intrusion Detection System',
//     version: '1.0.0',
//     description: 'Production-ready hybrid AI IDS with K-Means and LSTM',
//     endpoints: {
//       auth: '/api/auth',
//       analyze: '/api/analyze',
//       logs: '/api/logs',
//       metrics: '/api/metrics',
//     },
//   });
// });

// // API ROUTES
// // ============================================================================

// app.use('/api/auth', authRoutes);
// app.use('/api/analyze', analyzeRoutes);
// app.use('/api/logs', logsRoutes);
// app.use('/api/metrics', metricsRoutes);
// app.use('/api/tab', tabRoutes);

// // ============================================================================
// // ERROR HANDLING
// // ============================================================================

// // 404 handler
// app.use(notFoundHandler);

// // Global error handler
// app.use(errorHandler);

// // ============================================================================
// // SERVER INITIALIZATION
// // ============================================================================

// const PORT = process.env.PORT || 5000;

// /**
//  * Start server
//  */
// const startServer = async () => {
//   try {
//     // Connect to MongoDB
//     await connectDB();
//     logger.info('✅ Database connected');

//     // Start server
//     httpServer.listen(PORT, () => {
//       logger.info(`✅ Server running on http://localhost:${PORT}`);
//       logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
//       logger.info(`🔐 Security: Helmet, CORS, JWT enabled`);
//       logger.info(`🚀 WebSockets enabled`);
//       console.log(`
// ╔════════════════════════════════════════════════════════════╗
// ║                                                            ║
// ║   🛡️  AI Intrusion Detection System                       ║
// ║                                                            ║
// ║   API Server: http://localhost:${PORT}                       ║
// ║   Health Check: http://localhost:${PORT}/health              ║
// ║                                                            ║
// ║   Documentation:                                          ║
// ║   - POST   /api/auth/register          - Register          ║
// ║   - POST   /api/auth/login             - Login             ║
// ║   - GET    /api/auth/me                - Get Profile       ║
// ║   - POST   /api/analyze                - Analyze Traffic   ║
// ║   - POST   /api/analyze/batch          - Batch Analysis    ║
// ║   - GET    /api/analyze/statistics     - Get Stats         ║
// ║   - GET    /api/logs                   - Get Logs          ║
// ║   - PATCH  /api/logs/:id/status        - Update Status     ║
// ║                                                            ║
// ╚════════════════════════════════════════════════════════════╝
//       `);
//     });

//     // Graceful shutdown
//     process.on('SIGTERM', () => {
//       logger.info('SIGTERM received, shutting down gracefully...');
//       httpServer.close(() => {
//         logger.info('Server closed');
//         process.exit(0);
//       });
//     });

//     process.on('SIGINT', () => {
//       logger.info('SIGINT received, shutting down gracefully...');
//       httpServer.close(() => {
//         logger.info('Server closed');
//         process.exit(0);
//       });
//     });
//   } catch (error) {
//     logger.error(`Failed to start server: ${error.message}`);
//     process.exit(1);
//   }
// };

// // Start the server
// startServer();

// export { app, io };
// export default app;

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import morgan from "morgan";

import connectDB from "./config/database.js";
import { helmetConfig, createRateLimiter } from "./config/security.js";

import {
  notFoundHandler,
  errorHandler,
  asyncHandler,
} from "./middleware/errorHandler.js";

import { logHttpRequest } from "./utils/logger.js";
import logger from "./utils/logger.js";

import authRoutes from "./routes/auth.js";
import analyzeRoutes from "./routes/analyze.js";
import logsRoutes from "./routes/logs.js";
import metricsRoutes from "./routes/metrics.js";
import tabRoutes from "./routes/tabRoutes.js";

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 5000;

const envOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGINS,
]
  .filter(Boolean)
  .flatMap((origin) => origin.split(","))
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "https://hybrid-ai-final-4.onrender.com",
  ...envOrigins,
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    logger.warn(`❌ CORS blocked origin: ${origin}`);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.set("io", io);

/* =========================
   Security + CORS
========================= */
app.use(helmetConfig);
app.use(cors(corsOptions));

/*
  Express 5 me app.options("*") kabhi-kabhi crash karta hai.
  app.use(cors()) already OPTIONS/preflight handle kar deta hai.
*/
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/* =========================
   Health / Root
========================= */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI-IDS API is running 🚀",
  });
});

app.get(
  "/health",
  asyncHandler(async (req, res) => {
    const db =
      typeof connectDB.checkDBHealth === "function"
        ? await connectDB.checkDBHealth()
        : { status: "unknown" };

    res.status(200).json({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: db,
    });
  })
);

/* =========================
   Logging + Rate Limit
========================= */
app.use(
  morgan("combined", {
    skip: (req) => req.path === "/health",
  })
);

app.use(logHttpRequest);

const limiter = createRateLimiter(15 * 60 * 1000, 100);
app.use(limiter);

/* =========================
   Socket.IO
========================= */
io.on("connection", (socket) => {
  logger.info(`🔌 Client connected: ${socket.id}`);

  socket.on("join", (room) => {
    if (!room) return;
    socket.join(room);
    logger.info(`👤 Client ${socket.id} joined room: ${room}`);
  });

  socket.on("disconnect", () => {
    logger.info(`🔌 Client disconnected: ${socket.id}`);
  });
});

/* =========================
   API Info
========================= */
app.get("/api/info", (req, res) => {
  res.status(200).json({
    success: true,
    name: "AI Intrusion Detection System",
    version: "1.0.0",
    description: "Production-ready hybrid AI IDS with K-Means and LSTM",
    endpoints: {
      auth: "/api/auth",
      analyze: "/api/analyze",
      logs: "/api/logs",
      metrics: "/api/metrics",
      tab: "/api/tab",
    },
  });
});

/* =========================
   Routes
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/analyze", analyzeRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/tab", tabRoutes);

/* =========================
   Error Handlers
========================= */
app.use(notFoundHandler);
app.use(errorHandler);

/* =========================
   Start Server
========================= */
const startServer = async () => {
  try {
    await connectDB();

    logger.info("✅ Database connected");

    httpServer.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`🌐 Allowed origins: ${allowedOrigins.join(", ")}`);
    });
  } catch (error) {
    logger.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);

  httpServer.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer();

export { app, io };
export default app;