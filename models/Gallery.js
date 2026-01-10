const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  url: {
    type: String,
    required: [true, 'Image URL is required']
  },
  category: {
    type: String,
    default: 'Uncategorized'
  },
  description: {
    type: String,
    default: ''
  },
  alt: {
    type: String,
    default: ''
  },
  // Adding new fields for better image management
  fileName: {
    type: String,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  fileType: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Gallery', gallerySchema);