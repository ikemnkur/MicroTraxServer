const express = require('express');
// const db = require('../config/db');
// const authenticateToken = require('../middleware/auth'); // Remove unused import

const mysql = require('mysql2/promise');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const moment = require('moment')
const multer = require('multer')
// const { v2: cloudinary } = require('cloudinary'); // Remove unused import
const { v2: cloudinary } = require('cloudinary');

const { Storage } = require("@google-cloud/storage");
const storage = new Storage({
  projectId: "servers4sqldb",
  keyFilename: "service-account.json",
});

// Serve static files from profile-images
// Remove app.use from this file; serve static files in your main server.js

// Database connection
const dbConfig = {
 host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_4_ADS_NAME || "ad_system",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Database helper functions
const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

const db = {
  query: executeQuery
};

const uploadToFirebaseStorage = async (file, fileName) => {
    try {
        const gcs = storage.bucket("cloutcoinclub_bucket"); // Removed "gs://" from the bucket name
        const storagepath = `storage_folder/${fileName}`;
        const result = await gcs.upload(file, {
            destination: storagepath,
            predefinedAcl: 'publicRead', // Set the file to be publicly readable
            metadata: {
                contentType: "application/plain", // Adjust the content type as needed
            }
        });
        return result[0].metadata.mediaLink;
    } catch (error) {
        console.log(error);
        throw new Error(error.message);
    }
};

  // // Example frontend function to upload file to backend:
  // const uploadToBackend = async (file) => {
  //   const formData = new FormData();
  //   formData.append('media', file);

  //   try {
  //     const response = await fetch(`${API_BASE_URL}/api/upload`, {
  //       method: 'POST',
  //       body: formData,
  //       // headers: { 'Authorization': `Bearer ${token}` } // if needed
  //     });
  //     if (!response.ok) throw new Error('Upload failed');
  //     const data = await response.json();
  //     return data.mediaLink; // Your backend should return the public URL
  //   } catch (error) {
  //     console.error(error);
  //     throw error;
  //   }
  // };

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|mp3|wav/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images, Audio, and Video Only!');
  }
};

// Initialize multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});


  // router.post('/upload',  multer().single('media'), async (req, res) => {
  router.post('/upload', upload.single('profilePicture'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      } else {
        const file = req.file;
        const fileName = `${uuidv4()}_${file.originalname}`;            
        // 1) Upload to Firebase Storage
        const mediaLink = await uploadToFirebaseStorage(file.path, fileName);
        // 2) Alternatively, upload to your backend server
        // const mediaLink = await uploadToBackend(file);           

        // 3) Save the media link and metadata to the database
        const { title, description } = req.body;
        const [result] = await db.query(
            'INSERT INTO ad_media_files (owner_id, host_username, title, description, media_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.user_id, req.user.username, title, description, mediaLink, moment().format('YYYY-MM-DD HH:mm:ss')]
        );  
        res.status(201).json({ message: 'File uploaded successfully', contentId: result.insertId, mediaLink });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });


  // router.post('/upload', authenticateToken, multer().single('media'), async (req, res) => {
  //   try {
  //     if (!req.file) {
  //       return res.status(400).json({ message: 'No file uploaded' });
  //     } else {
  //       const file = req.file;
  //       const fileName = `${uuidv4()}_${file.originalname}`;            
  //       // 1) Upload to Firebase Storage
  //       const mediaLink = await uploadToFirebaseStorage(file.path, fileName);
  //       // 2) Alternatively, upload to your backend server
  //       // const mediaLink = await uploadToBackend(file);           

  //       // 3) Save the media link and metadata to the database
  //       const { title, description } = req.body;
  //       const [result] = await db.query(
  //           'INSERT INTO user_content (owner_id, host_username, title, description, media_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  //           [req.user.user_id, req.user.username, title, description, mediaLink, moment().format('YYYY-MM-DD HH:mm:ss')]
  //       );  
  //       res.status(201).json({ message: 'File uploaded successfully', contentId: result.insertId, mediaLink });
  //     }
  //   } catch (error) {
  //     console.error(error);
  //     res.status(500).json({ message: 'Server error' });
  //   }
  // });

