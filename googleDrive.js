const fs = require('fs');
const { google } = require('googleapis');

// Replace these values with your actual credentials or load them securely (e.g., from env vars).
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI = 'YOUR_OAUTH2_REDIRECT_URI';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Optionally set refresh token if you already have it
// oauth2Client.setCredentials({ refresh_token: 'YOUR_REFRESH_TOKEN' });

/**
 * Upload file to Google Drive
 * @param {string} filePath - path to the file on local disk
 * @param {string} mimeType - the MIME type of the file (e.g., 'image/jpeg')
 * @param {string} folderId - (Optional) ID of a folder in Google Drive
 */
async function uploadFile(filePath, mimeType, folderId = null) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const fileMetadata = {
    name: filePath.split('/').pop(),
  };

  // If you want to place the file in a specific folder
  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink',
  });

  return response.data; // e.g. { id: '...', webViewLink: '...', webContentLink: '...' }
}

/**
 * Get file metadata or download link from Google Drive
 * @param {string} fileId - the file ID in Google Drive
 */
async function getFile(fileId) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Retrieve file metadata
  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, webViewLink, webContentLink',
  });

  return response.data;
}

module.exports = {
  oauth2Client,
  uploadFile,
  getFile,
};
