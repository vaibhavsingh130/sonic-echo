'use strict';

const crypto = require('crypto');
const config = require('./config');

// ─────────────────────────────────────────────────────────────────────────────
//  acrcloud.js
//  Handles all ACRCloud-specific authentication math and API communication.
//
//  ACRCloud Signature Protocol:
//    1. Build a canonical string from fixed fields + current Unix timestamp.
//    2. HMAC-SHA1 sign it with the Access Secret.
//    3. Base64-encode the raw digest.
//    4. Attach the result alongside the Access Key in every request.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a Unix epoch timestamp (seconds, not milliseconds).
 * @returns {number}
 */
function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Builds the canonical signing string required by ACRCloud.
 *
 * Layout (fields joined by '\n'):
 *   HTTP_METHOD
 *   HTTP_URI
 *   ACCESS_KEY
 *   DATA_TYPE
 *   SIGNATURE_VERSION
 *   TIMESTAMP
 *
 * @param {number} timestamp - Unix epoch in seconds
 * @returns {string}
 */
function buildStringToSign(timestamp) {
  const { endpoint, accessKey, dataType, signatureVersion } = config.acr;

  return [
    'POST',
    endpoint,
    accessKey,
    dataType,
    signatureVersion,
    String(timestamp),
  ].join('\n');
}

/**
 * Computes the HMAC-SHA1 Base64 signature.
 *
 * @param {string} stringToSign
 * @returns {string} Base64-encoded signature
 */
function computeSignature(stringToSign) {
  return crypto
    .createHmac('sha1', config.acr.accessSecret)
    .update(stringToSign)
    .digest('base64');
}

/**
 * Returns a fully-prepared { timestamp, signature } auth bundle.
 * Call this immediately before every outbound request to ACRCloud so the
 * timestamp is always fresh (their servers reject stale signatures).
 *
 * @returns {{ timestamp: number, signature: string }}
 */
function buildAuthBundle() {
  const timestamp = getTimestamp();
  const stringToSign = buildStringToSign(timestamp);
  const signature = computeSignature(stringToSign);

  return { timestamp, signature };
}

module.exports = { buildAuthBundle };
