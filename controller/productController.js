const Product = require('../models/Product');
// const Category = require('../models/Category');
const mongoose = require('mongoose');

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════
const isValidId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const handleError = (res, error, defaultMessage = 'Server error') => {
  console.error('❌ Error:', error);
  
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(e => e.message);
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed',
      errors 
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid ID format' 
    });
  }

  if (error.code === 11000) {
    return res.status(400).json({ 
      success: false, 
      message: 'Duplicate key error - SKU already exists' 
    });
  }

  res.status(500).json({ 
    success: false, 
    message: error.message || defaultMessage 
  });
};

// ═══════════════════════════════════════════════════════════
// GET ALL PRODUCTS (with advanced filtering)
// ═══════════════════════════════════════════════════════════
const getProducts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      category, 
      status,
      featured,
      certified,
      popular,
      search,
      sortBy = 'createdAt',
      order = 'desc' 
    } = req.query;

    // Build filter
    const filter = {};
    
    if (category && category !== 'all') filter.category = category;
    if (status) filter.status = status;
    if (featured !== undefined) filter.featured = featured === 'true';
    if (certified !== undefined) filter.certified = certified === 'true';
    if (popular !== undefined) filter.popular = popular === 'true';
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'desc' ? -1 : 1;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter)
    ]);

    console.log(`✅ Found ${products.length} products (total: ${total})`);

    res.json({
      success: true,
      count: products.length,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch products');
  }
};

// ═══════════════════════════════════════════════════════════
// GET SINGLE PRODUCT BY ID
// ═══════════════════════════════════════════════════════════
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product ID' 
      });
    }

    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Increment views
    await product.incrementViews();

    res.json({ 
      success: true, 
      data: product 
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch product');
  }
};

// ═══════════════════════════════════════════════════════════
// CREATE NEW PRODUCT
// ═══════════════════════════════════════════════════════════
const createProduct = async (req, res) => {
  try {
    console.log('📦 Creating product:', req.body);

    const productData = {
      name: req.body.name?.trim(),
      description: req.body.description?.trim(),
      category: req.body.category || 'Uncategorized',
      price: parseFloat(req.body.price) || 0,
      imageUrl: req.body.imageUrl?.trim() || null,
      status: req.body.status || 'Active',
      stock: parseInt(req.body.stock) || 0,
      featured: Boolean(req.body.featured),
      certified: Boolean(req.body.certified),
      popular: Boolean(req.body.popular),
      custom: Boolean(req.body.custom),
      features: Array.isArray(req.body.features) ? req.body.features : [],
      sku: req.body.sku?.trim().toUpperCase() || undefined,
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      manufacturer: req.body.manufacturer?.trim() || undefined,
      warranty: req.body.warranty?.trim() || undefined
    };

    const product = new Product(productData);
    const savedProduct = await product.save();

    console.log('✅ Product created:', savedProduct._id);

    res.status(201).json({ 
      success: true, 
      message: 'Product created successfully',
      data: savedProduct 
    });
  } catch (error) {
    handleError(res, error, 'Failed to create product');
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE PRODUCT (PUT - Full Update)
// ═══════════════════════════════════════════════════════════
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📝 Updating product:', id);

    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product ID' 
      });
    }

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    const updateData = {
      name: req.body.name?.trim(),
      description: req.body.description?.trim(),
      category: req.body.category || 'Uncategorized',
      price: parseFloat(req.body.price) || 0,
      imageUrl: req.body.imageUrl?.trim() || null,
      status: req.body.status || 'Active',
      stock: parseInt(req.body.stock) || 0,
      featured: Boolean(req.body.featured),
      certified: Boolean(req.body.certified),
      popular: Boolean(req.body.popular),
      custom: Boolean(req.body.custom),
      features: Array.isArray(req.body.features) ? req.body.features : [],
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      manufacturer: req.body.manufacturer?.trim() || undefined,
      warranty: req.body.warranty?.trim() || undefined
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('✅ Product updated:', updatedProduct._id);

    res.json({ 
      success: true, 
      message: 'Product updated successfully',
      data: updatedProduct 
    });
  } catch (error) {
    handleError(res, error, 'Failed to update product');
  }
};

