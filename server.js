// server/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");

// Load environment variables FIRST
dotenv.config();

// Import database connection
const { connectDB, isConnected, getConnectionStatus, disconnectDB } = require("./config/db");

// Initialize Express app
const app = express();

// ===========================
// Trust Proxy (for IP tracking in enquiries)
// ===========================
app.set('trust proxy', true);

// ===========================
// Middleware Configuration
// ===========================

// CORS Configuration - OPTIMIZED for Railway + Vercel
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://yashengineering.vercel.app',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } 
    // Allow all Vercel deployments (preview & production)
    else if (origin.includes('.vercel.app')) {
      console.log(`✅ Allowing Vercel deployment: ${origin}`);
      callback(null, true);
    }
    else {
      console.warn(`⚠️  Unknown origin: ${origin}`);
      // Allow for now, but you can restrict in production
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Body Parser Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method.padEnd(6);
  console.log(`[${timestamp}] ${method} ${req.path} - Origin: ${req.get('origin') || 'no-origin'}`);
  next();
});

// Request ID Middleware
app.use((req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  next();
});

// ===========================
// API Routes
// ===========================

// Root endpoint - UPDATED for Railway
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🏭 Yash Engineering API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    database: getConnectionStatus(),
    deployment: {
      platform: process.env.RAILWAY_ENVIRONMENT ? 'Railway' : 'Local',
      environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      region: process.env.RAILWAY_REGION || 'Auto'
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
      dashboard: "/api/dashboard"
    }
  });
});

// Health check endpoint - UPDATED for Railway
app.get("/api/health", (req, res) => {
  const dbStatus = getConnectionStatus();
  const isHealthy = isConnected();
  
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
      name: mongoose.connection.name || "Not connected"
    },
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    },
    environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    platform: process.env.RAILWAY_ENVIRONMENT ? 'Railway' : 'Local'
  });
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

  return parts.join(' ');
}

