'use strict';

require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
//  config.js
//  Central configuration module. Loads environment variables once at startup
//  and validates that every required key is present. The server will refuse to
//  boot rather than silently run with missing credentials.
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_KEYS = [
  'ACR_HOST',
  'ACR_ACCESS_KEY',
  'ACR_SECRET',
  'YOUTUBE_API_KEY',
];

const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    '\n[Config] ❌  Missing required environment variables:\n  ' +
      missing.join('\n  ') +
      '\n\nCopy .env.example → .env and fill in all values.\n'
  );
  process.exit(1);
}

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,

  // ACRCloud
  acr: {
    host: process.env.ACR_HOST,
    accessKey: process.env.ACR_ACCESS_KEY,
    accessSecret: process.env.ACR_SECRET,
    endpoint: '/v1/identify',
    dataType: 'audio',
    signatureVersion: '1',
  },

  // YouTube Data API v3
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
    searchUrl: 'https://www.googleapis.com/youtube/v3/search',
  },

  // CORS
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};

module.exports = config;
