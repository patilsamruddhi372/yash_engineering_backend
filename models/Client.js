// models/Client.js
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
      unique: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    address: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Address cannot exceed 500 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['Active', 'Inactive'],
        message: '{VALUE} is not a valid status'
      },
      default: 'Active'
    },
    since: {
      type: String,
      default: () => new Date().getFullYear().toString(),
      validate: {
        validator: function(v) {
          return /^\d{4}$/.test(v);
        },
        message: 'Please enter a valid year (YYYY format)'
      }
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      default: 5
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
clientSchema.index({ name: 'text' });
clientSchema.index({ status: 1 });
clientSchema.index({ createdAt: -1 });

// Virtual for client age (how long they've been a client)
clientSchema.virtual('clientAge').get(function() {
  const currentYear = new Date().getFullYear();
  const sinceYear = parseInt(this.since);
  return currentYear - sinceYear;
});

// Static method to get stats
clientSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalClients: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        activeClients: {
          $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
        },
        inactiveClients: {
          $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {
    totalClients: 0,
    averageRating: 0,
    activeClients: 0,
    inactiveClients: 0
  };
};

module.exports = mongoose.model('Client', clientSchema);