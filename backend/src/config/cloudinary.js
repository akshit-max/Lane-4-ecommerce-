const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const { config } = require('./environment');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_ROOT = path.resolve(__dirname, '../../../uploads');

function saveToLocalUploads(buffer, folder, extension) {
  try {
    const dir = path.join(UPLOADS_ROOT, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const fileId = uuidv4();
    const filename = `${fileId}.${extension}`;
    fs.writeFileSync(path.join(dir, filename), buffer);
    return `/uploads/${folder}/${filename}`;
  } catch (err) {
    logger.warn('Could not save file to local uploads directory:', err);
    return null;
  }
}

const isConfigured = Boolean(
  config.cloudinary.cloudName &&
  config.cloudinary.apiKey &&
  config.cloudinary.apiSecret
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true
  });
  logger.info('Cloudinary initialized successfully', { cloudName: config.cloudinary.cloudName });
} else {
  logger.warn('Cloudinary credentials not configured. File uploads will use local mock storage until credentials are provided in .env.');
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upload a memory buffer to Cloudinary with reliable local fallback
 */
async function uploadImageBuffer(buffer, options = {}) {
  const { folder = 'products', mimeType = 'image/jpeg', isPrivate = false } = options;

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`INVALID_FORMAT: File type ${mimeType} is not supported. Allowed formats: JPEG, PNG, WEBP.`);
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`FILE_TOO_LARGE: Upload exceeds maximum allowed size of 5 MB.`);
  }

  const publicId = `${config.cloudinary.folderPrefix}/${folder}/${uuidv4()}`;
  const ext = mimeType.split('/')[1] || 'jpeg';

  if (config.env === 'test' || process.env.NODE_ENV === 'test') {
    // Deterministic mock for test runner
    const base64 = buffer.toString('base64');
    const mockUrl = `data:${mimeType};base64,${base64}`;
    logger.warn('Cloudinary unconfigured: Storing image as data URI representation for testing', { publicId });
    return {
      publicId,
      secureUrl: mockUrl,
      format: ext,
      bytes: buffer.length
    };
  }

  if (!isConfigured) {
    const localUrl = saveToLocalUploads(buffer, folder, ext);
    const resultUrl = localUrl || `data:${mimeType};base64,${buffer.toString('base64')}`;
    logger.info('Cloudinary unconfigured: Stored uploaded file in local storage', { path: resultUrl });
    return {
      publicId,
      secureUrl: resultUrl,
      format: ext,
      bytes: buffer.length,
      isLocal: true
    };
  }

  return new Promise((resolve) => {
    const uploadOptions = {
      public_id: publicId,
      resource_type: 'image',
      overwrite: true
    };

    if (isPrivate) {
      uploadOptions.type = 'authenticated';
    }

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        // Save file locally to ensure checkout / proof is never blocked by Cloudinary permission issues
        const localUrl = saveToLocalUploads(buffer, folder, ext);
        if (localUrl) {
          logger.warn(`Cloudinary upload returned status ${error.http_code || 403} (${error.message || 'missing permissions'}). File safely saved to local storefront storage: ${localUrl}`);
          return resolve({
            publicId,
            secureUrl: localUrl,
            format: ext,
            bytes: buffer.length,
            isLocal: true
          });
        }

        const base64 = buffer.toString('base64');
        const fallbackUrl = `data:${mimeType};base64,${base64}`;
        return resolve({
          publicId,
          secureUrl: fallbackUrl,
          format: ext,
          bytes: buffer.length,
          isFallback: true
        });
      }

      resolve({
        publicId: result.public_id,
        secureUrl: result.secure_url,
        format: result.format,
        bytes: result.bytes
      });
    });

    stream.end(buffer);
  });
}

/**
 * Delete asset from Cloudinary
 */
async function deleteImage(publicId) {
  if (!isConfigured || !publicId) {
    return { result: 'ok' };
  }

  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.error('Failed to delete image from Cloudinary', err);
    throw err;
  }
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured: () => isConfigured,
  uploadImageBuffer,
  deleteImage,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES
};

