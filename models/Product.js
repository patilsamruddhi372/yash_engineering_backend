const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  // ✅ UPDATED: Category now accepts any string, no enum restriction
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    default: 'Uncategorized'
  },
  status: {
    type: String,
    enum: {
      values: ['Active', 'Inactive'],
      message: '{VALUE} is not a valid status. Must be either Active or Inactive'
    },
    default: 'Active'
  },
  imageUrl: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null/empty
        // Allow base64 images or URLs
        return v.startsWith('data:image') || v.startsWith('http://') || v.startsWith('https://');
      },
      message: 'Invalid image format. Must be a base64 string or valid URL'
    }
  },
  featured: {
    type: Boolean,
    default: false
  },
  certified: {
    type: Boolean,
    default: false
  },
  popular: {
    type: Boolean,
    default: false
  },
  custom: {
    type: Boolean,
    default: false
  },
  // ✅ ADDED: Features array for product highlights
  features: [{
    type: String,
    trim: true
  }],
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative']
  },
  specifications: {
    type: Map,
    of: String,
    default: {}
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  },
  sku: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true,
    uppercase: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  manufacturer: {
    type: String,
    trim: true
  },
  warranty: {
    type: String,
    trim: true
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['mm', 'cm', 'inch'],
      default: 'mm'
    }
  },
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['kg', 'g', 'lb'],
      default: 'kg'
    }
  },
  // ✅ ADDED: Additional metadata
  downloads: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ===== INDEXES for Performance =====
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ featured: 1, status: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ popular: 1 });
productSchema.index({ certified: 1 });

// ===== VIRTUALS =====
// Check if product is in stock
productSchema.virtual('inStock').get(function() {
  return this.stock > 0;
});

// Get category icon
productSchema.virtual('categoryIcon').get(function() {
  const icons = {
    'Power Distribution Panels': '⚡',
    'Motor Control & Protection': '🔧',
    'Automation & Control': '🤖',
    'Power Quality & Energy Saving': '💡',
    'Generator & Power Backup': '🔋',
    'Marketing / Customer Resources': '📄',
    'Uncategorized': '📦'
  };
  return icons[this.category] || '📦';
});

// Get product badge type
productSchema.virtual('badgeType').get(function() {
  if (this.featured) return 'featured';
  if (this.popular) return 'popular';
  if (this.certified) return 'certified';
  if (this.custom) return 'custom';
  return null;
});

// ===== MIDDLEWARE =====

// ✅ UPDATED: Save category to database when product is created/updated
productSchema.post('save', async function(doc) {
  try {
    const Category = mongoose.model('Category');
    
    if (doc.category && doc.category !== 'Uncategorized') {
      // Check if category exists, create if not, increment usage count
      await Category.findOneAndUpdate(
        { name: doc.category, type: 'product' },
        { 
          $inc: { usageCount: 1 },
          $setOnInsert: { 
            name: doc.category, 
            type: 'product',
            createdBy: 'product-system'
          }
        },
        { upsert: true, new: true }
      );
      
      console.log(`✅ Category "${doc.category}" saved to database for product: ${doc.name}`);
    }
  } catch (error) {
    console.error('❌ Error saving category to database:', error);
    // Don't throw error to prevent product save from failing
  }
});

// ✅ UPDATED: Decrement category usage when product category changes
productSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const update = this.getUpdate();
    
    // Check if category is being updated
    if (update.$set && update.$set.category) {
      const docToUpdate = await this.model.findOne(this.getQuery());
      
      if (docToUpdate && docToUpdate.category !== update.$set.category) {
        const Category = mongoose.model('Category');
        
        // Decrement old category usage
        if (docToUpdate.category && docToUpdate.category !== 'Uncategorized') {
          await Category.findOneAndUpdate(
            { name: docToUpdate.category, type: 'product' },
            { $inc: { usageCount: -1 } }
          );
        }
        
        // Increment new category usage
        if (update.$set.category && update.$set.category !== 'Uncategorized') {
          await Category.findOneAndUpdate(
            { name: update.$set.category, type: 'product' },
            { 
              $inc: { usageCount: 1 },
              $setOnInsert: { 
                name: update.$set.category, 
                type: 'product',
                createdBy: 'product-system'
              }
            },
            { upsert: true }
          );
        }
      }
    }
  } catch (error) {
    console.error('❌ Error updating category usage:', error);
  }
  next();
});

// ✅ UPDATED: Decrement category usage when product is deleted
productSchema.post('findOneAndDelete', async function(doc) {
  try {
    if (doc && doc.category && doc.category !== 'Uncategorized') {
      const Category = mongoose.model('Category');
      
      await Category.findOneAndUpdate(
        { name: doc.category, type: 'product' },
        { $inc: { usageCount: -1 } }
      );
      
      console.log(`✅ Category usage decremented for: ${doc.category}`);
    }
  } catch (error) {
    console.error('❌ Error decrementing category usage:', error);
  }
});

