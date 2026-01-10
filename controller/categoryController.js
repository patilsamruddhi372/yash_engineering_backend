const Category = require('../models/Category');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// Get all categories
const getCategories = async (req, res) => {
  try {
    const { type = 'product' } = req.query;
    const categories = await Category.getAllForType(type);
    
    // Get usage counts for more accurate data
    const stats = await Category.getStats(type);
    
    res.json({
      success: true,
      count: categories.length,
      stats: stats,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch categories' 
    });
  }
};

// Get category by ID
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid category ID' 
      });
    }
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch category' 
    });
  }
};

// Create category
const createCategory = async (req, res) => {
  try {
    const { name, type = 'product', description, imageUrl } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category name is required' 
      });
    }
    
    // Check if category already exists (case insensitive)
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      type
    });
    
    if (existingCategory) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category already exists' 
      });
    }
    
    const category = new Category({
      name: name.trim(),
      type,
      description: description || '',
      imageUrl: imageUrl || null,
      createdBy: req.body.createdBy || 'api'
    });
    
    const savedCategory = await category.save();
    console.log(`✅ Category created: ${savedCategory.name} (${savedCategory._id})`);
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: savedCategory
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to create category' 
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid category ID' 
      });
    }
    
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category name is required' 
      });
    }
    
    // Find the current category to get its original name
    const currentCategory = await Category.findById(id);
    if (!currentCategory) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }
    
    const oldName = currentCategory.name;
    const newName = name.trim();
    
    // Check if the new name already exists (excluding current category)
    if (oldName.toLowerCase() !== newName.toLowerCase()) {
      const existingCategory = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${newName}$`, 'i') },
        type: currentCategory.type
      });
      
      if (existingCategory) {
        return res.status(400).json({ 
          success: false, 
          message: 'Category name already exists' 
        });
      }
    }
    
    // Update the category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { 
        name: newName,
        description: description || currentCategory.description,
        imageUrl: imageUrl || currentCategory.imageUrl
      },
      { new: true, runValidators: true }
    );
    
    // Update all products that use this category
    if (oldName !== newName) {
      const updateResult = await Product.updateMany(
        { category: oldName },
        { $set: { category: newName } }
      );
      
      console.log(`✅ Updated ${updateResult.modifiedCount} products with new category name`);
    }
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to update category' 
    });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid category ID' 
      });
    }
    
    // Find the category to get its name
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }
    
    // Check if category is in use
    const productsCount = await Product.countDocuments({ category: category.name });
    
    if (productsCount > 0) {
      // Update all products with this category to "Uncategorized"
      await Product.updateMany(
        { category: category.name },
        { $set: { category: 'Uncategorized' } }
      );
      
      console.log(`✅ Updated ${productsCount} products to Uncategorized`);
    }
    
    // Delete the category
    await Category.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Category deleted successfully',
      info: {
        name: category.name,
        productsUpdated: productsCount
      }
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to delete category' 
    });
  }
};

// Get category usage stats
const getCategoryUsage = async (req, res) => {
  try {
    const { type = 'product' } = req.query;
    
    // Get category usage from products
    const productCategories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }
    ]);
    
    // Get all categories from Category collection
    const allCategories = await Category.getAllForType(type);
    
    // Merge the data
    const usage = allCategories.map(cat => {
      const found = productCategories.find(pc => pc._id === cat.name);
      return {
        _id: cat._id,
        name: cat.name,
        count: found ? found.count : 0,
        usageCount: cat.usageCount
      };
    });
    
    // Add uncategorized if it exists
    const uncategorized = productCategories.find(pc => pc._id === 'Uncategorized');
    if (uncategorized) {
      usage.push({
        _id: 'system-uncategorized',
        name: 'Uncategorized',
        count: uncategorized.count,
        usageCount: uncategorized.count
      });
    }
    
    res.json({
      success: true,
      count: usage.length,
      data: usage
    });
  } catch (error) {
    console.error('Get category usage error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to get category usage stats' 
    });
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryUsage
};