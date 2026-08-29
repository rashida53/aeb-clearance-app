import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Image } from 'cloudinary-react';
import jscanify from 'jscanify/client';
import loadOpenCv from '../../../utils/loadOpenCv';
import { uploadToCloudinary, CLOUD_NAME } from '../../../utils/cloudinary';

// Cap the working resolution for detection + extraction. Detection and capture
// share one canvas so corner coordinates line up between the two.
const MAX_W = 960;
// Frames the paper must stay still + large before we auto-snap (~0.6s at 20fps).
const STABLE_FRAMES = 14;
// Max per-corner movement (px) between frames to count as "still".
const STABLE_EPS = 9;
// Paper must fill at least this fraction of the frame to auto-capture.
const MIN_AREA_RATIO = 0.35;

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function cornersValid(c) {
    return c && c.topLeftCorner && c.topRightCorner && c.bottomLeftCorner && c.bottomRightCorner;
}

function polygonArea(c) {
    const pts = [c.topLeftCorner, c.topRightCorner, c.bottomRightCorner, c.bottomLeftCorner];
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        area += p1.x * p2.y - p2.x * p1.y;
    }
    return Math.abs(area) / 2;
}

function CheckScanner({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const scannerRef = useRef(null);
    const rafRef = useRef(null);
    const lastCornersRef = useRef(null);
    const stableRef = useRef(0);
    const capturedRef = useRef(false);

    const [status, setStatus] = useState('Loading scanner…');
    const [ready, setReady] = useState(false);
    const [detected, setDetected] = useState(false);

    const finishCapture = useCallback(async (corners) => {
        if (capturedRef.current) return;
        capturedRef.current = true;
        cancelAnimationFrame(rafRef.current);
        setStatus('Capturing…');

        const canvas = canvasRef.current;
        const c = corners;
        const w = Math.round(
            (distance(c.topLeftCorner, c.topRightCorner) +
                distance(c.bottomLeftCorner, c.bottomRightCorner)) / 2
        );
        const h = Math.round(
            (distance(c.topLeftCorner, c.bottomLeftCorner) +
                distance(c.topRightCorner, c.bottomRightCorner)) / 2
        );

        try {
            const resultCanvas = scannerRef.current.extractPaper(canvas, w || canvas.width, h || canvas.height, c);
            const target = resultCanvas || canvas;
            target.toBlob((blob) => {
                onCapture(blob);
            }, 'image/jpeg', 0.9);
        } catch (err) {
            // Fall back to the raw frame if the perspective warp fails.
            canvas.toBlob((blob) => onCapture(blob), 'image/jpeg', 0.9);
        }
    }, [onCapture]);

    const tick = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const cv = window.cv;
        if (!video || !canvas || !cv || capturedRef.current) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const scale = Math.min(1, MAX_W / video.videoWidth);
            const w = Math.round(video.videoWidth * scale);
            const h = Math.round(video.videoHeight * scale);
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, w, h);

            let corners = null;
            try {
                const src = cv.imread(canvas);
                const contour = scannerRef.current.findPaperContour(src);
                if (contour) {
                    corners = scannerRef.current.getCornerPoints(contour);
                }
                src.delete();
            } catch (err) {
                corners = null;
            }

            const frameArea = w * h;
            const bigEnough =
                cornersValid(corners) && polygonArea(corners) / frameArea >= MIN_AREA_RATIO;

            if (bigEnough) {
                setDetected(true);
                // Draw the detected outline.
                ctx.strokeStyle = '#c9a227';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(corners.topLeftCorner.x, corners.topLeftCorner.y);
                ctx.lineTo(corners.topRightCorner.x, corners.topRightCorner.y);
                ctx.lineTo(corners.bottomRightCorner.x, corners.bottomRightCorner.y);
                ctx.lineTo(corners.bottomLeftCorner.x, corners.bottomLeftCorner.y);
                ctx.closePath();
                ctx.stroke();

                const prev = lastCornersRef.current;
                let moved = Infinity;
                if (prev) {
                    moved = Math.max(
                        distance(prev.topLeftCorner, corners.topLeftCorner),
                        distance(prev.topRightCorner, corners.topRightCorner),
                        distance(prev.bottomLeftCorner, corners.bottomLeftCorner),
                        distance(prev.bottomRightCorner, corners.bottomRightCorner)
                    );
                }
                lastCornersRef.current = corners;

                if (moved < STABLE_EPS) {
                    stableRef.current += 1;
                    setStatus('Hold steady…');
                    if (stableRef.current >= STABLE_FRAMES) {
                        finishCapture(corners);
                        return;
                    }
                } else {
                    stableRef.current = 0;
                    setStatus('Check detected — hold steady');
                }
            } else {
                setDetected(false);
                stableRef.current = 0;
                lastCornersRef.current = null;
                setStatus('Point the camera at your check');
            }
        }

        rafRef.current = requestAnimationFrame(tick);
    }, [finishCapture]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                await loadOpenCv();
                if (cancelled) return;
                scannerRef.current = new jscanify();

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false,
                });
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                const video = videoRef.current;
                video.srcObject = stream;
                await video.play();
                setReady(true);
                setStatus('Point the camera at your check');
                rafRef.current = requestAnimationFrame(tick);
            } catch (err) {
                if (!cancelled) {
                    setStatus(
                        err && err.name === 'NotAllowedError'
                            ? 'Camera permission denied.'
                            : 'Unable to start the camera.'
                    );
                }
            }
        })();

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, [tick]);

    const handleManualCapture = () => {
        if (lastCornersRef.current && cornersValid(lastCornersRef.current)) {
            finishCapture(lastCornersRef.current);
        } else if (canvasRef.current) {
            capturedRef.current = true;
            cancelAnimationFrame(rafRef.current);
            canvasRef.current.toBlob((blob) => onCapture(blob), 'image/jpeg', 0.9);
        }
    };

    return (
        <div className="modalOverlay">
            <div className="checkScannerModal">
                <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
                <canvas ref={canvasRef} className="checkScannerCanvas" />
                <p className={`checkScannerStatus ${detected ? 'detected' : ''}`}>{status}</p>
                <div className="checkScannerActions">
                    <button type="button" className="wjBtnSecondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="wjBtnPrimary"
                        onClick={handleManualCapture}
                        disabled={!ready}
                    >
                        Capture now
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CheckCapture({ value, onChange }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [scanning, setScanning] = useState(false);
    const fileRef = useRef(null);

    const isMobile =
        typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

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

    const handleScanCapture = async (blob) => {
        setScanning(false);
        if (blob) await handleUpload(blob);
    };

    return (
        <div className="wjFormGroup">
            <label>Voided Check</label>

            {value ? (
                <div className="checkPreview">
                    <Image cloudName={CLOUD_NAME} publicId={value} width="240" crop="fill" alt="Check" />
                </div>
            ) : (
                <p className="checkHint">Upload or scan a photo of your check.</p>
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
                {isMobile && (
                    <button
                        type="button"
                        className="wjBtnPrimary"
                        onClick={() => setScanning(true)}
                        disabled={uploading}
                    >
                        Scan check
                    </button>
                )}
            </div>

            {error && <p className="wjError">{error}</p>}

            {scanning && (
                <CheckScanner onCapture={handleScanCapture} onClose={() => setScanning(false)} />
            )}
        </div>
    );
}
