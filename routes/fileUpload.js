// routes/fileUpload.js
const express = require('express');
const router = express.Router();

const path = require('path');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
const Busboy = require('busboy'); // v1+ exports a function, not a class
const { Storage } = require('@google-cloud/storage');

const authenticateToken = require('../middleware/auth');
const { end } = require('../config/db');

// -----------------------------
// DB Pool
// -----------------------------
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_4_ADS_NAME || 'ad_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function dbQuery(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// -----------------------------
// Google Cloud Storage
// -----------------------------
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || 'servers4sqldb',
  keyFilename: process.env.GCP_SA_KEYFILE || 'service-account.json',
});

const BUCKET_NAME = process.env.GCS_BUCKET || 'cloutcoinclub_bucket';
const DEST_PREFIX = process.env.GCS_PREFIX || 'storage_folder'; // "folder" inside bucket

function publicUrl(bucket, filepath) {
  return `https://storage.googleapis.com/${bucket}/${encodeURI(filepath)}`;
}

// Allowed file types (both ext and mime)
const ALLOWED = /^(jpeg|jpg|png|webp|gif|mp4|webm|mp3|wav)$/i;
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
};

// -----------------------------
// Route: POST /upload/adFile
// Body: multipart/form-data with fields:
//   - media: file
//   - title: string
//   - description: string
// Auth: Bearer (authenticateToken)
// -----------------------------
router.post('/adFile', authenticateToken, async (req, res) => {
  console.log('File upload request received');

  let busboy;
  try {
    busboy = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB
  } catch (e) {
    console.error('Failed to init Busboy:', e);
    return res.status(400).json({ message: 'Invalid multipart/form-data request' });
  }

  // State
  let uploadDone = false;
  let writeStream;
  let gcsFilePath = '';
  let mimeTypeGlobal = '';
  let title = '';
  let description = '';
  let hadFile = false;
  let aborted = false;

  // ----- text fields -----
  busboy.on('field', (fieldname, val) => {
    if (fieldname === 'title') title = val;
    if (fieldname === 'description') description = val;
  });

  // ----- file stream -----
  // Busboy v1 signature: (fieldname, stream, info)
  busboy.on('file', (fieldname, file, info) => {
    hadFile = true;

    const { filename: rawFilename, mimeType } = info || {};
    const originalName =
      typeof rawFilename === 'string' && rawFilename.trim() ? rawFilename.trim() : 'upload';

    // Validate by ext and mime
    const extFromName = path.extname(originalName).toLowerCase().replace('.', ''); // 'png'
    const extOk = !!extFromName && ALLOWED.test(extFromName);
    const mimeOk = ALLOWED.test((mimeType || '').split('/').pop() || '');

    if (!extOk && !mimeOk) {
      file.resume();
      aborted = true;
      return res.status(400).json({ message: 'Error: Images, Audio, and Video Only!' });
    }

    // Build filename
    const base = path
      .basename(originalName)
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9._-]/g, '');

    const resolvedExt =
      (extOk ? `.${extFromName}` : (MIME_TO_EXT[(mimeType || '').toLowerCase()] || '')) || '';

    // ensure we have an extension
    let finalBase = base;
    if (!resolvedExt || !base.toLowerCase().endsWith(resolvedExt.toLowerCase())) {
      finalBase = `${base}${resolvedExt}`;
    }

    const finalName = `${uuidv4()}_${finalBase}`;
    gcsFilePath = `${DEST_PREFIX}/${finalName}`;
    mimeTypeGlobal = mimeType || 'application/octet-stream';

    // Stream to GCS
    const bucket = storage.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(gcsFilePath);

    writeStream = gcsFile.createWriteStream({
      metadata: { contentType: mimeTypeGlobal },
      resumable: false, // set true for larger files if you want
      validation: 'md5',
    });

    file.pipe(writeStream);

    writeStream.on('error', (err) => {
      console.error('GCS write error:', err);
      if (!uploadDone) {
        uploadDone = true;
        return res.status(500).json({ message: 'Upload failed' });
      }
    });

    writeStream.on('finish', async () => {
      try {
        // If your bucket uses Uniform bucket-level access, either:
        //  - serve via public policy on bucket path, or
        //  - generate signed URLs instead of makePublic().
        await bucket.file(gcsFilePath).makePublic().catch((err) => {
          // If uniform access is enabled, makePublic() will fail with 400.
          // You can ignore this if the bucket is already public or switch to signed URLs.
          if (err && err.code !== 400) throw err;
        });

        const mediaLink = publicUrl(BUCKET_NAME, gcsFilePath);

        const now = moment().format('YYYY-MM-DD HH:mm:ss');
        const result = await dbQuery(
          'INSERT INTO ad_media_files (owner_id, host_username, title, description, media_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user.user_id, req.user.username, title, description, mediaLink, now]
        );

        if (!uploadDone) {
          uploadDone = true;
          return res.status(201).json({
            message: 'File uploaded successfully',
            contentId: result.insertId,
            mediaLink,
          });
        }
      } catch (err) {
        console.error('Post-upload error:', err);
        if (!uploadDone) {
          uploadDone = true;
          return res.status(500).json({ message: 'Server error' });
        }
      }
    });
  });

  // ----- limits & errors -----
  busboy.on('error', (err) => {
    console.error('Busboy error:', err);
    if (!uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'Malformed upload' });
    }
  });

  busboy.on('partsLimit', () => {
    aborted = true;
    if (!uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'Too many parts in form data' });
    }
  });

  busboy.on('filesLimit', () => {
    aborted = true;
    if (!uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'Too many files' });
    }
  });

  busboy.on('fieldsLimit', () => {
    aborted = true;
    if (!uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'Too many fields' });
    }
  });

  // ----- finish -----
  busboy.on('finish', () => {
    if (aborted) return;
    if (!hadFile && !uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'No file uploaded' });
    }
    // normal success response is sent in writeStream 'finish'
  });

  req.pipe(busboy);
});


