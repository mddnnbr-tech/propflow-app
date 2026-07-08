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
  const base = process.env.BACKEND_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
    || 'http://localhost:5000';
  return `${base}/uploads/${relativePath}`;
}

module.exports = { getFileUrl };
