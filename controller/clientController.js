// backend/controllers/clientController.js
const Client = require('../models/Client');
const path = require('path');
const fs = require('fs');

// Helper function to handle errors
const handleError = (res, error, defaultMessage = 'Server error') => {
  console.error('❌ Error:', error);

  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
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
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  res.status(500).json({
    success: false,
    message: defaultMessage,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// @desc    Get all clients
// @route   GET /api/clients
// @access  Public
exports.getAllClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      since
    } = req.query;

    // Build query
    const query = {};

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Filter by status
    if (status && status !== 'All') {
      query.status = status;
    }

    // Filter by since year
    if (since) {
      query.since = since;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [clients, total] = await Promise.all([
      Client.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Client.countDocuments(query)
    ]);

    // Calculate stats
    const totalClients = await Client.countDocuments();
    const activeClients = await Client.countDocuments({ status: 'Active' });
    const inactiveClients = await Client.countDocuments({ status: 'Inactive' });
    
    const avgRatingResult = await Client.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    const stats = {
      total: totalClients,
      active: activeClients,
      inactive: inactiveClients,
      averageRating: avgRatingResult[0]?.averageRating?.toFixed(1) || '0.0'
    };

    res.status(200).json({
      success: true,
      count: clients.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      stats,
      data: clients
    });

  } catch (error) {
    handleError(res, error, 'Failed to fetch clients');
  }
};

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Public
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.status(200).json({
      success: true,
      data: client
    });

  } catch (error) {
    handleError(res, error, 'Failed to fetch client');
  }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Public
exports.createClient = async (req, res) => {
  try {
    const { name, address, status, since, rating } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Client name is required'
      });
    }

    // Check if client with same name exists
    const existingClient = await Client.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });

    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: 'A client with this name already exists'
      });
    }

    const client = await Client.create({
      name: name.trim(),
      address: address?.trim() || '',
      status: status || 'Active',
      since: since || new Date().getFullYear().toString(),
      rating: rating || 5
    });

    console.log('✅ Client created:', client.name);

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: client
    });

  } catch (error) {
    handleError(res, error, 'Failed to create client');
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Public
exports.updateClient = async (req, res) => {
  try {
    const { name, address, status, since, rating } = req.body;

    let client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Validate name if provided
    if (name && name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Client name cannot be empty'
      });
    }

    // Check if another client with same name exists
    if (name && name.trim() !== client.name) {
      const existingClient = await Client.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingClient) {
        return res.status(400).json({
          success: false,
          message: 'A client with this name already exists'
        });
      }
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (address !== undefined) updateData.address = address.trim();
    if (status !== undefined) updateData.status = status;
    if (since !== undefined) updateData.since = since;
    if (rating !== undefined) updateData.rating = rating;

    // Update client
    client = await Client.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('✅ Client updated:', client.name);

    res.status(200).json({
      success: true,
      message: 'Client updated successfully',
      data: client
    });

  } catch (error) {
    handleError(res, error, 'Failed to update client');
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Public
exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    await Client.findByIdAndDelete(req.params.id);

    console.log('✅ Client deleted:', client.name);

    res.status(200).json({
      success: true,
      message: 'Client deleted successfully',
      data: {
        id: client._id,
        name: client.name
      }
    });

  } catch (error) {
    handleError(res, error, 'Failed to delete client');
  }
};

// @desc    Delete multiple clients
// @route   DELETE /api/clients/bulk
// @access  Public
exports.bulkDeleteClients = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide client IDs to delete'
      });
    }

    const result = await Client.deleteMany({ _id: { $in: ids } });

    console.log(`✅ ${result.deletedCount} clients deleted`);

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} clients deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    handleError(res, error, 'Failed to delete clients');
  }
};

