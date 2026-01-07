const Brochure = require('../models/Brochure');
const fs = require('fs').promises;
const path = require('path');

/**
 * Upload and create new brochure
 * POST /api/brochure/upload
 */
exports.uploadBrochure = async (req, res) => {
  try {
    console.log('📤 Upload request received');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded. Please select a file.' 
      });
    }

    const { title, description, isActive } = req.body;

    // Validation
    if (!title || title.trim() === '') {
      // Delete uploaded file if validation fails
      if (req.file && req.file.path) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      return res.status(400).json({ 
        success: false,
        message: 'Title is required' 
      });
    }

    // If this brochure is set as active, deactivate all others
    if (isActive === 'true' || isActive === true) {
      await Brochure.updateMany({}, { isActive: false });
    }

    // Create brochure record
    const brochureData = {
      title: title.trim(),
      description: description || '',
      fileName: req.file.originalname,
      fileUrl: `/uploads/brochures/${req.file.filename}`,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      isActive: isActive === 'true' || isActive === true
    };

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
    
    // Delete uploaded file if database save fails
    if (req.file && req.file.path) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to upload brochure',
      error: error.message 
    });
  }
};

/**
 * Get active brochure
 * GET /api/brochure/active
 */
exports.getActiveBrochure = async (req, res) => {
  try {
    const activeBrochure = await Brochure.findOne({ isActive: true })
      .select('-filePath -__v');
    
    if (!activeBrochure) {
      return res.status(404).json({ 
        success: false,
        message: 'No active brochure found' 
      });
    }

    // Increment download count (for tracking)
    await Brochure.findByIdAndUpdate(
      activeBrochure._id,
      { $inc: { downloadCount: 1 } }
    );

    res.status(200).json({
      success: true,
      data: activeBrochure
    });
  } catch (error) {
    console.error('Error fetching active brochure:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch active brochure',
      error: error.message 
    });
  }
};

/**
 * Get all brochures
 * GET /api/brochure
 */
exports.getAllBrochures = async (req, res) => {
  try {
    const brochures = await Brochure.find()
      .sort({ createdAt: -1 })
      .select('-filePath -__v');
    
    res.status(200).json({
      success: true,
      count: brochures.length,
      data: brochures
    });
  } catch (error) {
    console.error('Error fetching brochures:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch brochures',
      error: error.message 
    });
  }
};

/**
 * Get single brochure
 * GET /api/brochure/:id
 */
exports.getBrochureById = async (req, res) => {
  try {
    const brochure = await Brochure.findById(req.params.id)
      .select('-filePath -__v');
    
    if (!brochure) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: brochure
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch brochure',
      error: error.message 
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
    await Brochure.updateMany({}, { isActive: false });

    // Activate the selected brochure
    const brochure = await Brochure.findByIdAndUpdate(
      req.params.id,
      { isActive: true, updatedAt: Date.now() },
      { new: true }
    ).select('-filePath -__v');

    if (!brochure) {
      return res.status(404).json({ 
        success: false,
        message: 'Brochure not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Brochure activated successfully',
      data: brochure
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      message: 'Failed to activate brochure',
      error: error.message 
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
      try {
        await fs.unlink(brochure.filePath);
        console.log('✅ File deleted:', brochure.fileName);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }

    await brochure.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Brochure deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting brochure:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete brochure',
      error: error.message 
    });
  }
};