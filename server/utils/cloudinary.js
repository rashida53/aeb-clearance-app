const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Deletes an image from Cloudinary by its public_id. No-ops on empty ids and
// swallows "not found" so a missing image never blocks the record deletion.
async function destroyImage(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error('Cloudinary destroy error:', publicId, err.message);
    }
}

module.exports = { cloudinary, destroyImage };
