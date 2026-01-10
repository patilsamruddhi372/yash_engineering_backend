const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['product', 'gallery', 'service', 'other'],
    default: 'product'
  },
  description: {
    type: String,
    trim: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  imageUrl: {
    type: String,
    default: null
  },
  createdBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

// Static methods for category stats
categorySchema.statics.getStats = async function(type = 'product') {
  const stats = await this.aggregate([
    { $match: { type: type } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        used: { $sum: { $cond: [{ $gt: ['$usageCount', 0] }, 1, 0] } },
        unused: { $sum: { $cond: [{ $eq: ['$usageCount', 0] }, 1, 0] } },
        totalUsage: { $sum: '$usageCount' }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : { total: 0, used: 0, unused: 0, totalUsage: 0 };
};

// Get all categories for a specific type
categorySchema.statics.getAllForType = function(type = 'product') {
  return this.find({ type }).sort({ usageCount: -1, name: 1 });
};

module.exports = mongoose.model('Category', categorySchema);