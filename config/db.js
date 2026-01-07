const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Check if MONGO_URI exists
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    // Connection options for better reliability
    const options = {
      serverSelectionTimeoutMS: 30000,  // 30 seconds timeout
      socketTimeoutMS: 45000,           // 45 seconds socket timeout
      maxPoolSize: 50,                  // Maximum connections in pool
      minPoolSize: 5,                   // Minimum connections in pool
      family: 4,                        // Use IPv4, skip trying IPv6
      retryWrites: true,
      retryReads: true,
    };

    console.log("🔄 Connecting to MongoDB...");
    
    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📂 Database Name: ${conn.connection.name}`);

    // Connection event listeners for monitoring
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected successfully");
    });

    mongoose.connection.on("close", () => {
      console.log("🔌 MongoDB connection closed");
    });

    // Return connection for confirmation
    return conn;

  } catch (err) {
    console.error("");
    console.error("╔════════════════════════════════════════╗");
    console.error("║     ❌ MongoDB Connection Failed       ║");
    console.error("╚════════════════════════════════════════╝");
    console.error("");
    console.error("Error:", err.message);
    console.error("");

    // Provide helpful error messages based on error type
    if (err.message.includes("whitelist") || err.message.includes("ENOTFOUND") || err.message.includes("getaddrinfo")) {
      console.error("💡 SOLUTION: Whitelist your IP in MongoDB Atlas");
      console.error("   1. Go to: https://cloud.mongodb.com");
      console.error("   2. Click: Network Access → Add IP Address");
      console.error("   3. Add your current IP or use 0.0.0.0/0 for development");
      console.error("   4. Wait 1-2 minutes and restart the server");
      console.error("");
    }

    if (err.message.includes("Authentication") || err.message.includes("auth") || err.message.includes("password")) {
      console.error("💡 SOLUTION: Check your credentials");
      console.error("   1. Verify username and password in .env file");
      console.error("   2. Make sure password is URL-encoded if it has special characters");
      console.error("   3. Check Database Access in MongoDB Atlas");
      console.error("");
    }

    if (err.message.includes("MONGO_URI")) {
      console.error("💡 SOLUTION: Add MONGO_URI to your .env file");
      console.error("   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname");
      console.error("");
    }

    if (err.message.includes("ETIMEDOUT") || err.message.includes("timeout")) {
      console.error("💡 SOLUTION: Connection timed out");
      console.error("   1. Check your internet connection");
      console.error("   2. Disable VPN if using one");
      console.error("   3. Check if MongoDB Atlas cluster is active (not paused)");
      console.error("");
    }

    // Exit process with failure
    process.exit(1);
  }
};

// Function to check connection status
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Function to get connection status string
const getConnectionStatus = () => {
  const states = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  };
  return states[mongoose.connection.readyState] || "Unknown";
};

// Graceful disconnect function
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB disconnected gracefully");
  } catch (err) {
    console.error("❌ Error disconnecting from MongoDB:", err.message);
  }
};

module.exports = { connectDB, isConnected, getConnectionStatus, disconnectDB };