// Function to upload file to Firebase Storage
// service-account.json content below - make sure to keep it secure and not expose it publicly
// {
//   "type": "service_account",
//   "project_id": "servers4sqldb",
//   "private_key_id": "2ff49d7f0f81fb5061cf477be6b8cb3ccb7d2003",
//   "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCuJ6d4v6N9H/lx\nF7u6k/4b4mACOZzB6Dycy4V7IQtCqJ6Y93BeQw/qPMEwFq6YBAL0SPb22nAouy2j\nxEjmzmm49STT8U3u0bpTLSZyJu/L58IsYqw8pfhpAX+k8lRahU1rFoz5+WTMRFtG\n6jqsA/xVcepRQpO2yRUwjp4KKHsbPVJ4kbqtcsQZOLVMKciK4iuhsEMnYrNyzX2e\nrKXr/tABMyDW2ludjEvOI7ARMOqmBMNKEJcFiDJccE191Kv6MAw4X7YzGwmOzLgn\nybob/Bs5RaA1CCcrTKczqqGS++09rc+8eCPbX7nk81KcRoJKfyjeRlh+M5i3ejw6\nq50wFCkjAgMBAAECggEAC0xyTotW/tVWDb1wRf9iTd/RbRjcxS3Hz5UFUMLeOVG5\nkbYCmchNs4YuiGv9oXTSgOkXm1X6TyzZngAsNKExSw5zIwxK4JLFvQNhtP02syq9\ni7tOblQxj2pz+WO+ukK0uPJfwhCpNqFmr0KfUi1OBSMcrxnxKGYs/uykbzHyJAb/\n4L76nA0eDyvFpZmdwJLZ4YoTEAH3zi36T3Is/ZVP7G7liBr0evyqo02TGiqC3/2T\n4xo3HmavVsfexOCa+j/bv+tJRWUMMhJpCs88j3ze7yibSxwvws0EJmacCDV+Mg4Z\n/4Q1frXm/9MZuNEKe1Wuygxwr9by3OgyTucalRj+2QKBgQDZxfRe3TI0vyjsNCW2\nOkQPRyzMM1RwM8ycJOGnExJ31sgZ8dTnmsqymiEBlFOJG3UfXc78lOB5GKSk3EMf\n1N4jkLmV+/ZRHDJ2S0Gz+2YbGPhWUSMFrjSUJVSgBR5jSw2sz8sbR5wbU74Rj/Kf\nPHaNAoM3Z1qZACWTicdVFLdfmwKBgQDMuaCtyWJ7NFc0aiK3ibW8UPaHULdNM61U\ntgDL3VSTjCN69T+eyG9GVj8q5VTGDPJ9x4rf70bz7ku1/iNNiW2GXdSEBYMDTPxF\na66qg+zoRX+vzS/y23crARWWDSLn3xRq4KlmcskgPpMjP+GSVOZuvNnaqFho4WIi\nBE6Xl1QpGQKBgBOU9j1VfH87tS1QHxf8s0QAbWnLL8uLDNn5gwTn9SArgwC6Ox+8\nTn+y1kbzFHPesTBp2gPiSzD4Y02jtLF3DaZ7DAUNi/+NHoh+ieDqOSs0mpgAYbrQ\nCFBN7wcYjrv08rzYTnYcgU//vraLkBB7elmBoVTpCT96wOY8XF0tKLQDAoGBAIIk\nGpV/KICDlE/4jFs6SnIM0brRP8Tu7eekzzrJVyN4eXGHh8rrRXlkCEG/iTVhM6Fr\ngMe79tHIEQ7/H/gBPcOl0Bug2Vj2zoNe4aj5tlctHu9ls25hvw5yYQODFEZsFDGg\n4W8D1wENZkGJMV7xY47PtHmAfLsnU1emf0N0aoa5AoGAJyC/00sn/zbkRNG58czR\ncuyCWkDyInMi3JhF+jKFD/3IVFoLFcqoerDlr5MsFn9IxUQ9CLWa/UIDiiZYHJIn\nBfpudiykOeUXBJXS4WNWHIOwedTtPLVXf3YwwmGvZSkttZUXjEw5JeqNanpBpCw6\n7i1UyZNyRvaS6ry2EW5HcfM=\n-----END PRIVATE KEY-----\n",
//   "client_email": "cloutcloinclub@servers4sqldb.iam.gserviceaccount.com",
//   "client_id": "110059448242111104944",
//   "auth_uri": "https://accounts.google.com/o/oauth2/auth",
//   "token_uri": "https://oauth2.googleapis.com/token",
//   "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
//   "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/cloutcloinclub%40servers4sqldb.iam.gserviceaccount.com",
//   "universe_domain": "googleapis.com"
// }



module.exports = router;