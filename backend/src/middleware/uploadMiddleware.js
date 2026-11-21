const multer = require('multer');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } = require('../config/cloudinary');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`INVALID_FILE_TYPE: Only JPEG, PNG, and WEBP images are allowed.`));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  },
  fileFilter
});

module.exports = {
  upload
};