// @desc    Get client stats
// @route   GET /api/clients/stats
// @access  Public
exports.getClientStats = async (req, res) => {
  try {
    const [totalClients, activeClients, inactiveClients, avgRatingResult, recentClients, topRatedClients] = await Promise.all([
      Client.countDocuments(),
      Client.countDocuments({ status: 'Active' }),
      Client.countDocuments({ status: 'Inactive' }),
      Client.aggregate([
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' }
          }
        }
      ]),
      Client.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name status since createdAt')
        .lean(),
      Client.find({ rating: 5 })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name rating since')
        .lean()
    ]);

    const stats = {
      total: totalClients,
      active: activeClients,
      inactive: inactiveClients,
      averageRating: avgRatingResult[0]?.averageRating?.toFixed(1) || '0.0',
      recentClients,
      topRatedClients
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    handleError(res, error, 'Failed to fetch client stats');
  }
};

// @desc    Export clients
// @route   GET /api/clients/export
// @access  Public
exports.exportClients = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const clients = await Client.find()
      .select('-__v')
      .lean();

    if (format === 'csv') {
      const fields = ['name', 'address', 'status', 'since', 'rating', 'createdAt'];
      const csv = [
        fields.join(','),
        ...clients.map(client => 
          fields.map(field => {
            let value = client[field] || '';
            if (field === 'createdAt') {
              value = new Date(value).toLocaleDateString();
            }
            return `"${value}"`;
          }).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=clients.csv');
      return res.send(csv);
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=clients.json');
    
    res.status(200).json({
      success: true,
      count: clients.length,
      exportedAt: new Date().toISOString(),
      data: clients
    });

  } catch (error) {
    handleError(res, error, 'Failed to export clients');
  }
};

// @desc    Import clients
// @route   POST /api/clients/import
// @access  Public
exports.importClients = async (req, res) => {
  try {
    const { clients } = req.body;

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide clients data to import'
      });
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (const clientData of clients) {
      try {
        // Validate name
        if (!clientData.name || clientData.name.trim() === '') {
          results.failed++;
          results.errors.push(`Row ${results.success + results.failed}: Name is required`);
          continue;
        }

        // Check if client exists
        const existing = await Client.findOne({ 
          name: { $regex: new RegExp(`^${clientData.name.trim()}$`, 'i') } 
        });

        if (existing) {
          results.skipped++;
          results.errors.push(`${clientData.name}: Already exists`);
          continue;
        }

        await Client.create({
          name: clientData.name.trim(),
          address: clientData.address?.trim() || '',
          status: clientData.status || 'Active',
          since: clientData.since || new Date().getFullYear().toString(),
          rating: clientData.rating || 5
        });
        
        results.success++;

      } catch (err) {
        results.failed++;
        results.errors.push(`${clientData.name}: ${err.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Imported ${results.success} clients, ${results.skipped} skipped, ${results.failed} failed`,
      data: results
    });

  } catch (error) {
    handleError(res, error, 'Failed to import clients');
  }
};

// @desc    Update client status (bulk)
// @route   PATCH /api/clients/status
// @access  Public
exports.updateClientStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide client IDs'
      });
    }

    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be Active or Inactive'
      });
    }

    const result = await Client.updateMany(
      { _id: { $in: ids } },
      { status }
    );

    console.log(`✅ ${result.modifiedCount} clients updated to ${status}`);

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} clients updated to ${status}`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    handleError(res, error, 'Failed to update client status');
  }
};

// @desc    Search clients
// @route   GET /api/clients/search
// @access  Public
exports.searchClients = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const clients = await Client.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } }
      ]
    })
    .limit(20)
    .select('name address status since rating')
    .lean();

    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
    });

  } catch (error) {
    handleError(res, error, 'Failed to search clients');
  }
};

// @desc    Get clients by year
// @route   GET /api/clients/by-year/:year
// @access  Public
exports.getClientsByYear = async (req, res) => {
  try {
    const { year } = req.params;

    const clients = await Client.find({ since: year })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      year,
      count: clients.length,
      data: clients
    });

  } catch (error) {
    handleError(res, error, 'Failed to fetch clients by year');
  }
};

// @desc    Get top rated clients
// @route   GET /api/clients/top-rated
// @access  Public
exports.getTopRatedClients = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const clients = await Client.find({ rating: { $gte: 4 } })
      .sort({ rating: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
    });

  } catch (error) {
    handleError(res, error, 'Failed to fetch top rated clients');
  }
};