// ═══════════════════════════════════════════════════════════
// PARTIAL UPDATE (PATCH)
// ═══════════════════════════════════════════════════════════
const patchProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product ID' 
      });
    }

    const allowedFields = [
      'name', 'description', 'category', 'price', 'imageUrl', 
      'status', 'stock', 'featured', 'certified', 'popular', 
      'custom', 'features', 'tags', 'sku', 'manufacturer', 'warranty'
    ];
    
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Product updated',
      data: product 
    });
  } catch (error) {
    handleError(res, error, 'Failed to patch product');
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE PRODUCT
// ═══════════════════════════════════════════════════════════
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting product:', id);

    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product ID' 
      });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    console.log('✅ Product deleted:', id);

    res.json({ 
      success: true, 
      message: 'Product deleted successfully',
      data: { id }
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete product');
  }
};

// ═══════════════════════════════════════════════════════════
// TOGGLE STATUS
// ═══════════════════════════════════════════════════════════
const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    product.status = product.status === 'Active' ? 'Inactive' : 'Active';
    await product.save();

    console.log(`✅ Product status toggled: ${product.name} -> ${product.status}`);

    res.json({ 
      success: true, 
      message: `Product status changed to ${product.status}`,
      data: product 
    });
  } catch (error) {
    handleError(res, error, 'Failed to toggle status');
  }
};

// ═══════════════════════════════════════════════════════════
// TOGGLE FEATURED
// ═══════════════════════════════════════════════════════════
const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    await product.toggleFeatured();

    console.log(`✅ Product featured toggled: ${product.name} -> ${product.featured}`);

    res.json({ 
      success: true, 
      message: product.featured ? 'Product featured' : 'Product unfeatured',
      data: product 
    });
  } catch (error) {
    handleError(res, error, 'Failed to toggle featured');
  }
};

// ═══════════════════════════════════════════════════════════
// TOGGLE CERTIFIED
// ═══════════════════════════════════════════════════════════
const toggleCertified = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    await product.toggleCertified();

    console.log(`✅ Product certified toggled: ${product.name} -> ${product.certified}`);

    res.json({ 
      success: true, 
      message: product.certified ? 'Product certified' : 'Product uncertified',
      data: product 
    });
  } catch (error) {
    handleError(res, error, 'Failed to toggle certified');
  }
};

// ═══════════════════════════════════════════════════════════
// TOGGLE POPULAR
// ═══════════════════════════════════════════════════════════
const togglePopular = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    await product.togglePopular();

    console.log(`✅ Product popular toggled: ${product.name} -> ${product.popular}`);

    res.json({ 
      success: true, 
      message: product.popular ? 'Product marked as popular' : 'Product unmarked as popular',
      data: product 
    });
  } catch (error) {
    handleError(res, error, 'Failed to toggle popular');
  }
};

// ═══════════════════════════════════════════════════════════
// BULK UPDATE
// ═══════════════════════════════════════════════════════════
const bulkUpdate = async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product IDs' 
      });
    }

    const result = await Product.updateMany(
      { _id: { $in: ids } },
      { $set: updates }
    );

    console.log(`✅ Bulk update: ${result.modifiedCount} products updated`);

    res.json({ 
      success: true, 
      message: `${result.modifiedCount} products updated`,
      data: result 
    });
  } catch (error) {
    handleError(res, error, 'Failed to bulk update');
  }
};

// ═══════════════════════════════════════════════════════════
// BULK DELETE
// ═══════════════════════════════════════════════════════════
const bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product IDs array is required' 
      });
    }

    const result = await Product.deleteMany({ _id: { $in: ids } });

    console.log(`✅ Bulk delete: ${result.deletedCount} products deleted`);

    res.json({ 
      success: true, 
      message: `Successfully deleted ${result.deletedCount} products`,
      data: result 
    });
  } catch (error) {
    handleError(res, error, 'Failed to bulk delete');
  }
};

// ═══════════════════════════════════════════════════════════
// GET PRODUCTS BY CATEGORY
// ═══════════════════════════════════════════════════════════
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const products = await Product.findByCategory(category);

    res.json({
      success: true,
      count: products.length,
      category,
      data: products
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch products by category');
  }
};

