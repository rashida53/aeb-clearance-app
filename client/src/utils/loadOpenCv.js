// Loads OpenCV.js from CDN once and resolves when the `cv` runtime is ready.
// jscanify depends on the global `cv` object, so we must await this before
// constructing a scanner.

const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

let loaderPromise = null;

export default function loadOpenCv() {
    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise((resolve, reject) => {
        if (window.cv && window.cv.Mat) {
            resolve(window.cv);
            return;
        }

        const script = document.createElement('script');
        script.src = OPENCV_URL;
        script.async = true;
        script.onload = () => {
            // opencv.js sets up asynchronously; `onRuntimeInitialized` fires when ready.
            if (window.cv && window.cv.Mat) {
                resolve(window.cv);
            } else if (window.cv) {
                window.cv.onRuntimeInitialized = () => resolve(window.cv);
            } else {
                reject(new Error('OpenCV failed to load'));
            }
        };
        script.onerror = () => {
            loaderPromise = null;
            reject(new Error('Failed to load OpenCV.js'));
        };
        document.body.appendChild(script);
    });

    return loaderPromise;
}
