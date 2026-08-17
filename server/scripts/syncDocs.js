require('dotenv').config();
const { google } = require('googleapis');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { clearanceDb } = require('../config/connection');
const { getEmbeddings } = require('../agent/rag/embeddings');
const { COLLECTION } = require('../agent/rag/vectorStore');

// One or more comma-separated Drive folder ids to ingest.
function folderIds() {
    return (process.env.GOOGLE_DRIVE_FOLDER_ID || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

// File types we extract text from (Docs for now, plus plain text/markdown/json).
const SUPPORTED = new Set([
    'application/vnd.google-apps.document',
    'text/plain',
    'text/markdown',
    'application/json',
]);

// Drive has no "all descendants" query: list a folder's direct children, and
// recurse into any child that is itself a folder. Walks every root + subfolder
// and returns the supported document files, de-duped by id.
async function listChildren(drive, folderId) {
    const files = [];
    let pageToken;
    do {
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
            pageSize: 1000,
            pageToken,
        });
        files.push(...(res.data.files || []));
        pageToken = res.data.nextPageToken;
    } while (pageToken);
    return files;
}

async function collectDocs(drive, rootIds) {
    const docs = [];
    const seenFiles = new Set();
    const seenFolders = new Set();
    const queue = [...rootIds];
    while (queue.length) {
        const folderId = queue.shift();
        if (seenFolders.has(folderId)) continue;
        seenFolders.add(folderId);
        for (const f of await listChildren(drive, folderId)) {
            if (f.mimeType === 'application/vnd.google-apps.folder') {
                queue.push(f.id);
            } else if (SUPPORTED.has(f.mimeType) && !seenFiles.has(f.id)) {
                seenFiles.add(f.id);
                docs.push(f);
            }
        }
    }
    return docs;
}

// Authenticate as the service account. GOOGLE_SERVICE_ACCOUNT_JSON is either the
// inline key JSON (best for Heroku) or a path to the key file (local dev).
function getAuth() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set in server/.env');
    const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
    if (raw.trim().startsWith('{')) {
        return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes });
    }
    return new google.auth.GoogleAuth({ keyFile: raw, scopes });
}

// Pull the plain text out of a Drive file. Google Docs are exported to text;
// plain-text/markdown files are downloaded as-is; everything else is skipped.
async function getText(drive, file) {
    if (file.mimeType === 'application/vnd.google-apps.document') {
        const r = await drive.files.export(
            { fileId: file.id, mimeType: 'text/plain' },
            { responseType: 'text' }
        );
        return r.data;
    }
    if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
        const r = await drive.files.get(
            { fileId: file.id, alt: 'media' },
            { responseType: 'text' }
        );
        return r.data;
    }
    return null;
}

async function main() {
    const roots = folderIds();
    if (!roots.length) {
        throw new Error(
            'GOOGLE_DRIVE_FOLDER_ID is not set in server/.env (one or more comma-separated folder ids)'
        );
    }

    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 800, chunkOverlap: 100 });
    const embeddings = getEmbeddings();

    await clearanceDb.asPromise();
    const coll = clearanceDb.db.collection(COLLECTION);

    const files = await collectDocs(drive, roots);
    console.log(
        `Found ${files.length} document(s) across ${roots.length} root folder(s), including subfolders.`
    );

    let embedded = 0;
    let skipped = 0;
    for (const file of files) {
        // Skip unchanged files (re-embedding is the expensive, credit-using step).
        const existing = await coll.findOne({ fileId: file.id }, { projection: { modifiedTime: 1 } });
        if (existing && existing.modifiedTime === file.modifiedTime) {
            skipped++;
            continue;
        }

        const text = await getText(drive, file);
        if (!text || !text.trim()) {
            console.log(`  · skip "${file.name}" (no extractable text)`);
            continue;
        }

        const chunks = await splitter.splitText(text);
        const vectors = await embeddings.embedDocuments(chunks);

        // Replace this file's chunks wholesale (simplest correct re-sync).
        await coll.deleteMany({ fileId: file.id });
        if (chunks.length) {
            await coll.insertMany(
                chunks.map((t, i) => ({
                    text: t,
                    embedding: vectors[i],
                    source: file.name,
                    fileId: file.id,
                    modifiedTime: file.modifiedTime,
                    chunk: i,
                }))
            );
        }
        embedded++;
        console.log(`  ✓ "${file.name}" → ${chunks.length} chunk(s)`);
    }

    console.log(`Done. Re-embedded ${embedded} file(s), skipped ${skipped} unchanged.`);
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('syncDocs error:', err.message);
            process.exit(1);
        });
}

module.exports = { main };
