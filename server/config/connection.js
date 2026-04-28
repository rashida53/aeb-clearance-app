const mongoose = require('mongoose');

const clearanceDb = mongoose.createConnection(
    process.env.MONGODB_URI_CLEARANCE || 'mongodb://127.0.0.1/aeb-clearance-app'
);

const fmbDb = mongoose.createConnection(
    process.env.MONGODB_URI_FMB || 'mongodb://127.0.0.1/aeb-austin-fmb'
);

clearanceDb.on('error', (err) => console.error('clearanceDb connection error:', err));
fmbDb.on('error', (err) => console.error('fmbDb connection error:', err));

module.exports = { clearanceDb, fmbDb };
