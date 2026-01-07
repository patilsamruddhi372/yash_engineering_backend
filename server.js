// server/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

// Load environment variables FIRST
dotenv.config();

// Import database connection
const { connectDB, isConnected, getConnectionStatus, disconnectDB } = require("./config/db");

// Initialize Express app
const app = express();

// ===========================
// Environment Detection
// ===========================
const isProduction = process.env.NODE_ENV === "production";
const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
const isDevelopment = !isProduction;

// ===========================
// Trust Proxy (for IP tracking)
// ===========================
app.set("trust proxy", true);

// ===========================
// CORS Configuration - FIXED
// ===========================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "https://yashengineering.vercel.app",
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
].filter(Boolean);

// Remove duplicates
const uniqueOrigins = [...new Set(allowedOrigins)];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (uniqueOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow all Vercel deployments
    if (origin.includes(".vercel.app")) {
      return callback(null, true);
    }

    // Allow all Railway deployments
    if (origin.includes(".railway.app")) {
      return callback(null, true);
    }

    // Allow all Netlify deployments
    if (origin.includes(".netlify.app")) {
      return callback(null, true);
    }

    // In development, allow all origins
    if (isDevelopment) {
      console.warn(`⚠️ Allowing unknown origin (dev mode): ${origin}`);
      return callback(null, true);
    }

    // In production, reject unknown origins
    console.warn(`❌ CORS blocked origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
  allowedHeaders: [
    // Standard headers
    "Content-Type",
    "Authorization",
    "Accept",
    "Accept-Language",
    "Accept-Encoding",
    // Custom headers - THIS FIXES THE ERROR
    "X-Requested-With",
    "X-Request-ID",
    "x-request-id",
    "X-Custom-Header",
    // Cache headers
    "Cache-Control",
    "Pragma",
    "If-Modified-Since",
    "If-None-Match",
    // Upload headers
    "Content-Length",
    "Content-Disposition",
    // Origin headers
    "Origin",
    "Referer",
  ],
  exposedHeaders: [
    "Content-Range",
    "X-Content-Range",
    "Content-Disposition",
    "Content-Length",
    "X-Request-ID",
    "X-Total-Count",
  ],
  maxAge: 86400, // 24 hours - browsers cache preflight response
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Apply CORS middleware FIRST
app.use(cors(corsOptions));

// Explicitly handle preflight OPTIONS requests
app.options("*", cors(corsOptions));

// ===========================
// Body Parser Middleware
// ===========================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ===========================
// Static File Serving
// ===========================
const uploadsPath = path.join(__dirname, "uploads");
app.use(
  "/uploads",
  express.static(uploadsPath, {
    maxAge: isProduction ? "1d" : 0,
    etag: true,
    lastModified: true,
  })
);

// ===========================
// Request Logging Middleware
// ===========================
app.use((req, res, next) => {
  if (isDevelopment) {
    const timestamp = new Date().toISOString();
    const method = req.method.padEnd(7);
    const origin = req.get("origin") || "no-origin";
    console.log(`[${timestamp}] ${method} ${req.path} - Origin: ${origin}`);
  }
  next();
});

// ===========================
// Request ID Middleware
// ===========================
app.use((req, res, next) => {
  req.id = req.get("X-Request-ID") || `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader("X-Request-ID", req.id);
  next();
});

