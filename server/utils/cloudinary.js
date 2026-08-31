const cloudinary = require('cloudinary').v2;

// Cloud name is public; the API key/secret are secrets and must come from env
// vars (never committed). Deletion is done here, server-side, so the secret
// never reaches the client bundle.
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dbnbsbmwv',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Deletes an image from Cloudinary by its public_id. No-ops on empty ids and
// swallows errors so a missing image never blocks the record deletion.
async function destroyImage(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error('Cloudinary destroy error:', publicId, err.message);
    }
}

module.exports = { cloudinary, destroyImage };
