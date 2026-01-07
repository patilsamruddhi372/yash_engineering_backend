// config/gridfs.js
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

let brochureBucket;

/**
 * Initialize GridFS bucket for brochures.
 * Call this AFTER MongoDB is connected.
 */
function initGridFS() {
  const db = mongoose.connection.db;
  if (!db) {
    console.warn("⚠️  Cannot init GridFS: mongoose.connection.db is not ready yet");
    return;
  }

  brochureBucket = new GridFSBucket(db, {
    bucketName: "brochures", // will create brochures.files / brochures.chunks
  });

  console.log('📁 GridFS bucket "brochures" initialized');
}

/**
 * Get the brochure GridFS bucket.
 */
function getBrochureBucket() {
  if (!brochureBucket) {
    throw new Error("GridFS bucket not initialized. Call initGridFS() after DB connect.");
  }
  return brochureBucket;
}

module.exports = {
  initGridFS,
  getBrochureBucket,
};