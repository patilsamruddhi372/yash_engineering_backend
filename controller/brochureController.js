// controllers/brochureController.js
const Brochure = require('../models/Brochure');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

// ============================================
// Helper Functions
// ============================================

/**
 * Delete file from filesystem
 */
const deleteFile = async (filePath) => {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    console.log('✅ File deleted:', filePath);
    return true;
  } catch (error) {
    console.error('⚠️ Could not delete file:', error.message);
    return false;
  }
};

/**
 * Validate file type
 */
const isValidPDF = (mimetype) => {
  return mimetype === 'application/pdf';
};

/**
 * Format file size
 */
const formatFileSize = (bytes) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

// ============================================
// Controller Methods
// ============================================

/**
 * Upload and create new brochure
 * POST /api/brochure/upload
 */
exports.uploadBrochure = async (req, res) => {
  try {
    console.log('📤 Upload request received:', {
      file: req.file?.originalname,
      body: req.body
    });
    
    // File validation
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded. Please select a PDF file.' 
      });
    }

    // Validate file type
    if (!isValidPDF(req.file.mimetype)) {
      await deleteFile(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid file type. Only PDF files are allowed.' 
      });
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (req.file.size > maxSize) {
      await deleteFile(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: 'File size exceeds 20MB limit.' 
      });
    }

    const { 
      title, 
      description, 
      version = '1.0',
      category = 'general',
      tags = [],
      isActive = false 
    } = req.body;

    // Validation
    if (!title || title.trim() === '') {
      await deleteFile(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: 'Title is required' 
      });
    }

    // Check for duplicate title
    const existingBrochure = await Brochure.findOne({ 
      title: title.trim(),
      _id: { $ne: req.params.id } // Exclude current if updating
    });

    if (existingBrochure) {
      await deleteFile(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: 'A brochure with this title already exists' 
      });
    }

    // If this brochure is set as active, deactivate all others
    if (isActive === 'true' || isActive === true) {
      await Brochure.updateMany(
        { isActive: true }, 
        { isActive: false, updatedAt: Date.now() }
      );
      console.log('✅ Deactivated all other brochures');
    }

    // Prepare brochure data
    const brochureData = {
      title: title.trim(),
      description: description?.trim() || '',
      fileName: req.file.originalname,
      fileUrl: `/uploads/brochures/${req.file.filename}`,
      filePath: req.file.path,
      fileSize: req.file.size,
      formattedSize: formatFileSize(req.file.size),
      mimeType: req.file.mimetype,
      version: version || '1.0',
      category: category || 'general',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      isActive: isActive === 'true' || isActive === true,
      uploadedBy: req.user?._id || null,
      downloadCount: 0,
      lastDownloadAt: null
    };

    // Create and save brochure
    const brochure = new Brochure(brochureData);
    await brochure.save();

    console.log('✅ Brochure uploaded successfully:', brochure.title);

    res.status(201).json({
      success: true,
      message: 'Brochure uploaded successfully',
      data: brochure
    });
  } catch (error) {
    console.error('❌ Error uploading brochure:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      await deleteFile(req.file.path);
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to upload brochure',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get active brochure (PUBLIC)
 * GET /api/brochure/active
 */
exports.getActiveBrochure = async (req, res) => {
  try {
    const activeBrochure = await Brochure.findOne({ isActive: true })
      .select('-filePath -__v')
      .lean();
    
    if (!activeBrochure) {
      return res.status(404).json({ 
        success: false,
        message: 'No active brochure available at the moment' 
      });
    }

    // Track view (not download)
    await Brochure.findByIdAndUpdate(
      activeBrochure._id,
      { 
        $inc: { viewCount: 1 },
        lastViewedAt: Date.now()
      }
    );

    // Build complete URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    activeBrochure.fullUrl = `${baseUrl}${activeBrochure.fileUrl}`;

    res.status(200).json({
      success: true,
      data: activeBrochure
    });
  } catch (error) {
    console.error('Error fetching active brochure:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch active brochure',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get all brochures (ADMIN)
 * GET /api/brochure
 */
exports.getAllBrochures = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sort = '-createdAt',
      category,
      search,
      isActive
    } = req.query;

    // Build query
    const query = {};
    
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Execute query with pagination
    const brochures = await Brochure.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-filePath -__v')
      .populate('uploadedBy', 'name email')
      .lean();

    // Get total count
    const count = await Brochure.countDocuments(query);

    // Add full URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    brochures.forEach(brochure => {
      brochure.fullUrl = `${baseUrl}${brochure.fileUrl}`;
    });
    
    res.status(200).json({
      success: true,
      count: brochures.length,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: brochures
    });
  } catch (error) {
    console.error('Error fetching brochures:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch brochures',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get single brochure by ID
 * GET /api/brochure/:id
 */
exports.getBrochureById = async (req, res) => {
  try {
    const brochure = await Brochure.findById(req.params.id)
      .select('-filePath -__v')
      .populate('uploadedBy', 'name email')
      .lean();
    
    if (!brochure) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    // Add full URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    brochure.fullUrl = `${baseUrl}${brochure.fileUrl}`;

    res.status(200).json({
      success: true,
      data: brochure
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch brochure',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Update brochure metadata (not file)
 * PUT /api/brochure/:id
 */
exports.updateBrochure = async (req, res) => {
  try {
    const { title, description, version, category, tags } = req.body;

    const brochure = await Brochure.findById(req.params.id);
    
    if (!brochure) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    // Check for duplicate title
    if (title && title !== brochure.title) {
      const existing = await Brochure.findOne({ 
        title: title.trim(),
        _id: { $ne: req.params.id }
      });

      if (existing) {
        return res.status(400).json({ 
          success: false,
          message: 'A brochure with this title already exists' 
        });
      }
    }

    // Update fields
    if (title) brochure.title = title.trim();
    if (description !== undefined) brochure.description = description.trim();
    if (version) brochure.version = version;
    if (category) brochure.category = category;
    if (tags) {
      brochure.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    }

    brochure.updatedAt = Date.now();
    await brochure.save();

    res.status(200).json({
      success: true,
      message: 'Brochure updated successfully',
      data: brochure
    });
  } catch (error) {
    console.error('Error updating brochure:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update brochure',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Replace brochure file
 * POST /api/brochure/:id/replace
 */
exports.replaceBrochureFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    const brochure = await Brochure.findById(req.params.id);
    
    if (!brochure) {
      await deleteFile(req.file.path);
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    // Delete old file
    if (brochure.filePath) {
      await deleteFile(brochure.filePath);
    }

    // Update with new file info
    brochure.fileName = req.file.originalname;
    brochure.fileUrl = `/uploads/brochures/${req.file.filename}`;
    brochure.filePath = req.file.path;
    brochure.fileSize = req.file.size;
    brochure.formattedSize = formatFileSize(req.file.size);
    brochure.mimeType = req.file.mimetype;
    brochure.version = (parseFloat(brochure.version) + 0.1).toFixed(1);
    brochure.updatedAt = Date.now();

    await brochure.save();

    res.status(200).json({
      success: true,
      message: 'Brochure file replaced successfully',
      data: brochure
    });
  } catch (error) {
    console.error('Error replacing brochure file:', error);
    if (req.file && req.file.path) {
      await deleteFile(req.file.path);
    }
    res.status(500).json({ 
      success: false,
      message: 'Failed to replace brochure file',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Activate a brochure
 * PATCH /api/brochure/:id/activate
 */
exports.activateBrochure = async (req, res) => {
  try {
    // Deactivate all brochures
    await Brochure.updateMany(
      { isActive: true }, 
      { isActive: false, updatedAt: Date.now() }
    );

    // Activate the selected brochure
    const brochure = await Brochure.findByIdAndUpdate(
      req.params.id,
      { 
        isActive: true, 
        updatedAt: Date.now(),
        activatedAt: Date.now()
      },
      { new: true }
    ).select('-filePath -__v');

    if (!brochure) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    console.log('✅ Brochure activated:', brochure.title);

    res.status(200).json({
      success: true,
      message: 'Brochure activated successfully',
      data: brochure
    });
  } catch (error) {
    console.error('Error activating brochure:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to activate brochure',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Deactivate a brochure
 * PATCH /api/brochure/:id/deactivate
 */
exports.deactivateBrochure = async (req, res) => {
  try {
    const brochure = await Brochure.findByIdAndUpdate(
      req.params.id,
      { 
        isActive: false, 
        updatedAt: Date.now(),
        deactivatedAt: Date.now()
      },
      { new: true }
    ).select('-filePath -__v');

    if (!brochure) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    console.log('⏸️ Brochure deactivated:', brochure.title);

    res.status(200).json({
      success: true,
      message: 'Brochure deactivated successfully',
      data: brochure
    });
  } catch (error) {
    console.error('Error deactivating brochure:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to deactivate brochure',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Download brochure and track
 * GET /api/brochure/:id/download
 */
exports.downloadBrochure = async (req, res) => {
  try {
    const brochure = await Brochure.findById(req.params.id);
    
    if (!brochure) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    // Check if file exists
    try {
      await fs.access(brochure.filePath);
    } catch (error) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure file not found on server' 
      });
    }

    // Track download
    await Brochure.findByIdAndUpdate(
      req.params.id,
      { 
        $inc: { downloadCount: 1 },
        lastDownloadAt: Date.now()
      }
    );

    console.log(`📥 Brochure downloaded: ${brochure.title} (Total: ${brochure.downloadCount + 1})`);

    // Set headers for download
    res.setHeader('Content-Type', brochure.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${brochure.fileName}"`);
    res.setHeader('Content-Length', brochure.fileSize);

    // Send file
    res.sendFile(path.resolve(brochure.filePath));
  } catch (error) {
    console.error('Error downloading brochure:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to download brochure',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Track download without serving file
 * PATCH /api/brochure/:id/track-download
 */
exports.trackDownload = async (req, res) => {
  try {
    const brochure = await Brochure.findByIdAndUpdate(
      req.params.id,
      { 
        $inc: { downloadCount: 1 },
        lastDownloadAt: Date.now()
      },
      { new: true }
    ).select('title downloadCount');

    if (!brochure) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    console.log(`📊 Download tracked: ${brochure.title} (Total: ${brochure.downloadCount})`);

    res.status(200).json({
      success: true,
      message: 'Download tracked',
      data: {
        title: brochure.title,
        downloadCount: brochure.downloadCount
      }
    });
  } catch (error) {
    console.error('Error tracking download:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to track download'
    });
  }
};

/**
 * Delete brochure
 * DELETE /api/brochure/:id
 */
exports.deleteBrochure = async (req, res) => {
  try {
    const brochure = await Brochure.findById(req.params.id);

    if (!brochure) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    // Delete file from filesystem
    if (brochure.filePath) {
      await deleteFile(brochure.filePath);
    }

    // Delete from database
    await brochure.deleteOne();

    console.log('🗑️ Brochure deleted:', brochure.title);

    res.status(200).json({
      success: true,
      message: 'Brochure deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting brochure:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete brochure',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Bulk delete brochures
 * POST /api/brochure/bulk-delete
 */
exports.bulkDeleteBrochures = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No brochure IDs provided' 
      });
    }

    // Get brochures to delete files
    const brochures = await Brochure.find({ _id: { $in: ids } });
    
    // Delete files
    for (const brochure of brochures) {
      if (brochure.filePath) {
        await deleteFile(brochure.filePath);
      }
    }

    // Delete from database
    const result = await Brochure.deleteMany({ _id: { $in: ids } });

    console.log(`🗑️ Bulk deleted ${result.deletedCount} brochures`);

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} brochures deleted successfully`,
      data: {
        requested: ids.length,
        deleted: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Error bulk deleting brochures:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete brochures',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get brochure statistics
 * GET /api/brochure/stats
 */
exports.getBrochureStats = async (req, res) => {
  try {
    const [
      totalBrochures,
      activeBrochures,
      totalDownloads,
      totalViews,
      categories,
      recentBrochures
    ] = await Promise.all([
      Brochure.countDocuments(),
      Brochure.countDocuments({ isActive: true }),
      Brochure.aggregate([
        { $group: { _id: null, total: { $sum: '$downloadCount' } } }
      ]),
      Brochure.aggregate([
        { $group: { _id: null, total: { $sum: '$viewCount' } } }
      ]),
      Brochure.distinct('category'),
      Brochure.find()
        .sort('-createdAt')
        .limit(5)
        .select('title createdAt downloadCount')
    ]);

    const stats = {
      totalBrochures,
      activeBrochures,
      totalDownloads: totalDownloads[0]?.total || 0,
      totalViews: totalViews[0]?.total || 0,
      totalCategories: categories.length,
      categories,
      recentBrochures
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching brochure stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Search brochures
 * GET /api/brochure/search
 */
exports.searchBrochures = async (req, res) => {
  try {
    const { q, category, tag, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ 
        success: false,
        message: 'Search query is required' 
      });
    }

    const query = {
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };

    if (category) query.category = category;
    if (tag) query.tags = tag;

    const brochures = await Brochure.find(query)
      .limit(parseInt(limit))
      .select('title description category tags fileUrl')
      .sort('-downloadCount');

    res.status(200).json({
      success: true,
      count: brochures.length,
      data: brochures
    });
  } catch (error) {
    console.error('Error searching brochures:', error);
    res.status(500).json({ 
      success: false,
      message: 'Search failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};