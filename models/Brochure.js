// models/Brochure.js
const mongoose = require('mongoose');

const brochureSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  fileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  formattedSize: String,
  mimeType: {
    type: String,
    required: true
  },
  version: {
    type: String,
    default: '1.0'
  },
  category: {
    type: String,
    default: 'general',
    enum: ['general', 'technical', 'marketing', 'product', 'service', 'other']
  },
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: false
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lastDownloadAt: Date,
  lastViewedAt: Date,
  activatedAt: Date,
  deactivatedAt: Date,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better performance
brochureSchema.index({ title: 'text', description: 'text' });
brochureSchema.index({ category: 1, isActive: 1 });
brochureSchema.index({ tags: 1 });
brochureSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Brochure', brochureSchema);