// Ensure upload directories exist
function ensureUploadDirectories() {
  const fs = require('fs');
  const dirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads', 'brochures'),
    path.join(__dirname, 'uploads', 'gallery'),
    path.join(__dirname, 'uploads', 'products'),
    path.join(__dirname, 'uploads', 'services')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

// ===========================
// Auto-Seed Default Admin User
// ===========================

async function seedDefaultAdmin() {
  try {
    const User = require('./models/User');
    
    const adminExists = await User.findOne({ email: 'admin123@gmail.com' });
    
    if (!adminExists) {
      console.log('');
      console.log('🌱 No admin user found. Creating default admin...');
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin@123', salt);
      
      await User.collection.insertOne({
        name: 'Admin',
        email: 'admin123@gmail.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const admin = await User.findOne({ email: 'admin123@gmail.com' });
      const passwordWorks = await bcrypt.compare('admin@123', admin.password);
      
      if (passwordWorks) {
        console.log('✅ Default admin created successfully!');
        console.log('');
        console.log('╔═══════════════════════════════════════╗');
        console.log('║      DEFAULT LOGIN CREDENTIALS        ║');
        console.log('╠═══════════════════════════════════════╣');
        console.log('║  Email:    admin123@gmail.com         ║');
        console.log('║  Password: admin@123                  ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
      } else {
        console.error('❌ Admin created but password verification failed!');
      }
    } else {
      console.log('✅ Admin user already exists');
      
      const passwordWorks = await bcrypt.compare('admin@123', adminExists.password);
      if (!passwordWorks) {
        console.log('⚠️  Admin password mismatch. Resetting...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin@123', salt);
        
        await User.updateOne(
          { email: 'admin123@gmail.com' },
          { password: hashedPassword }
        );
        
        console.log('✅ Admin password reset to: admin@123');
      }
    }
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  }
}

// Create Brochure Routes Inline (if file doesn't exist)
function createBrochureRouter() {
  const router = express.Router();
  const multer = require('multer');
  const fs = require('fs');
  
  // Ensure upload directory exists
  const uploadDir = path.join(__dirname, 'uploads', 'brochures');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Multer configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9]/g, '-')
        .substring(0, 50);
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
  });
  
  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, DOC, DOCX, PPT, PPTX allowed'), false);
      }
    }
  });
  
  // Get Brochure model (create if not exists)
  let Brochure;
  try {
    Brochure = require('./models/Brochure');
  } catch (e) {
    // Create model inline if file doesn't exist
    const brochureSchema = new mongoose.Schema({
      title: { type: String, required: true, trim: true },
      description: { type: String, default: '' },
      fileName: { type: String, required: true },
      fileUrl: { type: String, required: true },
      filePath: { type: String, required: true },
      fileSize: { type: Number, default: 0 },
      mimeType: { type: String },
      isActive: { type: Boolean, default: false },
      downloadCount: { type: Number, default: 0 }
    }, { timestamps: true });
    
    Brochure = mongoose.model('Brochure', brochureSchema);
    console.log('📋 Created Brochure model inline');
  }
  
  // [Keep all your existing brochure route implementations]
  // GET /api/brochure/active
  router.get('/active', async (req, res) => {
    try {
      const brochure = await Brochure.findOne({ isActive: true });
      
      if (!brochure) {
        return res.status(404).json({
          success: false,
          message: 'No active brochure found'
        });
      }
      
      res.json({ success: true, data: brochure });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  // GET /api/brochure
  router.get('/', async (req, res) => {
    try {
      const brochures = await Brochure.find().sort({ createdAt: -1 });
      res.json({
        success: true,
        count: brochures.length,
        data: brochures
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  // [Rest of your brochure routes remain the same...]
  
  return router;
}

// ===========================
// Server Startup Function - OPTIMIZED FOR RAILWAY
// ===========================

const startServer = async () => {
  try {
    // Railway Environment Detection
    const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
    
    console.log('╔════════════════════════════════════════╗');
    console.log('║        SERVER INITIALIZATION           ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    console.log('🚂 Platform:', isRailway ? 'Railway' : 'Local');
    
    if (isRailway) {
      console.log('🚂 Railway Environment:', process.env.RAILWAY_ENVIRONMENT);
      console.log('🔗 Railway Static URL:', process.env.RAILWAY_STATIC_URL || 'Generating...');
    }
    
    // Debug: Log MongoDB URI (masked for security)
    if (process.env.MONGO_URI) {
      const maskedUri = process.env.MONGO_URI.replace(
        /mongodb\+srv:\/\/([^:]+):([^@]+)@/,
        'mongodb+srv://$1:****@'
      );
      console.log("📊 MONGO URI:", maskedUri);
    } else {
      console.error("❌ MONGO_URI not found in environment variables!");
      console.error("   Add MONGO_URI in Railway variables section");
      process.exit(1);
    }

    // ===========================
    // Connect to Database FIRST
    // ===========================
    console.log('🔌 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB connected successfully');
    
    // Ensure upload directories exist
    ensureUploadDirectories();

    // ===========================
    // Seed Default Admin User
    // ===========================
    await seedDefaultAdmin();

    // ===========================
    // Load Routes with Error Handling
    // ===========================
    console.log("📂 Loading routes...");
    
    const routes = {
      auth: { path: './routes/authRoutes', mount: '/api/auth' },
      products: { path: './routes/productRoutes', mount: '/api/products' },
      services: { path: './routes/serviceRoutes', mount: '/api/services' },
      gallery: { path: './routes/galleryRoutes', mount: '/api/gallery' },
      clients: { path: './routes/clientRoutes', mount: '/api/clients' },
      enquiries: { path: './routes/enquiryRoutes', mount: '/api/enquiries' },
      brochure: { path: './routes/brochureRoutes', mount: '/api/brochure' },
      dashboard: { path: './routes/dashRoutes', mount: '/api/dashboard' }
    };

    // Test load each route
    const loadedRoutes = {};
    for (const [name, config] of Object.entries(routes)) {
      try {
        const route = require(config.path);
        
        if (typeof route !== 'function') {
          console.error(`  ❌ ${name}: Invalid router (type: ${typeof route})`);
          throw new Error(`${name} route must export an Express router`);
        }
        
        loadedRoutes[name] = route;
        console.log(`  ✅ ${name} route loaded`);
      } catch (error) {
        console.error(`  ❌ ${name} route failed:`, error.message);
        
        // Create inline brochure router if file doesn't exist
        if (name === 'brochure') {
          console.warn(`  ⚠️  Creating brochure routes inline...`);
          loadedRoutes[name] = createBrochureRouter();
          console.log(`  ✅ ${name} route created inline`);
        } else {
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

    // ===========================
    // Error Handling
    // ===========================

    // 404 Not Found Handler
    app.use((req, res, next) => {
      res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
        availableRoutes: Object.values(routes).map(r => r.mount)
      });
    });

    // Global Error Handler
    app.use((err, req, res, next) => {
      console.error('❌ Error:', err);

      // Multer errors
      if (err.name === 'MulterError') {
        return res.status(400).json({
          success: false,
          message: err.code === 'LIMIT_FILE_SIZE' 
            ? 'File too large. Maximum size is 50MB' 
            : err.message
        });
      }
      
      // Custom multer filter error
      if (err.message && err.message.includes('Only PDF')) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
          success: false,
          message: 'Validation Error',
          errors: messages
        });
      }

      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `${field} already exists`
        });
      }

      if (err.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid ID format'
        });
      }

      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }

      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { 
          stack: err.stack,
          error: err 
        })
      });
    });

    // ===========================
    // Start HTTP Server - OPTIMIZED FOR RAILWAY
    // ===========================
    const PORT = process.env.PORT || 5000;
    const HOST = '0.0.0.0'; // Important for Railway!

    const server = app.listen(PORT, HOST, () => {
      console.log('╔════════════════════════════════════════╗');
      console.log('║   🚀 YASH ENGINEERING SERVER STARTED   ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('');
      console.log(`📡 Server:      http://${HOST}:${PORT}`);
      console.log(`🏥 Health:      http://${HOST}:${PORT}/api/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚂 Platform:    ${isRailway ? 'Railway' : 'Local'}`);
      console.log(`💾 Database:    ✅ MongoDB Connected`);
      console.log(`📂 DB Name:     ${mongoose.connection.name}`);
      console.log(`🖥️  DB Host:     ${mongoose.connection.host}`);
      
      if (isRailway) {
        console.log(`🌐 Railway App: ${process.env.RAILWAY_STATIC_URL || 'Domain will be generated'}`);
      }
      
      console.log('');
      console.log('📋 Available Routes:');
      console.log('  ├── 🔐 /api/auth         - Authentication');
      console.log('  ├── 📦 /api/products     - Products');
      console.log('  ├── 🛠️  /api/services     - Services');
      console.log('  ├── 🖼️  /api/gallery      - Gallery');
      console.log('  ├── 👥 /api/clients      - Clients');
      console.log('  ├── 📧 /api/enquiries    - Enquiries');
      console.log('  ├── 📄 /api/brochure     - Brochures');
      console.log('  └── 📊 /api/dashboard    - Dashboard');
      console.log('');
      console.log('💡 Default Login:');
      console.log('   Email: admin123@gmail.com');
      console.log('   Password: admin@123');
      console.log('');
      
      if (process.env.FRONTEND_URL) {
        console.log('🔗 Frontend URL: ' + process.env.FRONTEND_URL);
      }
      
      console.log('');
      console.log('Press Ctrl+C to stop');
      console.log('════════════════════════════════════════\n');
    });

    // ===========================
    // Graceful Shutdown
    // ===========================

    process.on('unhandledRejection', (err) => {
      console.error('\n❌ UNHANDLED REJECTION:', err.name, err.message);
      server.close(async () => {
        await disconnectDB();
        process.exit(1);
      });
    });

    process.on('uncaughtException', (err) => {
      console.error('\n❌ UNCAUGHT EXCEPTION:', err.name, err.message);
      console.error('Stack:', err.stack);
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      console.log('\n👋 SIGTERM received. Shutting down gracefully...');
      server.close(async () => {
        await disconnectDB();
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\n👋 SIGINT received. Shutting down gracefully...');
      server.close(async () => {
        await disconnectDB();
        console.log('✅ Server closed\n');
        process.exit(0);
      });
    });

    return server;

  } catch (error) {
    console.error('\n❌ Failed to start server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// ===========================
// Start the Server
// ===========================
startServer();

module.exports = app;