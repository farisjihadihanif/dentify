import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ChatSession, Feedback, ScanRecord, User } from '../src/models';
import { DISCLAIMER_SCAN } from '../src/constants/domain';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb';

describe('T-207 POST /api/v1/feedback: validation, guest mode, and ownership isolation', () => {
  beforeAll(async () => {
    await setupTestDb();
    await Promise.all([
      User.syncIndexes(),
      ScanRecord.syncIndexes(),
      ChatSession.syncIndexes(),
      Feedback.syncIndexes(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function registerUser(email: string) {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send({
      full_name: 'Feedback Tester',
      email,
      password: 'PasswordKuat123!',
    });
    return { token: res.body.data.token as string, userId: res.body.data.user.id as string };
  }

  it('rejects invalid payload and comments > 300 chars with 422 VALIDATION_ERROR', async () => {
    const app = createApp();
    const badRating = await request(app).post('/api/v1/feedback').send({
      target_type: 'scan',
      target_id: 'guest-scan-1',
      rating: 'awesome',
    });
    expect(badRating.status).toBe(422);
    expect(badRating.body.code).toBe('VALIDATION_ERROR');
    expect(badRating.body.errors).toHaveProperty('rating');

    const longComment = await request(app).post('/api/v1/feedback').send({
      target_type: 'chat_message',
      target_id: 'guest-msg-1',
      rating: 'helpful',
      comment: 'a'.repeat(301),
    });
    expect(longComment.status).toBe(422);
    expect(longComment.body.errors).toHaveProperty('comment');
  });

  it('allows guest feedback on non-persisted chat messages and rejects invalid Bearer token with 401', async () => {
    const app = createApp();
    const guestRes = await request(app).post('/api/v1/feedback').send({
      target_type: 'chat_message',
      target_id: 'guest-turn-1',
      rating: 'helpful',
      comment: 'Penjelasan Deni jelas.',
    });
    expect(guestRes.status).toBe(201);
    expect(guestRes.body.success).toBe(true);
    expect(guestRes.body.data).toMatchObject({
      target_type: 'chat_message',
      target_id: 'guest-turn-1',
      rating: 'helpful',
      comment: 'Penjelasan Deni jelas.',
    });

    const stored = await Feedback.findById(guestRes.body.data.id);
    expect(stored?.user_id).toBeNull();

    const invalidAuth = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', 'Bearer broken.jwt.token')
      .send({
        target_type: 'chat_message',
        target_id: 'guest-turn-1',
        rating: 'helpful',
      });
    expect(invalidAuth.status).toBe(401);
    expect(invalidAuth.body.code).toBe('UNAUTHENTICATED');
  });

  it('enforces ownership on saved ScanRecord and ChatSession targets (404 for other owner)', async () => {
    const app = createApp();
    const userA = await registerUser('fb-a@example.com');
    const userB = await registerUser('fb-b@example.com');

    const scanA = await ScanRecord.create({
      user_id: userA.userId,
      capture_source: 'camera',
      primary_condition: 'caries',
      condition_label: 'Indikasi Karies Gigi (Gigi Berlubang)',
      confidence_score: 0.72,
      urgency_level: 'medium',
      trigger_clinic_finder: false,
      care_recommendations: { summary: 'Periksa ke dokter gigi.', dos: ['Sikat'], donts: ['Korek'] },
      medical_disclaimer: DISCLAIMER_SCAN,
      model_version: 'denthub-cnn-1.0.0',
    });

    const chatA = await ChatSession.create({
      user_id: userA.userId,
      title: 'Konsultasi A',
      messages: [],
    });

    // User A can rate own scan and chat message
    const okScan = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        target_type: 'scan',
        target_id: scanA._id.toString(),
        rating: 'inaccurate',
        comment: 'Foto agak gelap.',
      });
    expect(okScan.status).toBe(201);

    const okChat = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        target_type: 'chat_message',
        target_id: `${chatA._id.toString()}:1`,
        rating: 'helpful',
      });
    expect(okChat.status).toBe(201);

    // User B gets 404 on User A's scan and chat session
    const forbiddenScan = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        target_type: 'scan',
        target_id: scanA._id.toString(),
        rating: 'helpful',
      });
    expect(forbiddenScan.status).toBe(404);

    const forbiddenChat = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        target_type: 'chat_message',
        target_id: `${chatA._id.toString()}:1`,
        rating: 'inaccurate',
      });
    expect(forbiddenChat.status).toBe(404);
  });
});
