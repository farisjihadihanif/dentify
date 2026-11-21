import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ChatSession, DentalKnowledge, ScanRecord, User } from '../src/models';
import { DISCLAIMER_SCAN } from '../src/constants/domain';
import { runSeed } from '../src/scripts/seed';
import * as aiClient from '../src/services/aiServiceClient';
import { ApiError } from '../src/utils/ApiError';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb';

function makePngBuffer(width: number, height: number): Buffer {
  // Minimal valid PNG signature + IHDR chunk (24 bytes) + IEND chunk
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe('Scan endpoints, upload validation, and ownership isolation', () => {
  beforeAll(async () => {
    await setupTestDb();
    await Promise.all([
      User.syncIndexes(),
      ScanRecord.syncIndexes(),
      ChatSession.syncIndexes(),
      DentalKnowledge.syncIndexes(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    await runSeed();
    vi.restoreAllMocks();
  });

  async function registerUser(email: string) {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send({
      full_name: 'Tester User',
      email,
      password: 'PasswordKuat123!',
    });
    return { token: res.body.data.token as string, userId: res.body.data.user.id as string };
  }

  it('rejects > 5 MB upload with 413 PAYLOAD_TOO_LARGE', async () => {
    const app = createApp();
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1024, 0x41);
    const res = await request(app)
      .post('/api/v1/scans')
      .field('capture_source', 'upload')
      .attach('image', oversized, { filename: 'huge.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects non-image payload disguised as .jpg with 422 INVALID_IMAGE', async () => {
    const app = createApp();
    const fakeImg = Buffer.from('not really an image file at all', 'utf-8');
    const res = await request(app)
      .post('/api/v1/scans')
      .field('capture_source', 'upload')
      .attach('image', fakeImg, { filename: 'fake.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_IMAGE');
  });

  it('accepts small valid image (24x24) and returns 201 with calculus label & is_low_confidence flag without 422 rejection', async () => {
    vi.spyOn(aiClient, 'requestDentalPrediction').mockResolvedValueOnce({
      primary_condition: 'calculus',
      confidence_score: 0.52,
      is_low_confidence: true,
      probabilities: { caries: 0.18, calculus: 0.52, gingivitis: 0.22, healthy: 0.08 },
      detections: [{ label: 'calculus', confidence: 0.52, bbox: [4, 4, 16, 16] }],
      urgency_level: 'medium',
      trigger_clinic_finder: false,
      quality: { blur_score: 42.0, mean_luminance: 108.0, passed: true },
      model_version: 'denthub-mobilenetv2-2.0.0',
    });

    const app = createApp();
    const smallPng = makePngBuffer(24, 24);
    const res = await request(app)
      .post('/api/v1/scans')
      .field('capture_source', 'upload')
      .attach('image', smallPng, { filename: 'small-calculus.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.primary_condition).toBe('calculus');
    expect(res.body.data.condition_label).toBe('Indikasi Karang Gigi & Plak (Kalkulus Dental)');
    expect(res.body.data.is_low_confidence).toBe(true);
    expect(res.body.data.care_recommendations.dos.length).toBeGreaterThan(0);
  });

  it('sniffs actual binary magic headers even when filename extension is mismatched (.webp with PNG bytes)', async () => {
    vi.spyOn(aiClient, 'requestDentalPrediction').mockResolvedValueOnce({
      primary_condition: 'caries',
      confidence_score: 0.87,
      probabilities: { caries: 0.87, calculus: 0.05, gingivitis: 0.05, healthy: 0.03 },
      detections: [{ label: 'caries', confidence: 0.87, bbox: [10, 10, 50, 50] }],
      urgency_level: 'emergency',
      trigger_clinic_finder: true,
      quality: { blur_score: 95.0, mean_luminance: 100.0, passed: true },
      model_version: 'denthub-mobilenetv2-2.0.0',
    });

    const app = createApp();
    const pngBytes = makePngBuffer(180, 180);
    const res = await request(app)
      .post('/api/v1/scans')
      .field('capture_source', 'upload')
      .attach('image', pngBytes, {
        filename: 'gigi karies.webp',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.primary_condition).toBe('caries');
  });

  it('passes through 422 LOW_QUALITY_IMAGE from AI service quality gate', async () => {
    vi.spyOn(aiClient, 'requestDentalPrediction').mockRejectedValueOnce(
      new ApiError(422, 'LOW_QUALITY_IMAGE', 'Foto terlalu buram.'),
    );

    const app = createApp();
    const validPng = makePngBuffer(320, 320);
    const res = await request(app)
      .post('/api/v1/scans')
      .field('capture_source', 'camera')
      .attach('image', validPng, { filename: 'blurry.png', contentType: 'image/png' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('LOW_QUALITY_IMAGE');
  });

  it('maps 422 NOT_DENTAL_IMAGE from AI service to canonical Indonesian 422 response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: {
            code: 'NOT_DENTAL_IMAGE',
            message: 'Gambar bukan foto gigi.',
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const app = createApp();
    const validPng = makePngBuffer(320, 320);
    const res = await request(app)
      .post('/api/v1/scans')
      .field('capture_source', 'upload')
      .attach('image', validPng, { filename: 'plant.png', contentType: 'image/png' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NOT_DENTAL_IMAGE');
    expect(res.body.message).toBe(
      'Foto yang diunggah bukan foto gigi atau rongga mulut. Unggah foto gigi yang terlihat jelas untuk memulai pemindaian.',
    );
  });

  it('supports guest quick mode (saved: false) and authenticated emergency scan (saved: true, trigger_clinic_finder: true)', async () => {
    vi.spyOn(aiClient, 'requestDentalPrediction').mockResolvedValue({
      primary_condition: 'caries',
      confidence_score: 0.91,
      probabilities: { caries: 0.91, calculus: 0.04, gingivitis: 0.03, healthy: 0.02 },
      detections: [{ label: 'caries', confidence: 0.91, bbox: [120, 145, 84, 76] }],
      urgency_level: 'emergency',
      trigger_clinic_finder: true,
      quality: { blur_score: 190.5, mean_luminance: 128.0, passed: true },
      model_version: 'denthub-cnn-1.0.0',
    });

    const app = createApp();
    const validPng = makePngBuffer(512, 512);

    // Guest quick mode
    const guestRes = await request(app)
      .post('/api/v1/scans')
      .field('capture_source', 'upload')
      .attach('image', validPng, { filename: 'tooth.png', contentType: 'image/png' });

    expect(guestRes.status).toBe(201);
    expect(guestRes.body.success).toBe(true);
    expect(guestRes.body.data.saved).toBe(false);
    expect(guestRes.body.data.trigger_clinic_finder).toBe(true);
    expect(guestRes.body.data.medical_disclaimer).toBe(DISCLAIMER_SCAN);
    expect(guestRes.body.data.care_recommendations.dos.length).toBeGreaterThan(0);
    expect(await ScanRecord.countDocuments()).toBe(0);

    // Authenticated mode
    const { token } = await registerUser('owner@example.com');
    const authRes = await request(app)
      .post('/api/v1/scans')
      .set('Authorization', `Bearer ${token}`)
      .field('capture_source', 'camera')
      .field('user_symptoms', 'Gigi berdenyut sejak semalam')
      .attach('image', validPng, { filename: 'tooth.png', contentType: 'image/png' });

    expect(authRes.status).toBe(201);
    expect(authRes.body.data.saved).toBe(true);
    expect(authRes.body.data.id).toBeTruthy();
    expect(authRes.body.data.urgency_level).toBe('emergency');
    expect(authRes.body.data.trigger_clinic_finder).toBe(true);
    expect(await ScanRecord.countDocuments()).toBe(1);
  });

  it('enforces ownership isolation (404 for other user), pagination, and delete cascade to ChatSession', async () => {
    vi.spyOn(aiClient, 'requestDentalPrediction').mockResolvedValue({
      primary_condition: 'healthy',
      confidence_score: 0.92,
      probabilities: { caries: 0.02, calculus: 0.03, gingivitis: 0.03, healthy: 0.92 },
      detections: [{ label: 'healthy', confidence: 0.92, bbox: null }],
      urgency_level: 'low',
      trigger_clinic_finder: false,
      quality: { blur_score: 210.0, mean_luminance: 135.0, passed: true },
      model_version: 'denthub-cnn-1.0.0',
    });

    const app = createApp();
    const userA = await registerUser('usera@example.com');
    const userB = await registerUser('userb@example.com');
    const validPng = makePngBuffer(400, 400);

    const created = await request(app)
      .post('/api/v1/scans')
      .set('Authorization', `Bearer ${userA.token}`)
      .field('capture_source', 'camera')
      .attach('image', validPng, { filename: 'a.png', contentType: 'image/png' });
    const scanId = created.body.data.id as string;

    // Link a chat session to this scan
    const chatSession = await ChatSession.create({
      user_id: userA.userId,
      scan_id: scanId,
      title: 'Tanya hasil scan',
      messages: [],
    });

    // User A sees own scan in paginated list
    const listA = await request(app)
      .get('/api/v1/scans?page=1&limit=10')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(listA.status).toBe(200);
    expect(listA.body.data).toHaveLength(1);
    expect(listA.body.meta).toMatchObject({ page: 1, limit: 10, total: 1, total_pages: 1 });

    // User B cannot read or delete User A's scan -> 404
    const readB = await request(app)
      .get(`/api/v1/scans/${scanId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(readB.status).toBe(404);

    const delB = await request(app)
      .delete(`/api/v1/scans/${scanId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(delB.status).toBe(404);

    // User A deletes own scan -> 200 and chatSession.scan_id becomes null
    const delA = await request(app)
      .delete(`/api/v1/scans/${scanId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(delA.status).toBe(200);
    expect(delA.body.message).toBe('Riwayat scan dihapus.');

    const updatedChat = await ChatSession.findById(chatSession._id);
    expect(updatedChat?.scan_id).toBeNull();
  });
});
