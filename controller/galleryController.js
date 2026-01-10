const Gallery = require('../models/Gallery');
const Category = require('../models/Category');
const path = require('path');
const fs = require('fs');

// Helper function to save base64 image to disk
const saveBase64Image = (base64String, title) => {
  try {
    // Check if it's a base64 string
    if (!base64String.includes('base64')) {
      return { success: false, url: base64String }; // Not a base64 string, return as is
    }
    
    // Extract image data and type
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      return { success: false, url: base64String };
    }
    
    const type = matches[1];
    const data = Buffer.from(matches[2], 'base64');
    
    // Generate file extension and name
    const extension = type.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.${extension}`;
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filePath = path.join(uploadsDir, fileName);
    
    // Save file
    fs.writeFileSync(filePath, data);
    console.log(`✅ Image saved to ${filePath}`);
    
    // Return URL
    return { 
      success: true, 
      url: `/uploads/${fileName}`,
      fileName: fileName,
      fileSize: data.length,
      fileType: type
    };
  } catch (error) {
    console.error('Error saving image:', error);
    return { success: false, url: base64String };
  }
};

// Get all images
const getGalleryImages = async (req, res) => {
  try {
    const images = await Gallery.find().sort({ createdAt: -1 });
    
    // Map images to include full URLs for relative paths
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const processedImages = images.map(img => {
      const imgObj = img.toObject();
      // Only process URLs that are relative paths (not external or base64)
      if (imgObj.url && !imgObj.url.startsWith('http') && !imgObj.url.startsWith('data:')) {
        imgObj.url = `${baseUrl}${imgObj.url.startsWith('/') ? '' : '/'}${imgObj.url}`;
      }
      return imgObj;
    });
    
    res.json(processedImages);
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
    
    // Add full URL for relative paths
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageObj = image.toObject();
    
    if (imageObj.url && !imageObj.url.startsWith('http') && !imageObj.url.startsWith('data:')) {
      imageObj.url = `${baseUrl}${imageObj.url.startsWith('/') ? '' : '/'}${imageObj.url}`;
    }
    
    res.json(imageObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create image
const createGalleryImage = async (req, res) => {
  try {
    console.log('📸 Creating gallery image');
    
    const { title, url, category, description, alt } = req.body;
    
    if (!title || !url) {
      return res.status(400).json({ message: 'Title and URL are required' });
    }
    
    // Verify category exists if provided (except for "Uncategorized")
    if (category && category !== 'Uncategorized') {
      const categoryExists = await Category.findOne({ name: category });
      if (!categoryExists) {
        return res.status(400).json({ 
          message: `Category "${category}" does not exist. Please select a valid category or create it first.`
        });
      }
    }
    
    // Process image if it's base64
    let imageData = { 
      url, 
      fileName: '',
      fileSize: 0,
      fileType: ''
    };
    
    if (url.startsWith('data:')) {
      const result = saveBase64Image(url, title);
      if (result.success) {
        imageData = result;
      }
    }
    
    const image = new Gallery({
      title,
      url: imageData.url,
      category: category || 'Uncategorized',
      description: description || '',
      alt: alt || title,
      fileName: imageData.fileName,
      fileSize: imageData.fileSize,
      fileType: imageData.fileType
    });
    
    const savedImage = await image.save();
    console.log('✅ Image saved:', savedImage._id);
    
    // Return with full URL for relative paths
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const responseImage = savedImage.toObject();
    
    if (responseImage.url && !responseImage.url.startsWith('http') && !responseImage.url.startsWith('data:')) {
      responseImage.url = `${baseUrl}${responseImage.url.startsWith('/') ? '' : '/'}${responseImage.url}`;
    }
    
    res.status(201).json(responseImage);
  } catch (error) {
    console.error('❌ Create gallery error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Update image
const updateGalleryImage = async (req, res) => {
  try {
    console.log('📝 Updating gallery image:', req.params.id);
    
    const { title, url, category, description, alt } = req.body;
    
    if (category && category !== 'Uncategorized') {
      const categoryExists = await Category.findOne({ name: category });
      if (!categoryExists) {
        return res.status(400).json({ 
          message: `Category "${category}" does not exist. Please select a valid category or create it first.`
        });
      }
    }
    
    // Get the current image to check if URL changed
    const currentImage = await Gallery.findById(req.params.id);
    if (!currentImage) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    // Initialize updated data
    let imageData = { 
      url,
      fileName: currentImage.fileName,
      fileSize: currentImage.fileSize,
      fileType: currentImage.fileType
    };
    
    // If URL has changed and it's a base64 string, process it
    if (url !== currentImage.url && url.startsWith('data:')) {
      const result = saveBase64Image(url, title);
      if (result.success) {
        imageData = result;
        
        // Delete the old image file if it exists and is a local file
        if (currentImage.fileName && fs.existsSync(path.join(__dirname, '..', 'public', 'uploads', currentImage.fileName))) {
          try {
            fs.unlinkSync(path.join(__dirname, '..', 'public', 'uploads', currentImage.fileName));
            console.log('✅ Deleted old image file');
          } catch (err) {
            console.error('Failed to delete old image file:', err);
          }
        }
      }
    }
    
    const image = await Gallery.findByIdAndUpdate(
      req.params.id,
      {
        title,
        url: imageData.url,
        category: category || 'Uncategorized',
        description: description || '',
        alt: alt || title,
        fileName: imageData.fileName,
        fileSize: imageData.fileSize,
        fileType: imageData.fileType
      },
      { new: true, runValidators: true }
    );
    
    console.log('✅ Image updated:', image._id);
    
    // Return with full URL for relative paths
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const responseImage = image.toObject();
    
    if (responseImage.url && !responseImage.url.startsWith('http') && !responseImage.url.startsWith('data:')) {
      responseImage.url = `${baseUrl}${responseImage.url.startsWith('/') ? '' : '/'}${responseImage.url}`;
    }
    
    res.json(responseImage);
  } catch (error) {
    console.error('❌ Update gallery error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Delete image
const deleteGalleryImage = async (req, res) => {
  try {
    console.log('🗑️ Deleting gallery image:', req.params.id);
    
    const image = await Gallery.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    // Delete the image file if it exists and is a local file
    if (image.fileName) {
      const filePath = path.join(__dirname, '..', 'public', 'uploads', image.fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('✅ Deleted image file:', image.fileName);
        } catch (err) {
          console.error('Failed to delete image file:', err);
        }
      }
    }
    
    await Gallery.findByIdAndDelete(req.params.id);
    console.log('✅ Image record deleted');
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('❌ Delete gallery error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get images by category
const getImagesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    let images;
    if (category === 'Uncategorized') {
      images = await Gallery.find({ 
        $or: [
          { category: "Uncategorized" },
          { category: { $exists: false } },
          { category: null },
          { category: "" }
        ]
      }).sort({ createdAt: -1 });
    } else {
      images = await Gallery.find({ category }).sort({ createdAt: -1 });
    }
    
    // Add full URLs for relative paths
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const processedImages = images.map(img => {
      const imgObj = img.toObject();
      if (imgObj.url && !imgObj.url.startsWith('http') && !imgObj.url.startsWith('data:')) {
        imgObj.url = `${baseUrl}${imgObj.url.startsWith('/') ? '' : '/'}${imgObj.url}`;
      }
      return imgObj;
    });
    
    res.json(processedImages);
  } catch (error) {
    console.error('Get images by category error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get category counts
const getCategoryCounts = async (req, res) => {
  try {
    const counts = await Gallery.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Format result as an object
    const result = {};
    counts.forEach(item => {
      result[item._id || "Uncategorized"] = item.count;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Get category counts error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getGalleryImages,
  getGalleryImage,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  getImagesByCategory,
  getCategoryCounts
};