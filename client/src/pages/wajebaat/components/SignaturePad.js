import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Image } from 'cloudinary-react';
import { uploadToCloudinary, CLOUD_NAME } from '../../../utils/cloudinary';

export default function SignaturePad({ value, onChange }) {
    const sigRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(!value);
    const [empty, setEmpty] = useState(true);

    const clear = () => {
        if (sigRef.current) sigRef.current.clear();
        setEmpty(true);
    };

    const save = async () => {
        if (!sigRef.current || sigRef.current.isEmpty()) {
            setError('Please draw your signature first.');
            return;
        }
        setError('');
        setUploading(true);
        try {
            // Use getCanvas() rather than getTrimmedCanvas() — the alpha build's
            // trim-canvas import is broken ("trim_canvas... is not a function").
            const dataUrl = sigRef.current.getCanvas().toDataURL('image/png');
            const publicId = await uploadToCloudinary(dataUrl);
            onChange(publicId);
            setEditing(false);
        } catch (err) {
            console.error('Signature upload failed:', err, err?.response?.data);
            const detail = err?.response?.data?.error?.message || err?.message || 'unknown error';
            setError(`Upload failed: ${detail}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="wjFormGroup signatureGroup">
            <label>Signature</label>

            {value && !editing ? (
                <div className="signaturePreview">
                    <Image cloudName={CLOUD_NAME} publicId={value} width="300" crop="fit" alt="Signature" />
                    <button
                        type="button"
                        className="wjBtnSecondary"
                        onClick={() => {
                            setEditing(true);
                            setEmpty(true);
                        }}
                    >
                        Re-sign
                    </button>
                </div>
            ) : (
                <>
                    <div className="signatureCanvasWrap">
                        <SignatureCanvas
                            ref={sigRef}
                            penColor="#0b2545"
                            onEnd={() => setEmpty(false)}
                            canvasProps={{ className: 'signatureCanvas' }}
                        />
                    </div>
                    <div className="checkCaptureActions">
                        <button type="button" className="wjBtnSecondary" onClick={clear} disabled={uploading}>
                            Clear
                        </button>
                        <button
                            type="button"
                            className="wjBtnPrimary"
                            onClick={save}
                            disabled={uploading || empty}
                        >
                            {uploading ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                    {error && <p className="wjError">{error}</p>}
                </>
            )}
        </div>
    );
}
