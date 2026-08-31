import axios from 'axios';

// Public by nature — the cloud name and unsigned upload preset ship in the
// client bundle regardless (same as the FMB dish upload). No secrets here:
// image deletion is done server-side where the API secret lives in an env var.
const CLOUD_NAME = 'dbnbsbmwv';
const UPLOAD_PRESET = 'weumsenv';

/**
 * Upload a file/blob/data-URL to Cloudinary using the shared unsigned preset.
 * Returns the Cloudinary public_id (what we persist in Mongo), or throws.
 */
export async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const { data } = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData
    );

    if (!data || !data.public_id) {
        throw new Error('Cloudinary upload failed');
    }
    return data.public_id;
}

export { CLOUD_NAME };
