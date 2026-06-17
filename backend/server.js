'use strict';

const express = require('express');
const cors    = require('cors');
const config  = require('./src/config');
const router  = require('./src/routes');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Routes ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status:    'ok',
    service:   'audiorecog-backend',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', router);

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err.stack || err.message);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'Audio file too large. Maximum size is 10 MB.',
    });
  }

  if (err.message?.startsWith('Unsupported audio type')) {
    return res.status(415).json({
      success: false,
      error: err.message,
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error.',
  });
});

// ── Boot ──────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log('\n──────────────────────────────────────────');
  console.log(`  🎵  AudioRecog Backend`);
  console.log(`  🚀  Listening on http://localhost:${config.port}`);
  console.log(`  🌐  CORS origin: ALL (dev mode)`);
  console.log(`  🔑  ACR Host: ${config.acr.host}`);
  console.log('──────────────────────────────────────────\n');
});

module.exports = app;