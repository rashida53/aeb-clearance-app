const mongoose = require('mongoose');

const DB_OPTIONS = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
};

const clearanceDb = mongoose.createConnection(
    process.env.MONGODB_URI_CLEARANCE || 'mongodb://127.0.0.1/aeb-clearance-app',
    DB_OPTIONS
);

const fmbDb = mongoose.createConnection(
    process.env.MONGODB_URI_FMB || 'mongodb://127.0.0.1/aeb-austin-fmb',
    DB_OPTIONS
);

clearanceDb.on('error', (err) => console.error('clearanceDb connection error:', err));
fmbDb.on('error', (err) => console.error('fmbDb connection error:', err));

module.exports = { clearanceDb, fmbDb };
