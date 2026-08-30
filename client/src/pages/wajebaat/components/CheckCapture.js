import React, { useRef, useState } from 'react';
import { Image } from 'cloudinary-react';
import { uploadToCloudinary, CLOUD_NAME } from '../../../utils/cloudinary';

export default function CheckCapture({ value, onChange }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    const handleUpload = async (file) => {
        if (!file) return;
        setError('');
        setUploading(true);
        try {
            const publicId = await uploadToCloudinary(file);
            onChange(publicId);
        } catch (err) {
            setError('Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="wjFormGroup">
            <label>Voided Check</label>

            {value ? (
                <div className="checkPreview">
                    <Image cloudName={CLOUD_NAME} publicId={value} width="240" crop="fill" alt="Check" />
                </div>
            ) : (
                <p className="checkHint">Upload a photo of your check.</p>
            )}

            <div className="checkCaptureActions">
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => handleUpload(e.target.files[0])}
                />
                <button
                    type="button"
                    className="wjBtnSecondary"
                    onClick={() => fileRef.current && fileRef.current.click()}
                    disabled={uploading}
                >
                    {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
                </button>
            </div>

            {error && <p className="wjError">{error}</p>}
        </div>
    );
}
