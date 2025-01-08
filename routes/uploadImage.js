const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const app = express();
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const moment = require('moment')
const multer = require('multer')
const { v2: cloudinary } = require('cloudinary');

// Serve static files from profile-images
app.use('/profile-images', express.static(path.join(__dirname, 'profile-images')));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'profile-images'); // Destination folder (local, optional)
  },
  filename: function (req, file, cb) {
    // Generate a unique filename using username and id
    const username = req.body.username;
    const id = req.body.id;
    const ext = path.extname(file.originalname);
    cb(null, `${username}-${id}-${Date.now()}${ext}`);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
};

// Initialize multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});


// ####              CLOUDINARY             #########

/**
 * Configure Cloudinary globally (for production, consider using process.env for these values).
 */
cloudinary.config({ 
  cloud_name: 'dabegwb2z', 
  api_key: '464793128734399', 
  api_secret: 'yNe3uZ1lgIIeecDqwRzRASq6SMk'
});

/**
 * Upload a local image file to Cloudinary.
 * @param {string} filePath - The local file path (from multer)
 */
const cloundinaryUpload = async (filePath) => {
  try {
    // Upload the actual file from the local file path
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      // Optional transformation parameters, folder naming, etc.
      folder: 'profile_pics', 
    });
    
    console.log('Upload Result:', uploadResult);
    return uploadResult;
    
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    return null;
  }
};

// Endpoint to handle profile picture upload
router.post('/upload-profile-picture', upload.single('profilePicture'), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ message: 'No file uploaded or invalid file type.' });
  }

  // 1) Upload to Cloudinary
  const uploadResult = await cloundinaryUpload(req.file.path);
  if (!uploadResult) {
    return res
      .status(500)
      .json({ message: 'Cloudinary upload failed.' });
  }

  // 2) Construct a Cloudinary-based URL instead of local
  const imageUrl = uploadResult.secure_url;

  // (Optional) You could delete the local file if you don't need it anymore:
  // fs.unlink(req.file.path, () => {});

  // You can also save `imageUrl` to your DB if needed

  return res.status(200).json({
    message: 'File uploaded successfully',
    url: imageUrl
  });
});
