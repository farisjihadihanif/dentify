'use strict';

/**
 * DentHub End-to-End Smoke Test.
 *
 * Usage:
 *   BACKEND_URL=http://localhost:5000/api/v1 \
 *   AI_SERVICE_URL=http://localhost:8000 \
 *   AI_SERVICE_API_KEY=<key> \
 *   FRONTEND_ORIGIN=http://localhost:3000 \
 *   TEST_IMAGE_PATH=data-science/data/processed/test/caries/<sample>.jpg \
 *   node scripts/e2e-smoke.js
 */

const assert = require('node:assert');
const fs = require('node:fs');

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || '';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const TEST_IMAGE_PATH = process.env.TEST_IMAGE_PATH || '';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      Origin: FRONTEND_ORIGIN,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    data,
  };
}

async function runLiveSmokeTest() {
  console.log(`[1/6] Checking AI Service (${AI_SERVICE_URL}/internal/health)...`);
  const aiHealth = await fetchJson(`${AI_SERVICE_URL}/internal/health`, {
    headers: { 'X-Internal-Key': AI_SERVICE_API_KEY },
  });
  assert.strictEqual(aiHealth.status, 200, 'AI Service /internal/health must return 200');
  assert.strictEqual(aiHealth.data?.model_loaded, true, 'AI model must be loaded');
  console.log(`      OK (model_version=${aiHealth.data.model_version})`);

  console.log(`[2/6] Checking Backend & CORS (${BACKEND_URL}/health)...`);
  const beHealth = await fetchJson(`${BACKEND_URL}/health`);
  assert.strictEqual(beHealth.status, 200, 'Backend /api/v1/health must return 200');
  assert.strictEqual(beHealth.data?.success, true);
  assert.strictEqual(
    beHealth.headers.get('access-control-allow-origin'),
    FRONTEND_ORIGIN,
    `CORS must allow ${FRONTEND_ORIGIN}`,
  );
  console.log('      OK');

  const uniqueEmail = `smoke.${Date.now()}@denthub.local`;
  const password = 'SmokeTestPassword123!';

  console.log('[3/6] Checking Auth (/auth/register, /auth/me)...');
  const regRes = await fetchJson(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'DentHub Smoke Tester',
      email: uniqueEmail,
      password,
      role: 'admin',
    }),
  });
  assert.strictEqual(regRes.status, 201);
  assert.strictEqual(regRes.data?.data?.user?.role, 'user', 'Register must force role="user"');
  const token = regRes.data.data.token;

  const meRes = await fetchJson(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meRes.data?.data?.user?.email, uniqueEmail);
  console.log('      OK');

  let scanId = null;
  if (TEST_IMAGE_PATH && fs.existsSync(TEST_IMAGE_PATH)) {
    console.log(`[4/6] Checking AI Dental Screening (POST ${BACKEND_URL}/scans)...`);
    const imgBuf = fs.readFileSync(TEST_IMAGE_PATH);
    const form = new FormData();
    form.append('image', new Blob([imgBuf], { type: 'image/jpeg' }), 'smoke.jpg');
    form.append('capture_source', 'camera');
    form.append('user_symptoms', 'Gigi geraham berdenyut sejak semalam');

    const scanRes = await fetchJson(`${BACKEND_URL}/scans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    assert.strictEqual(scanRes.status, 201);
    assert.ok(scanRes.data?.data?.id);
    assert.ok(scanRes.data?.data?.medical_disclaimer);
    assert.ok(Array.isArray(scanRes.data?.data?.care_recommendations?.dos));
    scanId = scanRes.data.data.id;
    console.log(
      `      OK (condition=${scanRes.data.data.primary_condition}, urgency=${scanRes.data.data.urgency_level})`,
    );
  } else {
    console.log('[4/6] Skipping POST /scans (set TEST_IMAGE_PATH to a >=224px dental photo to run).');
  }

  console.log(`[5/6] Checking Deni Consultation (POST ${BACKEND_URL}/chat)...`);
  const chatRes = await fetchJson(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...(scanId ? { scan_id: scanId } : {}),
      message: 'Gigi saya berdenyut dan pipi bengkak, apa yang harus saya lakukan?',
    }),
  });
  assert.strictEqual(chatRes.status, 200);
  assert.strictEqual(chatRes.data?.data?.urgency_level, 'emergency');
  assert.strictEqual(chatRes.data?.data?.trigger_clinic_finder, true);
  assert.ok(chatRes.data?.data?.medical_disclaimer);
  console.log('      OK (emergency trigger_clinic_finder=true verified)');

  console.log(`[6/6] Checking Clinic Finder (GET ${BACKEND_URL}/clinics)...`);
  const clinicsRes = await fetchJson(
    `${BACKEND_URL}/clinics?lat=-7.795580&lng=110.369490&radius_km=5`,
  );
  assert.strictEqual(clinicsRes.status, 200);
  assert.ok(['openstreetmap', 'fallback'].includes(clinicsRes.data?.source));
  assert.ok(Array.isArray(clinicsRes.data?.data));
  console.log(`      OK (source=${clinicsRes.data.source}, count=${clinicsRes.data.data.length})`);

  console.log('\nE2E SMOKE TEST PASSED 100%.');
}

if (require.main === module) {
  runLiveSmokeTest().catch((err) => {
    console.error('\n[FAILED] E2E smoke test error:', err.message);
    process.exit(1);
  });
}

module.exports = { runLiveSmokeTest };
