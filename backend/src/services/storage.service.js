const path = require('path');

// Returns a public URL for an uploaded file.
// In dev: serves from /uploads via Express static.
// In prod (S3): returns the S3 URL.
function getFileUrl(file) {
  if (!file) return null;

  if (process.env.STORAGE_DRIVER === 's3') {
    // When using multer-s3 the file.location is set automatically
    return file.location || null;
  }

  // Local: build URL relative to Express static /uploads route
  const uploadsDir = path.join(__dirname, '../../uploads');
  const relativePath = path.relative(uploadsDir, file.path).replace(/\\/g, '/');
  return `${process.env.FRONTEND_URL?.replace(':3000', ':5000') || 'http://localhost:5000'}/uploads/${relativePath}`;
}

module.exports = { getFileUrl };
