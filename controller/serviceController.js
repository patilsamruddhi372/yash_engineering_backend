const Service = require('../models/Service');
const mongoose = require('mongoose');

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

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

  res.status(500).json({ 
    success: false, 
    message: error.message || defaultMessage 
  });
};

// ═══════════════════════════════════════════════════════════
// GET ALL SERVICES
// ═══════════════════════════════════════════════════════════
const getServices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status,
      featured,
      search,
      sortBy = 'createdAt',
      order = 'desc' 
    } = req.query;

    // Build filter
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (featured !== undefined) filter.featured = featured === 'true';
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { desc: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'desc' ? -1 : 1;

    const [services, total] = await Promise.all([
      Service.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Service.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        total: await Service.countDocuments(),
        active: await Service.countDocuments({ status: 'Active' }),
        inactive: await Service.countDocuments({ status: 'Inactive' }),
        featured: await Service.countDocuments({ status: 'Featured' })
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch services');
  }
};

// ═══════════════════════════════════════════════════════════
// GET SINGLE SERVICE BY ID
// ═══════════════════════════════════════════════════════════
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid service ID' 
      });
    }

    const service = await Service.findById(id);
    
    if (!service) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service not found' 
      });
    }

    res.json({ 
      success: true, 
      data: service 
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch service');
  }
};

// ═══════════════════════════════════════════════════════════
// CREATE NEW SERVICE
// ═══════════════════════════════════════════════════════════
const createService = async (req, res) => {
  try {
    console.log('📦 Creating service:', req.body);

    const serviceData = {
      title: req.body.title?.trim(),
      desc: req.body.desc?.trim(),
      status: req.body.status || 'Active',
      duration: req.body.duration || '2-4 hours',
      price: parseFloat(req.body.price) || 0,
      image: req.body.image || null,
      category: req.body.category || 'Other',
      featured: req.body.status === 'Featured' || Boolean(req.body.featured)
    };

    const service = new Service(serviceData);
    const savedService = await service.save();

    console.log('✅ Service created:', savedService._id);

    res.status(201).json({ 
      success: true, 
      message: 'Service created successfully',
      data: savedService 
    });
  } catch (error) {
    handleError(res, error, 'Failed to create service');
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE SERVICE (PUT)
// ═══════════════════════════════════════════════════════════
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📝 Updating service:', id);
    console.log('📝 Data:', req.body);

    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid service ID' 
      });
    }

    const existingService = await Service.findById(id);
    if (!existingService) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service not found' 
      });
    }

    const updateData = {
      title: req.body.title?.trim(),
      desc: req.body.desc?.trim(),
      status: req.body.status || 'Active',
      duration: req.body.duration || '2-4 hours',
      price: parseFloat(req.body.price) || 0,
      image: req.body.image !== undefined ? req.body.image : existingService.image,
      category: req.body.category || 'Other',
      featured: req.body.status === 'Featured' || Boolean(req.body.featured)
    };

    const updatedService = await Service.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true,
        runValidators: true
      }
    );

    console.log('✅ Service updated:', updatedService._id);

    res.json({ 
      success: true, 
      message: 'Service updated successfully',
      data: updatedService 
    });
  } catch (error) {
    handleError(res, error, 'Failed to update service');
  }
};

// ═══════════════════════════════════════════════════════════
// PARTIAL UPDATE (PATCH)
// ═══════════════════════════════════════════════════════════
const patchService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid service ID' 
      });
    }

    const allowedFields = ['title', 'desc', 'status', 'duration', 'price', 'image', 'category', 'featured'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Auto-set featured if status is Featured
    if (updates.status === 'Featured') {
      updates.featured = true;
    }

    const service = await Service.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Service updated',
      data: service 
    });
  } catch (error) {
    handleError(res, error, 'Failed to patch service');
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE SERVICE
// ═══════════════════════════════════════════════════════════
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting service:', id);

    if (!isValidId(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid service ID' 
      });
    }

    const service = await Service.findByIdAndDelete(id);

    if (!service) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service not found' 
      });
    }

    console.log('✅ Service deleted:', id);

    res.json({ 
      success: true, 
      message: 'Service deleted successfully',
      data: { id }
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete service');
  }
};

// ═══════════════════════════════════════════════════════════
// TOGGLE STATUS
// ═══════════════════════════════════════════════════════════
const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service not found' 
      });
    }

    service.status = service.status === 'Active' ? 'Inactive' : 'Active';
    await service.save();

    res.json({ 
      success: true, 
      message: `Service status changed to ${service.status}`,
      data: service 
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

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service not found' 
      });
    }

    service.featured = !service.featured;
    if (service.featured) {
      service.status = 'Featured';
    } else if (service.status === 'Featured') {
      service.status = 'Active';
    }
    await service.save();

    res.json({ 
      success: true, 
      message: service.featured ? 'Service featured' : 'Service unfeatured',
      data: service 
    });
  } catch (error) {
    handleError(res, error, 'Failed to toggle featured');
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
        message: 'Invalid service IDs' 
      });
    }

    const result = await Service.deleteMany({ _id: { $in: ids } });

    res.json({ 
      success: true, 
      message: `${result.deletedCount} services deleted`,
      data: result 
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete services');
  }
};

// ═══════════════════════════════════════════════════════════
// GET STATS
// ═══════════════════════════════════════════════════════════
const getStats = async (req, res) => {
  try {
    const [total, active, inactive, featured] = await Promise.all([
      Service.countDocuments(),
      Service.countDocuments({ status: 'Active' }),
      Service.countDocuments({ status: 'Inactive' }),
      Service.countDocuments({ status: 'Featured' })
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive,
        featured
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch stats');
  }
};

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  patchService,
  deleteService,
  toggleStatus,
  toggleFeatured,
  bulkDelete,
  getStats
};