// From the front end React
  // Profile picture upload
  // const handleProfilePictureChange = async (event) => {
  //   const file = event.target.files?.[0];
  //   if (!file) return;

  //   const reader = new FileReader();
  //   reader.onloadend = () => {
  //     setProfilePicturePreview(reader.result);
  //     setUserData((prev) => ({ ...prev, profilePicture: file }));
  //   };
  //   reader.readAsDataURL(file);

  //   const formData = new FormData();
  //   formData.append('profilePicture', file);
  //   formData.append('username', userData.username);
  //   formData.append('userId', userData.user_id || userData.id);
  //   formData.append('date', new Date().toISOString());

  //   try {
  //     const response = await api.post('/upload/profile-picture', formData, {
  //       headers: { 'Content-Type': 'multipart/form-data' },
  //     });
  //     setUserData((prev) => ({ ...prev, profilePictureUrl: response.data.url || '' }));
  //     setSnackbarMessage('Profile picture uploaded successfully!');
  //   } catch (error) {
  //     console.error('API - Error uploading user profile image:', error);
  //     setSnackbarMessage('An error occurred while uploading the image.');
  //   } finally {
  //     setOpenSnackbar(true);
  //   }
  // };



// ######################## POST PROFILE PIC ###############################

// Endpoint to handle profile picture upload
router.post('/upload/profile-picture', authenticateToken, async (req, res) => {
  console.log("Profile picture upload request received");

  let busboy;
  try {
    busboy = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB
  } catch (e) {
    console.error('Failed to init Busboy:', e);
    return res.status(400).json({ message: 'Invalid multipart/form-data request' });
  }

  let uploadDone = false;
  let writeStream;
  let gcsFilePath = '';
  let mimeTypeGlobal = '';
  let username = '';
  let userId = '';
  let hadFile = false;
  let aborted = false;

  busboy.on('field', (fieldname, val) => {
    if (fieldname === 'username') username = val;
    if (fieldname === 'userId') userId = val;
  });

  busboy.on('file', (fieldname, file, info) => {
    hadFile = true;

    const { filename: rawFilename, mimeType } = info || {};
    const originalName =
      typeof rawFilename === 'string' && rawFilename.trim() ? rawFilename.trim() : 'profile';

    // Validate by ext and mime
    const extFromName = path.extname(originalName).toLowerCase().replace('.', '');
    const extOk = !!extFromName && ALLOWED.test(extFromName);
    const mimeOk = ALLOWED.test((mimeType || '').split('/').pop() || '');

    if (!extOk && !mimeOk) {
      file.resume();
      aborted = true;
      return res.status(400).json({ message: 'Error: Images Only!' });
    }

    const base = path
      .basename(originalName)
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9._-]/g, '');

    const resolvedExt =
      (extOk ? `.${extFromName}` : (MIME_TO_EXT[(mimeType || '').toLowerCase()] || '')) || '';

    let finalBase = base;
    if (!resolvedExt || !base.toLowerCase().endsWith(resolvedExt.toLowerCase())) {
      finalBase = `${base}${resolvedExt}`;
    }

    const finalName = `${uuidv4()}_${finalBase}`;
    gcsFilePath = `${DEST_PREFIX}/profile_pics/${finalName}`;
    mimeTypeGlobal = mimeType || 'application/octet-stream';

    const bucket = storage.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(gcsFilePath);

    writeStream = gcsFile.createWriteStream({
      metadata: { contentType: mimeTypeGlobal },
      resumable: false,
      validation: 'md5',
    });

    file.pipe(writeStream);

    writeStream.on('error', (err) => {
      console.error('GCS write error:', err);
      if (!uploadDone) {
        uploadDone = true;
        return res.status(500).json({ message: 'Upload failed' });
      }
    });

    writeStream.on('finish', async () => {
      try {
        await bucket.file(gcsFilePath).makePublic().catch((err) => {
          if (err && err.code !== 400) throw err;
        });

        const imageUrl = publicUrl(BUCKET_NAME, gcsFilePath);

        // Optionally update user profilePic in DB
        await dbQuery(
          'UPDATE users SET profilePic = ? WHERE user_id = ?',
          [imageUrl, userId]
        );

        if (!uploadDone) {
          uploadDone = true;
          return res.status(200).json({
            message: 'File uploaded successfully',
            url: imageUrl
          });
        }
      } catch (err) {
        console.error('Post-upload error:', err);
        if (!uploadDone) {
          uploadDone = true;
          return res.status(500).json({ message: 'Server error' });
        }
      }
    });
  });

  busboy.on('error', (err) => {
    console.error('Busboy error:', err);
    if (!uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'Malformed upload' });
    }
  });

  busboy.on('partsLimit', () => {
    aborted = true;
    if (!uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'Too many parts in form data' });
    }
  });

  busboy.on('filesLimit', () => {
    aborted = true;
    if (!uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'Too many files' });
    }
  });

  busboy.on('fieldsLimit', () => {
    aborted = true;
    if (!uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'Too many fields' });
    }
  });

  busboy.on('finish', () => {
    if (aborted) return;
    if (!hadFile && !uploadDone) {
      uploadDone = true;
      return res.status(400).json({ message: 'No file uploaded' });
    }
  });

  req.pipe(busboy);
});

module.exports = router;
