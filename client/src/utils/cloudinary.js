import axios from 'axios';

const CLOUD_NAME = process.env.REACT_APP_CLOUD_NAME;
const UPLOAD_PRESET = process.env.REACT_APP_UPLOAD_PRESET;

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
