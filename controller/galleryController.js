const Gallery = require('../models/Gallery');

// Get all images
const getGalleryImages = async (req, res) => {
  try {
    const images = await Gallery.find().sort({ createdAt: -1 });
    res.json(images);
  } catch (error) {
    console.error('Get gallery error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get single image
const getGalleryImage = async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    res.json(image);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create image
const createGalleryImage = async (req, res) => {
  try {
    console.log('📸 Creating gallery image:', req.body);
    
    const { title, url, category, alt } = req.body;
    
    if (!title || !url) {
      return res.status(400).json({ message: 'Title and URL are required' });
    }
    
    const image = new Gallery({
      title,
      url,
      category: category || 'Uncategorized',
      alt: alt || title
    });
    
    const savedImage = await image.save();
    console.log('✅ Image saved:', savedImage._id);
    
    res.status(201).json(savedImage);
  } catch (error) {
    console.error('❌ Create gallery error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Update image
const updateGalleryImage = async (req, res) => {
  try {
    console.log('📝 Updating gallery image:', req.params.id);
    
    const image = await Gallery.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        url: req.body.url,
        category: req.body.category,
        alt: req.body.alt
      },
      { new: true, runValidators: true }
    );
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    console.log('✅ Image updated:', image._id);
    res.json(image);
  } catch (error) {
    console.error('❌ Update gallery error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Delete image
const deleteGalleryImage = async (req, res) => {
  try {
    console.log('🗑️ Deleting gallery image:', req.params.id);
    
    const image = await Gallery.findByIdAndDelete(req.params.id);
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    console.log('✅ Image deleted');
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('❌ Delete gallery error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getGalleryImages,
  getGalleryImage,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage
};