// Auto-generate SKU before saving if not provided
productSchema.pre('save', function(next) {
  if (!this.sku && this.isNew) {
    // Generate SKU based on category
    const categoryPrefixes = {
      'Power Distribution Panels': 'PDP',
      'Motor Control & Protection': 'MCP',
      'Automation & Control': 'ATC',
      'Power Quality & Energy Saving': 'PQE',
      'Generator & Power Backup': 'GPB',
      'Marketing / Customer Resources': 'MKT',
      'Uncategorized': 'PRD'
    };
    
    const prefix = categoryPrefixes[this.category] || 'PRD';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.sku = `${prefix}-${timestamp}-${random}`;
  }
  next();
});

// Update timestamps on save
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ===== INSTANCE METHODS =====

// Check if product can be deleted
productSchema.methods.canBeDeleted = function() {
  // Example: Allow all deletions
  // You can add custom business logic here
  return true;
};

// Toggle featured status
productSchema.methods.toggleFeatured = function() {
  this.featured = !this.featured;
  return this.save();
};

// Toggle certified status
productSchema.methods.toggleCertified = function() {
  this.certified = !this.certified;
  return this.save();
};

// Toggle popular status
productSchema.methods.togglePopular = function() {
  this.popular = !this.popular;
  return this.save();
};

// Update stock
productSchema.methods.updateStock = function(quantity) {
  this.stock += quantity;
  if (this.stock < 0) this.stock = 0;
  return this.save();
};

// Increment views
productSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Increment downloads
productSchema.methods.incrementDownloads = function() {
  this.downloads += 1;
  return this.save();
};

// Update rating
productSchema.methods.updateRating = function(newRating) {
  const totalRating = this.rating * this.reviewCount;
  this.reviewCount += 1;
  this.rating = (totalRating + newRating) / this.reviewCount;
  return this.save();
};

// ===== STATIC METHODS =====

// Find products by category
productSchema.statics.findByCategory = function(category) {
  return this.find({ 
    category, 
    status: 'Active' 
  }).sort({ createdAt: -1 });
};

// Get all featured products
productSchema.statics.getFeatured = function(limit = 10) {
  return this.find({ 
    featured: true, 
    status: 'Active' 
  })
  .limit(limit)
  .sort({ createdAt: -1 });
};

// Get all popular products
productSchema.statics.getPopular = function(limit = 10) {
  return this.find({ 
    popular: true, 
    status: 'Active' 
  })
  .limit(limit)
  .sort({ views: -1 });
};

// Get all certified products
productSchema.statics.getCertified = function(limit = 10) {
  return this.find({ 
    certified: true, 
    status: 'Active' 
  })
  .limit(limit)
  .sort({ createdAt: -1 });
};

// Search products
productSchema.statics.search = function(query) {
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
  .sort({ score: { $meta: 'textScore' } });
};

// Get products by status
productSchema.statics.getByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Get low stock products
productSchema.statics.getLowStock = function(threshold = 10) {
  return this.find({ 
    stock: { $lte: threshold },
    status: 'Active'
  }).sort({ stock: 1 });
};

// ✅ UPDATED: Get category statistics with dynamic categories
productSchema.statics.getCategoryStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        activeCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
        },
        inactiveCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] }
        },
        featuredCount: {
          $sum: { $cond: ['$featured', 1, 0] }
        },
        certifiedCount: {
          $sum: { $cond: ['$certified', 1, 0] }
        },
        popularCount: {
          $sum: { $cond: ['$popular', 1, 0] }
        },
        totalStock: { $sum: '$stock' },
        totalViews: { $sum: '$views' },
        totalDownloads: { $sum: '$downloads' },
        avgRating: { $avg: '$rating' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  return stats;
};

// ✅ NEW: Get all unique categories used in products
productSchema.statics.getUniqueCategories = async function() {
  const categories = await this.distinct('category', { status: 'Active' });
  return categories.filter(cat => cat && cat !== 'Uncategorized').sort();
};

// ✅ NEW: Get products with filters
productSchema.statics.getFiltered = function(filters = {}) {
  const query = { status: 'Active' };
  
  if (filters.category && filters.category !== 'all') {
    query.category = filters.category;
  }
  
  if (filters.featured) {
    query.featured = true;
  }
  
  if (filters.certified) {
    query.certified = true;
  }
  
  if (filters.popular) {
    query.popular = true;
  }
  
  if (filters.search) {
    query.$text = { $search: filters.search };
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// ✅ NEW: Get trending products (most views/downloads)
productSchema.statics.getTrending = function(limit = 10, days = 30) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  return this.find({
    status: 'Active',
    createdAt: { $gte: dateThreshold }
  })
  .sort({ views: -1, downloads: -1 })
  .limit(limit);
};

// ✅ NEW: Get recently added products
productSchema.statics.getRecent = function(limit = 10) {
  return this.find({ status: 'Active' })
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Product', productSchema);