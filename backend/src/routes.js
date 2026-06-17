'use strict';

const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const config = require('./config');
const { buildAuthBundle } = require('./acrcloud');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  Multer — Memory Storage
//  Keeps the uploaded audio buffer in RAM (req.file.buffer) so we can forward
//  it directly to ACRCloud without touching the filesystem.
//  Limit: 10 MB — more than enough for a 5-second clip.
// ─────────────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`), false);
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/identify-and-map
//
//  Pipeline:
//    1. Receive audio blob from React client (multipart/form-data, field: audioFile)
//    2. Sign + POST to ACRCloud /v1/identify
//    3. Parse ACRCloud response → extract title + artist
//    4. Query YouTube Data API → extract videoId
//    5. Return { title, artist, youtubeId } to client
// ─────────────────────────────────────────────────────────────────────────────
router.post('/identify-and-map', upload.single('audioFile'), async (req, res) => {
  // ── Guard: ensure a file was actually attached ──────────────────────────
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No audio file received. Send the blob under the field name "audioFile".',
    });
  }

  console.log(
    `[Pipeline] Received audio — size: ${(req.file.size / 1024).toFixed(1)} KB, ` +
    `mimetype: ${req.file.mimetype}`
  );

  // ── STEP 1: Build ACRCloud auth bundle ───────────────────────────────────
// ── STEP 2: Package multipart payload for ACRCloud ───────────────────────
const { timestamp, signature } = buildAuthBundle();

const acrForm = new FormData();
acrForm.append('sample', req.file.buffer, {
  filename:    'sample',
  contentType: req.file.mimetype,
  knownLength: req.file.size,
});
acrForm.append('access_key',        config.acr.accessKey);
acrForm.append('data_type',         config.acr.dataType);
acrForm.append('signature_version', config.acr.signatureVersion);
acrForm.append('signature',         signature);
acrForm.append('timestamp',         String(timestamp));
acrForm.append('sample_bytes',      String(req.file.size));
  // ── STEP 3: POST to ACRCloud ──────────────────────────────────────────────
  let acrData;
  try {
    console.log(`[ACRCloud] Sending request to https://${config.acr.host}${config.acr.endpoint}`);

    const acrResponse = await axios.post(
      `https://${config.acr.host}${config.acr.endpoint}`,
      acrForm,
      {
        headers: {
          ...acrForm.getHeaders(),
        },
        timeout: 15000, // 15 s — ACRCloud is generally fast; give headroom
      }
    );

    acrData = acrResponse.data;
    console.log('[ACRCloud] Raw status:', JSON.stringify(acrData.status));
  } catch (err) {
    console.error('[ACRCloud] Request failed:', err.message);
    return res.status(502).json({
      success: false,
      error: 'ACRCloud request failed. Check your ACR_HOST / network connectivity.',
      detail: err.message,
    });
  }

  // ── STEP 4: Parse ACRCloud result ─────────────────────────────────────────
  //  ACRCloud status codes:
  //    1000 = Success (match found)
  //    1001 = No result found
  //    3003 = Limit exceeded
  //    3015 = Invalid access key
  //    others = various errors

  const statusCode = acrData?.status?.code;
  const hasMusic = acrData?.metadata?.music?.length > 0;

  if (statusCode !== 1000 && !hasMusic) {
  const reason = acrData?.status?.msg || 'Unknown ACRCloud error';
  console.warn(`[ACRCloud] No match — status ${statusCode}: ${reason}`);

  return res.status(404).json({
    success: false,
    error: (statusCode === 1001 || statusCode === 0)
      ? 'No song match found. Try again with clearer audio or hold closer to the speaker.'
      : `ACRCloud returned an error: ${reason} (code ${statusCode})`,
  });
}

  const musicList = acrData?.metadata?.music;
  if (!musicList || musicList.length === 0) {
    console.warn('[ACRCloud] Status 1000 but metadata.music is empty.');
    return res.status(404).json({
      success: false,
      error: 'Match reported but no music metadata was returned.',
    });
  }

  const topMatch  = musicList[0];
  const songTitle = topMatch?.title || 'Unknown Title';
  const artist    = topMatch?.artists?.[0]?.name || 'Unknown Artist';
  const album     = topMatch?.album?.name || null;
  const score     = topMatch?.score || null;

  console.log(`[ACRCloud] ✅ Match found — "${songTitle}" by ${artist} (score: ${score})`);

  // ── STEP 5: Query YouTube Data API ────────────────────────────────────────
  const searchQuery = `${artist} ${songTitle} official audio`;
  let youtubeId     = null;

  try {
    console.log(`[YouTube] Searching for: "${searchQuery}"`);

    const ytResponse = await axios.get(config.youtube.searchUrl, {
      params: {
        key:        config.youtube.apiKey,
        q:          searchQuery,
        part:       'snippet',
        type:       'video',
        maxResults: 1,
      },
      timeout: 10000,
    });

    // ── STEP 6: Extract videoId ───────────────────────────────────────────
    youtubeId = ytResponse.data?.items?.[0]?.id?.videoId || null;

    if (youtubeId) {
      console.log(`[YouTube] ✅ Video found — ID: ${youtubeId}`);
    } else {
      console.warn('[YouTube] Search returned no video items.');
    }
  } catch (err) {
    // YouTube failure is non-fatal — we still return song metadata
    console.error('[YouTube] Request failed:', err.message);
  }

  // ── STEP 7: Return aggregated result to React client ──────────────────────
  return res.status(200).json({
    success:   true,
    title:     songTitle,
    artist:    artist,
    album:     album,
    youtubeId: youtubeId,
    score:     score,
  });
});

module.exports = router;
