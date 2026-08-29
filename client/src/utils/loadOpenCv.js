// Loads OpenCV.js and jscanify from CDN at runtime. Both are loaded lazily so
// they never touch the build/install step (jscanify's npm package pulls native
// `canvas`/`jsdom` builds that break Heroku installs — the browser script has no
// such deps and just reads the global `cv` that OpenCV sets up).

const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';
const JSCANIFY_URL = 'https://cdn.jsdelivr.net/npm/jscanify@1.4.3/src/jscanify.js';

let openCvPromise = null;
let jscanifyPromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(script);
    });
}

export default function loadOpenCv() {
    if (openCvPromise) return openCvPromise;

    openCvPromise = new Promise((resolve, reject) => {
        if (window.cv && window.cv.Mat) {
            resolve(window.cv);
            return;
        }

        loadScript(OPENCV_URL)
            .then(() => {
                if (window.cv && window.cv.Mat) {
                    resolve(window.cv);
                } else if (window.cv) {
                    window.cv.onRuntimeInitialized = () => resolve(window.cv);
                } else {
                    reject(new Error('OpenCV failed to initialize'));
                }
            })
            .catch((err) => {
                openCvPromise = null;
                reject(err);
            });
    });

    return openCvPromise;
}

// Ensures OpenCV is ready, then loads jscanify. Resolves with the jscanify
// constructor (window.jscanify).
export function loadJscanify() {
    if (jscanifyPromise) return jscanifyPromise;

    jscanifyPromise = loadOpenCv()
        .then(() => {
            if (window.jscanify) return window.jscanify;
            return loadScript(JSCANIFY_URL).then(() => {
                if (!window.jscanify) throw new Error('jscanify failed to load');
                return window.jscanify;
            });
        })
        .catch((err) => {
            jscanifyPromise = null;
            throw err;
        });

    return jscanifyPromise;
}