// ===========================
// Utility Functions
// ===========================

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function ensureUploadDirectories() {
  const dirs = [
    path.join(__dirname, "uploads"),
    path.join(__dirname, "uploads", "brochures"),
    path.join(__dirname, "uploads", "gallery"),
    path.join(__dirname, "uploads", "products"),
    path.join(__dirname, "uploads", "services"),
    path.join(__dirname, "uploads", "clients"),
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${path.basename(dir)}`);
    }
  });
}

// ===========================
// API Routes - Root & Health
// ===========================

// Root endpoint
app.get("/", (req, res) => {
  const dbStatus = getConnectionStatus();

  res.json({
    success: true,
    message: "🏭 Yash Engineering API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    deployment: {
      platform: isRailway ? "Railway" : "Local",
      environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || "development",
      region: process.env.RAILWAY_REGION || "Auto",
    },
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      products: "/api/products",
      services: "/api/services",
      gallery: "/api/gallery",
      clients: "/api/clients",
      enquiries: "/api/enquiries",
      brochure: "/api/brochure",
      dashboard: "/api/dashboard",
    },
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const dbStatus = getConnectionStatus();
  const isHealthy = isConnected();
  const memUsage = process.memoryUsage();

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? "OK" : "DEGRADED",
    message: isHealthy ? "Server is healthy and running" : "Database connection issue",
    uptime: Math.floor(process.uptime()),
    uptimeFormatted: formatUptime(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      connected: isConnected(),
      host: mongoose.connection.host || "Not connected",
      name: mongoose.connection.name || "Not connected",
      readyState: mongoose.connection.readyState,
    },
    memory: {
      used: formatBytes(memUsage.heapUsed),
      total: formatBytes(memUsage.heapTotal),
      rss: formatBytes(memUsage.rss),
    },
    environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || "development",
    platform: isRailway ? "Railway" : "Local",
    nodeVersion: process.version,
  });
});

// ===========================
// Auto-Seed Default Admin User
// ===========================

async function seedDefaultAdmin() {
  try {
    const User = require("./models/User");

    const adminEmail = process.env.ADMIN_EMAIL || "admin123@gmail.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin@123";

    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
      console.log("");
      console.log("🌱 No admin user found. Creating default admin...");

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      const newAdmin = new User({
        name: "Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        isActive: true,
      });

      await newAdmin.save();

      console.log("✅ Default admin created successfully!");
      console.log("");
      console.log("╔═══════════════════════════════════════╗");
      console.log("║      DEFAULT LOGIN CREDENTIALS        ║");
      console.log("╠═══════════════════════════════════════╣");
      console.log(`║  Email:    ${adminEmail.padEnd(24)}║`);
      console.log(`║  Password: ${adminPassword.padEnd(24)}║`);
      console.log("╚═══════════════════════════════════════╝");
      console.log("");
    } else {
      console.log("✅ Admin user already exists");

      // Reset password in development if explicitly requested
      if (isDevelopment && process.env.RESET_ADMIN_PASSWORD === "true") {
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        await User.updateOne({ email: adminEmail }, { password: hashedPassword });

        console.log("⚠️  Admin password reset (dev mode)");
      }
    }
  } catch (error) {
    console.error("❌ Error seeding admin:", error.message);
  }
}

// ===========================
// Create Brochure Routes (Fallback)
// ===========================

function createBrochureRouter() {
  const router = express.Router();
  const multer = require("multer");

  // Ensure upload directory exists
  const uploadDir = path.join(__dirname, "uploads", "brochures");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Multer configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9]/g, "-")
        .substring(0, 50);
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only PDF, DOC, DOCX, PPT, PPTX files are allowed"), false);
      }
    },
  });

  // Get Brochure model
  let Brochure;
  try {
    Brochure = mongoose.model("Brochure");
  } catch (e) {
    const brochureSchema = new mongoose.Schema(
      {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        filePath: { type: String, required: true },
        fileSize: { type: Number, default: 0 },
        mimeType: { type: String },
        isActive: { type: Boolean, default: false },
        downloadCount: { type: Number, default: 0 },
      },
      { timestamps: true }
    );

    Brochure = mongoose.model("Brochure", brochureSchema);
    console.log("📋 Created Brochure model inline");
  }

  // GET /api/brochure/active
  router.get("/active", async (req, res) => {
    try {
      const brochure = await Brochure.findOne({ isActive: true });

      if (!brochure) {
        return res.status(404).json({
          success: false,
          message: "No active brochure found",
        });
      }

      res.json({ success: true, data: brochure });
    } catch (error) {
      console.error("Error fetching active brochure:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET /api/brochure
  router.get("/", async (req, res) => {
    try {
      const brochures = await Brochure.find().sort({ createdAt: -1 });
      res.json({
        success: true,
        count: brochures.length,
        data: brochures,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/brochure
  router.post("/", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a file",
        });
      }

      const { title, description, setActive } = req.body;

      // If setting as active, deactivate others
      if (setActive === "true" || setActive === true) {
        await Brochure.updateMany({}, { isActive: false });
      }

      const baseUrl = process.env.API_URL || `${req.protocol}://${req.get("host")}`;
      const fileUrl = `${baseUrl}/uploads/brochures/${req.file.filename}`;

      const brochure = new Brochure({
        title: title || req.file.originalname,
        description: description || "",
        fileName: req.file.originalname,
        fileUrl,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        isActive: setActive === "true" || setActive === true,
      });

      await brochure.save();

      res.status(201).json({
        success: true,
        message: "Brochure uploaded successfully",
        data: brochure,
      });
    } catch (error) {
      console.error("Error uploading brochure:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // DELETE /api/brochure/:id
  router.delete("/:id", async (req, res) => {
    try {
      const brochure = await Brochure.findById(req.params.id);

      if (!brochure) {
        return res.status(404).json({
          success: false,
          message: "Brochure not found",
        });
      }

      // Delete file from filesystem
      if (brochure.filePath && fs.existsSync(brochure.filePath)) {
        fs.unlinkSync(brochure.filePath);
      }

      await Brochure.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Brochure deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting brochure:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // PATCH /api/brochure/:id/activate
  router.patch("/:id/activate", async (req, res) => {
    try {
      // Deactivate all brochures
      await Brochure.updateMany({}, { isActive: false });

      // Activate the selected one
      const brochure = await Brochure.findByIdAndUpdate(
        req.params.id,
        { isActive: true },
        { new: true }
      );

      if (!brochure) {
        return res.status(404).json({
          success: false,
          message: "Brochure not found",
        });
      }

      res.json({
        success: true,
        message: "Brochure activated successfully",
        data: brochure,
      });
    } catch (error) {
      console.error("Error activating brochure:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET /api/brochure/download/:id
  router.get("/download/:id", async (req, res) => {
    try {
      const brochure = await Brochure.findByIdAndUpdate(
        req.params.id,
        { $inc: { downloadCount: 1 } },
        { new: true }
      );

      if (!brochure) {
        return res.status(404).json({
          success: false,
          message: "Brochure not found",
        });
      }

      // Check if file exists
      if (!fs.existsSync(brochure.filePath)) {
        return res.status(404).json({
          success: false,
          message: "File not found on server",
        });
      }

      res.download(brochure.filePath, brochure.fileName);
    } catch (error) {
      console.error("Error downloading brochure:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
}

// ===========================
// Load Routes Function
// ===========================

async function loadRoutes() {
  console.log("📂 Loading routes...");

  const routes = {
    auth: { path: "./routes/authRoutes", mount: "/api/auth" },
    products: { path: "./routes/productRoutes", mount: "/api/products" },
    services: { path: "./routes/serviceRoutes", mount: "/api/services" },
    gallery: { path: "./routes/galleryRoutes", mount: "/api/gallery" },
    clients: { path: "./routes/clientRoutes", mount: "/api/clients" },
    enquiries: { path: "./routes/enquiryRoutes", mount: "/api/enquiries" },
    brochure: { path: "./routes/brochureRoutes", mount: "/api/brochure" },
    dashboard: { path: "./routes/dashRoutes", mount: "/api/dashboard" },
  };

  const loadedRoutes = {};

  for (const [name, config] of Object.entries(routes)) {
    try {
      const route = require(config.path);

      if (typeof route !== "function") {
        throw new Error(`${name} route must export an Express router`);
      }

      loadedRoutes[name] = route;
      console.log(`  ✅ ${name} route loaded`);
    } catch (error) {
      if (error.code === "MODULE_NOT_FOUND" && name === "brochure") {
        console.warn(`  ⚠️  ${name} route not found, creating inline...`);
        loadedRoutes[name] = createBrochureRouter();
        console.log(`  ✅ ${name} route created inline`);
      } else if (error.code === "MODULE_NOT_FOUND") {
        console.error(`  ❌ ${name} route not found: ${config.path}`);
        // Skip this route instead of crashing
        continue;
      } else {
        console.error(`  ❌ ${name} route failed:`, error.message);
        throw error;
      }
    }
  }

  // Mount routes
  for (const [name, config] of Object.entries(routes)) {
    if (loadedRoutes[name]) {
      app.use(config.mount, loadedRoutes[name]);
    }
  }

  console.log("✅ All routes mounted successfully\n");
}

// ===========================
// Error Handling Middleware
// ===========================

function setupErrorHandlers() {
  // 404 Not Found Handler
  app.use((req, res, next) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
      suggestion: "Check the API documentation for available endpoints",
    });
  });

  // Global Error Handler
  app.use((err, req, res, next) => {
    // Log error
    console.error("❌ Error:", {
      message: err.message,
      stack: isDevelopment ? err.stack : undefined,
      path: req.path,
      method: req.method,
    });

    // CORS error
    if (err.message === "Not allowed by CORS") {
      return res.status(403).json({
        success: false,
        message: "CORS policy: Origin not allowed",
      });
    }

    // Multer errors
    if (err.name === "MulterError") {
      const messages = {
        LIMIT_FILE_SIZE: "File too large. Maximum size is 50MB",
        LIMIT_FILE_COUNT: "Too many files",
        LIMIT_UNEXPECTED_FILE: "Unexpected file field",
      };
      return res.status(400).json({
        success: false,
        message: messages[err.code] || err.message,
      });
    }

    // Custom file filter error
    if (err.message && (err.message.includes("Only PDF") || err.message.includes("Only"))) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Mongoose Validation Error
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: messages,
      });
    }

    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      });
    }

    // Mongoose Cast Error (Invalid ID)
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid ${err.path}: ${err.value}`,
      });
    }

    // JWT Errors
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    // Default Error
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || "Internal Server Error",
      ...(isDevelopment && {
        stack: err.stack,
        error: err,
      }),
    });
  });
}

// ===========================
// Server Startup Function
// ===========================

const startServer = async () => {
  try {
    console.log("╔════════════════════════════════════════╗");
    console.log("║        SERVER INITIALIZATION           ║");
    console.log("╚════════════════════════════════════════╝");
    console.log("🌍 Environment:", process.env.NODE_ENV || "development");
    console.log("🚂 Platform:", isRailway ? "Railway" : "Local");

    if (isRailway) {
      console.log("🚂 Railway Environment:", process.env.RAILWAY_ENVIRONMENT);
      console.log("🔗 Railway Static URL:", process.env.RAILWAY_STATIC_URL || "Generating...");
    }

    // Validate required environment variables
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI not found in environment variables!");
      console.error("   Add MONGO_URI in Railway variables section or .env file");
      process.exit(1);
    }

    // Debug: Log MongoDB URI (masked for security)
    const maskedUri = process.env.MONGO_URI.replace(
      /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/,
      "mongodb$1://$2:****@"
    );
    console.log("📊 MONGO URI:", maskedUri);

    // Check JWT Secret
    if (!process.env.JWT_SECRET) {
      console.warn("⚠️  JWT_SECRET not set. Using default (not secure for production!)");
      process.env.JWT_SECRET = "default-jwt-secret-change-in-production";
    }

    // ===========================
    // Connect to Database
    // ===========================
    console.log("🔌 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ MongoDB connected successfully");

    // Ensure upload directories exist
    ensureUploadDirectories();

    // ===========================
    // Seed Default Admin User
    // ===========================
    await seedDefaultAdmin();

    // ===========================
    // Load Routes
    // ===========================
    await loadRoutes();

    // ===========================
    // Setup Error Handlers
    // ===========================
    setupErrorHandlers();

    // ===========================
    // Start HTTP Server
    // ===========================
    const PORT = parseInt(process.env.PORT, 10) || 5000;
    const HOST = "0.0.0.0"; // Important for Railway!

    const server = app.listen(PORT, HOST, () => {
      console.log("╔════════════════════════════════════════╗");
      console.log("║   🚀 YASH ENGINEERING SERVER STARTED   ║");
      console.log("╚════════════════════════════════════════╝");
      console.log("");
      console.log(`📡 Server:      http://${HOST}:${PORT}`);
      console.log(`🏥 Health:      http://${HOST}:${PORT}/api/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🚂 Platform:    ${isRailway ? "Railway" : "Local"}`);
      console.log(`💾 Database:    ✅ MongoDB Connected`);
      console.log(`📂 DB Name:     ${mongoose.connection.name}`);
      console.log(`🖥️  DB Host:     ${mongoose.connection.host}`);

      if (isRailway && process.env.RAILWAY_STATIC_URL) {
        console.log(`🌐 Railway App: ${process.env.RAILWAY_STATIC_URL}`);
      }

      console.log("");
      console.log("📋 Available Routes:");
      console.log("  ├── 🔐 /api/auth         - Authentication");
      console.log("  ├── 📦 /api/products     - Products");
      console.log("  ├── 🛠️  /api/services     - Services");
      console.log("  ├── 🖼️  /api/gallery      - Gallery");
      console.log("  ├── 👥 /api/clients      - Clients");
      console.log("  ├── 📧 /api/enquiries    - Enquiries");
      console.log("  ├── 📄 /api/brochure     - Brochures");
      console.log("  └── 📊 /api/dashboard    - Dashboard");
      console.log("");

      if (isDevelopment) {
        console.log("💡 Default Login:");
        console.log(`   Email: ${process.env.ADMIN_EMAIL || "admin123@gmail.com"}`);
        console.log(`   Password: ${process.env.ADMIN_PASSWORD || "admin@123"}`);
        console.log("");
      }

      if (process.env.FRONTEND_URL) {
        console.log("🔗 Frontend URL: " + process.env.FRONTEND_URL);
      }

      console.log("");
      console.log("Press Ctrl+C to stop");
      console.log("════════════════════════════════════════\n");
    });

    // Server error handling
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      }
      throw error;
    });

    // ===========================
    // Graceful Shutdown
    // ===========================

    const gracefulShutdown = async (signal) => {
      console.log(`\n👋 ${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        console.log("🔌 HTTP server closed");

        try {
          await disconnectDB();
          console.log("💾 Database connection closed");
        } catch (err) {
          console.error("Error closing database:", err);
        }

        console.log("✅ Server shutdown complete\n");
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error("⚠️  Forcing shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    process.on("unhandledRejection", (err) => {
      console.error("\n❌ UNHANDLED REJECTION:", err);
      gracefulShutdown("UNHANDLED_REJECTION");
    });

    process.on("uncaughtException", (err) => {
      console.error("\n❌ UNCAUGHT EXCEPTION:", err);
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error("\n❌ Failed to start server:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
};

// ===========================
// Start the Server
// ===========================
startServer();

module.exports = app;