const Enquiry = require('../models/Enquiry');

// @desc    Get all enquiries with filters & pagination
// @route   GET /api/enquiries
// @access  Private/Admin (public in your current setup)
exports.getEnquiries = async (req, res) => {
  try {
    const {
      search = '',
      status = 'all',
      priority,
      isRead,
      isStarred,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name:    { $regex: search, $options: 'i' } },
        { email:   { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Read filter
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    // Starred filter
    if (isStarred !== undefined) {
      query.isStarred = isStarred === 'true';
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const pageNum  = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip     = (pageNum - 1) * limitNum;

    // Execute query
    const [enquiries, total] = await Promise.all([
      Enquiry.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Enquiry.countDocuments(query)
    ]);

    // Get stats by status
    const statsAgg = await Enquiry.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsObj = {
      total,
      new: 0,
      inProgress: 0,
      resolved: 0,
      spam: 0
    };

    statsAgg.forEach(stat => {
      if (stat._id === 'new')          statsObj.new        = stat.count;
      else if (stat._id === 'in-progress') statsObj.inProgress = stat.count;
      else if (stat._id === 'resolved')    statsObj.resolved   = stat.count;
      else if (stat._id === 'spam')        statsObj.spam       = stat.count;
    });

    res.status(200).json({
      success: true,
      data: enquiries,
      stats: statsObj,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get enquiries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enquiries',
      error: error.message
    });
  }
};

// @desc    Get single enquiry
// @route   GET /api/enquiries/:id
// @access  Private/Admin (public in your current setup)
exports.getEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    // Mark as read
    if (!enquiry.isRead) {
      enquiry.isRead = true;
      await enquiry.save();
    }

    res.status(200).json({
      success: true,
      data: enquiry
    });
  } catch (error) {
    console.error('Get enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enquiry',
      error: error.message
    });
  }
};

// @desc    Create new enquiry (PUBLIC - from contact form)
// @route   POST /api/enquiries
// @access  Public
exports.createEnquiry = async (req, res) => {
  try {
    const { name, email, phone, company, subject, message } = req.body;

    // Validation
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Create enquiry
    const enquiry = await Enquiry.create({
      name,
      email,
      phone,
      company: company || '',
      subject,
      message,
      status: 'new',
      priority: 'medium',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully. We will get back to you soon!',
      data: enquiry
    });

    // TODO: Send notification email to admin
    // TODO: Send confirmation email to customer
  } catch (error) {
    console.error('Create enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit enquiry',
      error: error.message
    });
  }
};

// @desc    Update enquiry
// @route   PUT /api/enquiries/:id
// @access  Private/Admin
exports.updateEnquiry = async (req, res) => {
  try {
    const allowedFields = ['status', 'priority', 'isRead', 'isStarred', 'tags'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Enquiry updated successfully',
      data: enquiry
    });
  } catch (error) {
    console.error('Update enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update enquiry',
      error: error.message
    });
  }
};

// @desc    Delete enquiry
// @route   DELETE /api/enquiries/:id
// @access  Private/Admin
exports.deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Enquiry deleted successfully'
    });
  } catch (error) {
    console.error('Delete enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete enquiry',
      error: error.message
    });
  }
};

// @desc    Add response to enquiry
// @route   POST /api/enquiries/:id/responses
// @access  Private/Admin
exports.addResponse = async (req, res) => {
  try {
    const { message, sendEmail } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Response message is required'
      });
    }

    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    // Add response
    enquiry.responses.push({
      message,
      sendEmail: sendEmail || false,
      respondedBy: req.user?._id,
      respondedByName: req.user?.name || 'Admin'
    });

    // Update status to in-progress if it was new
    if (enquiry.status === 'new') {
      enquiry.status = 'in-progress';
    }

    await enquiry.save();

    // TODO: Send email if sendEmail is true

    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: enquiry
    });
  } catch (error) {
    console.error('Add response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add response',
      error: error.message
    });
  }
};

// @desc    Toggle read status
// @route   PATCH /api/enquiries/:id/read
// @access  Private/Admin
exports.toggleRead = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    enquiry.isRead = !enquiry.isRead;
    await enquiry.save();

    res.status(200).json({
      success: true,
      data: enquiry
    });
  } catch (error) {
    console.error('Toggle read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle read status',
      error: error.message
    });
  }
};

// @desc    Toggle star status
// @route   PATCH /api/enquiries/:id/star
// @access  Private/Admin
exports.toggleStar = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    enquiry.isStarred = !enquiry.isStarred;
    await enquiry.save();

    res.status(200).json({
      success: true,
      data: enquiry
    });
  } catch (error) {
    console.error('Toggle star error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle star status',
      error: error.message
    });
  }
};

// @desc    Export enquiries
// @route   GET /api/enquiries/export
// @access  Private/Admin
exports.exportEnquiries = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    const enquiries = await Enquiry.find({}).sort({ createdAt: -1 }).lean();

    if (format === 'csv') {
      // CSV Export
      const csvRows = [];
      const headers = ['Name', 'Email', 'Phone', 'Company', 'Subject', 'Message', 'Status', 'Priority', 'Date'];
      csvRows.push(headers.join(','));

      enquiries.forEach(enquiry => {
        const row = [
          enquiry.name,
          enquiry.email,
          enquiry.phone,
          enquiry.company || '',
          enquiry.subject,
          `"${enquiry.message.replace(/"/g, '""')}"`,
          enquiry.status,
          enquiry.priority,
          new Date(enquiry.createdAt).toLocaleDateString()
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=enquiries.csv');
      res.status(200).send(csvContent);
    } else {
      // JSON Export
      res.status(200).json({
        success: true,
        data: enquiries
      });
    }
  } catch (error) {
    console.error('Export enquiries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export enquiries',
      error: error.message
    });
  }
};

// @desc    Bulk update enquiries
// @route   PUT /api/enquiries/bulk
// @access  Private/Admin
exports.bulkUpdate = async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide enquiry IDs'
      });
    }

    const allowedUpdates = ['status', 'priority', 'isRead', 'isStarred'];
    const updateData = {};

    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = updates[key];
      }
    });

    const result = await Enquiry.updateMany(
      { _id: { $in: ids } },
      { $set: updateData }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} enquiries updated`,
      data: result
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update enquiries',
      error: error.message
    });
  }
};

// @desc    Bulk delete enquiries
// @route   POST /api/enquiries/bulk/delete
// @access  Private/Admin
exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide enquiry IDs'
      });
    }

    const result = await Enquiry.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} enquiries deleted`,
      data: result
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete enquiries',
      error: error.message
    });
  }
};

// @desc    Get enquiry statistics (simple counts by status)
// @route   GET /api/enquiries/stats
// @access  Private/Admin
exports.getStats = async (req, res) => {
  try {
    const [total, grouped] = await Promise.all([
      Enquiry.countDocuments(),
      Enquiry.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const stats = {
      total,
      new: 0,
      inProgress: 0,
      resolved: 0,
      spam: 0
    };

    grouped.forEach(stat => {
      if (stat._id === 'new')          stats.new        = stat.count;
      else if (stat._id === 'in-progress') stats.inProgress = stat.count;
      else if (stat._id === 'resolved')    stats.resolved   = stat.count;
      else if (stat._id === 'spam')        stats.spam       = stat.count;
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get enquiries stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enquiry stats',
      error: error.message
    });
  }
};