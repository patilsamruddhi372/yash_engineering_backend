const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Service title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  desc: {
    type: String,
    required: [true, 'Description is required'],
    alias: 'description',
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['Active', 'Inactive', 'Featured', 'Pending'],
      message: '{VALUE} is not a valid status'
    },
    default: 'Active'
  },
  duration: {
    type: String,
    default: '2-4 hours',
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  image: {
    type: String,
    default: null
  },
  category: {
    type: String,
    enum: ['Repair', 'Maintenance', 'Installation', 'Consultation', 'Other'],
    default: 'Other'
  },
  featured: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Virtual for description (alias)
serviceSchema.virtual('description').get(function() {
  return this.desc;
});

// Index for search
serviceSchema.index({ title: 'text', desc: 'text' });

// Auto-set featured based on status
serviceSchema.pre('save', function(next) {
  if (this.status === 'Featured') {
    this.featured = true;
  }
  next();
});

module.exports = mongoose.model('Service', serviceSchema);