// ═══════════════════════════════════════════════════════════
// GET FEATURED PRODUCTS
// ═══════════════════════════════════════════════════════════
const getFeaturedProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await Product.getFeatured(limit);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch featured products');
  }
};

// ═══════════════════════════════════════════════════════════
// GET POPULAR PRODUCTS
// ═══════════════════════════════════════════════════════════
const getPopularProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await Product.getPopular(limit);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch popular products');
  }
};

// ═══════════════════════════════════════════════════════════
// GET CERTIFIED PRODUCTS
// ═══════════════════════════════════════════════════════════
const getCertifiedProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await Product.getCertified(limit);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch certified products');
  }
};

// ═══════════════════════════════════════════════════════════
// GET TRENDING PRODUCTS
// ═══════════════════════════════════════════════════════════
const getTrendingProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 30;
    const products = await Product.getTrending(limit, days);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch trending products');
  }
};

// ═══════════════════════════════════════════════════════════
// GET RECENT PRODUCTS
// ═══════════════════════════════════════════════════════════
const getRecentProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await Product.getRecent(limit);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch recent products');
  }
};

// ═══════════════════════════════════════════════════════════
// SEARCH PRODUCTS
// ═══════════════════════════════════════════════════════════
const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const products = await Product.search(q);

    res.json({
      success: true,
      count: products.length,
      query: q,
      data: products
    });
  } catch (error) {
    handleError(res, error, 'Failed to search products');
  }
};

// ═══════════════════════════════════════════════════════════
// GET CATEGORY STATISTICS
// ═══════════════════════════════════════════════════════════
const getCategoryStats = async (req, res) => {
  try {
    const stats = await Product.getCategoryStats();

    res.json({
      success: true,
      count: stats.length,
      data: stats
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch category statistics');
  }
};

// ═══════════════════════════════════════════════════════════
// GET PRODUCT CATEGORIES LIST
// ═══════════════════════════════════════════════════════════
const getProductCategories = async (req, res) => {
  try {
    // Get categories from Category model
    const dbCategories = await Category.find({ type: 'product' })
      .sort({ usageCount: -1, name: 1 });

    // Get unique categories from products
    const productCategories = await Product.getUniqueCategories();

    // Combine both
    const allCategories = [
      ...new Set([
        ...dbCategories.map(c => c.name),
        ...productCategories
      ])
    ].sort();

    res.json({
      success: true,
      count: allCategories.length,
      data: {
        all: allCategories,
        database: dbCategories,
        inUse: productCategories
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch categories');
  }
};

// ═══════════════════════════════════════════════════════════
// INCREMENT VIEWS
// ═══════════════════════════════════════════════════════════
const incrementViews = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.incrementViews();

    res.json({
      success: true,
      message: 'Views incremented',
      views: product.views
    });
  } catch (error) {
    handleError(res, error, 'Failed to increment views');
  }
};

// ═══════════════════════════════════════════════════════════
// INCREMENT DOWNLOADS
// ═══════════════════════════════════════════════════════════
const incrementDownloads = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.incrementDownloads();

    res.json({
      success: true,
      message: 'Downloads incremented',
      downloads: product.downloads
    });
  } catch (error) {
    handleError(res, error, 'Failed to increment downloads');
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE RATING
// ═══════════════════════════════════════════════════════════
const updateRating = async (req, res) => {
  try {
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.updateRating(rating);

    res.json({
      success: true,
      message: 'Rating updated',
      rating: product.rating,
      reviewCount: product.reviewCount
    });
  } catch (error) {
    handleError(res, error, 'Failed to update rating');
  }
};

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════
module.exports = {
  // Base CRUD
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  patchProduct,
  deleteProduct,
  
  // Toggle actions
  toggleStatus,
  toggleFeatured,
  toggleCertified,
  togglePopular,
  
  // Bulk operations
  bulkUpdate,
  bulkDelete,
  
  // Filtered lists
  getProductsByCategory,
  getFeaturedProducts,
  getPopularProducts,
  getCertifiedProducts,
  getTrendingProducts,
  getRecentProducts,
  
  // Search & Stats
  searchProducts,
  getCategoryStats,
  getProductCategories,
  
  // Analytics
  incrementViews,
  incrementDownloads,
  updateRating
};