const express = require('express');
const router = express.Router();
const Client = require('../models/Client');

// GET all clients
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching all clients...');
    const clients = await Client.find().sort({ createdAt: -1 });
    console.log(`✅ Found ${clients.length} clients`);
    res.json(clients);
  } catch (error) {
    console.error('❌ Error fetching clients:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET single client
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST new client
router.post('/', async (req, res) => {
  try {
    console.log('➕ Creating new client:', req.body);
    const client = new Client(req.body);
    const savedClient = await client.save();
    console.log('✅ Client created:', savedClient.name);
    res.status(201).json(savedClient);
  } catch (error) {
    console.error('❌ Error creating client:', error.message);
    res.status(400).json({ message: error.message });
  }
});

// PUT update client
router.put('/:id', async (req, res) => {
  try {
    console.log('✏️ Updating client:', req.params.id);
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    console.log('✅ Client updated:', client.name);
    res.json(client);
  } catch (error) {
    console.error('❌ Error updating client:', error.message);
    res.status(400).json({ message: error.message });
  }
});

// DELETE client
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Deleting client:', req.params.id);
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    console.log('✅ Client deleted:', client.name);
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting client:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;