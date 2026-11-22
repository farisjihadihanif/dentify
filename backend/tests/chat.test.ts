import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ChatSession, DentalKnowledge, ScanRecord, User } from '../src/models';
import { DISCLAIMER_CHAT } from '../src/constants/domain';
import { runSeed } from '../src/scripts/seed';
import * as aiClient from '../src/services/aiServiceClient';
import { ApiError } from '../src/utils/ApiError';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb';

describe('Chat endpoints: Deni sessions, ownership, rollover at 50, guest & fallback', () => {
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
      full_name: 'Chat Tester',
      email,
      password: 'PasswordKuat123!',
    });
    return { token: res.body.data.token as string, userId: res.body.data.user.id as string };
  }

  it('requires login for POST /chat (401) and appends canonical DISCLAIMER_CHAT for users', async () => {
    const aiSpy = vi.spyOn(aiClient, 'requestAgentChat').mockResolvedValueOnce({
      reply: 'Sikat gigi dua kali sehari dengan pasta gigi berfluoride.',
      urgency_level: 'low',
      trigger_clinic_finder: false,
      suggested_questions: ['Apakah perlu flossing setiap hari?'],
    });

    const app = createApp();
    const guestRes = await request(app).post('/api/v1/chat').send({
      message: 'Bagaimana cara merawat gigi sehari-hari?',
      history: [{ role: 'user', content: 'Halo Deni' }],
    });
    expect(guestRes.status).toBe(401);
    expect(guestRes.body.code).toBe('UNAUTHENTICATED');
    expect(aiSpy).not.toHaveBeenCalled();
    expect(await ChatSession.countDocuments()).toBe(0);

    const { token } = await registerUser('chatuser@example.com');
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Bagaimana cara merawat gigi sehari-hari?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session_id).toBeTruthy();
    expect(res.body.data.medical_disclaimer).toBe(DISCLAIMER_CHAT);
  });

  it('enforces severe-symptom backstop even if AI says low, and returns 200 static fallback on AI failure', async () => {
    vi.spyOn(aiClient, 'requestAgentChat')
      .mockResolvedValueOnce({
        reply: 'Coba istirahat dulu.',
        urgency_level: 'low',
        trigger_clinic_finder: false,
        suggested_questions: ['Pertanyaan 1'],
      })
      .mockRejectedValueOnce(new ApiError(502, 'AI_SERVICE_UNAVAILABLE', 'Down'));

    const app = createApp();
    const { token } = await registerUser('severe@example.com');

    // Severe keyword forces emergency + trigger_clinic_finder even when LLM returns low/false
    const severeRes = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
      message: 'Gigi saya berdenyut dan pipi bengkak sejak semalam.',
    });
    expect(severeRes.status).toBe(200);
    expect(severeRes.body.data.urgency_level).toBe('emergency');
    expect(severeRes.body.data.trigger_clinic_finder).toBe(true);
    expect(severeRes.body.data.medical_disclaimer).toBe(DISCLAIMER_CHAT);

    // AI failure still returns 200 with static Indonesian fallback + disclaimer
    const fallbackRes = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
      message: 'Ada bengkak dan demam di gusi saya.',
    });
    expect(fallbackRes.status).toBe(200);
    expect(fallbackRes.body.data.urgency_level).toBe('emergency');
    expect(fallbackRes.body.data.trigger_clinic_finder).toBe(true);
    expect(fallbackRes.body.data.reply).toContain('Deni');
    expect(fallbackRes.body.data.medical_disclaimer).toBe(DISCLAIMER_CHAT);
  });

  it('persists sessions for logged-in users, isolates ownership (404), and rolls over at 50 messages', async () => {
    vi.spyOn(aiClient, 'requestAgentChat').mockResolvedValue({
      reply: 'Terima kasih atas pertanyaannya.',
      urgency_level: 'low',
      trigger_clinic_finder: false,
      suggested_questions: ['Tips sikat gigi?'],
    });

    const app = createApp();
    const userA = await registerUser('chata@example.com');
    const userB = await registerUser('chatb@example.com');

    // Create a session near capacity (50 messages)
    const fullMessages = Array.from({ length: 50 }, (_, idx) => ({
      role: (idx % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Pesan #${idx + 1}`,
      trigger_clinic_finder: false,
      timestamp: new Date(),
    }));
    const existing = await ChatSession.create({
      user_id: userA.userId,
      title: 'Sesi Penuh',
      messages: fullMessages,
    });

    // 51st message opens a new session with a new session_id
    const rollover = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        session_id: existing._id.toString(),
        message: 'Pesan ke-51 untuk membuka sesi baru',
      });

    expect(rollover.status).toBe(200);
    const newSessionId = rollover.body.data.session_id as string;
    expect(newSessionId).toBeTruthy();
    expect(newSessionId).not.toBe(existing._id.toString());

    // User A can list and read own sessions
    const listA = await request(app)
      .get('/api/v1/chat/sessions')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(listA.status).toBe(200);
    expect(listA.body.data.length).toBe(2);

    // User B cannot read or delete User A's session -> 404
    const readB = await request(app)
      .get(`/api/v1/chat/sessions/${newSessionId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(readB.status).toBe(404);

    const delB = await request(app)
      .delete(`/api/v1/chat/sessions/${newSessionId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(delB.status).toBe(404);

    // User A deletes own session
    const delA = await request(app)
      .delete(`/api/v1/chat/sessions/${newSessionId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(delA.status).toBe(200);
  });

  it('gracefully ignores stale scan_id/session_id and accepts photo-only messages with empty text', async () => {
    const aiSpy = vi.spyOn(aiClient, 'requestAgentChat').mockResolvedValueOnce({
      reply: 'Halo Chat Tester, saya melihat area gigi pada foto yang Anda lampirkan.',
      urgency_level: 'medium',
      trigger_clinic_finder: false,
      suggested_questions: ['Apakah gigi terasa ngilu?'],
    });

    const app = createApp();
    const user = await registerUser('stalechat@example.com');

    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        scan_id: '507f1f77bcf86cd799439011',
        session_id: '507f1f77bcf86cd799439012',
        message: '',
        image_data_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        image_mime_type: 'image/jpeg',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session_id).toBeTruthy();
    expect(aiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Tolong periksa kondisi gigi pada foto yang saya lampirkan.',
        user_name: 'Chat Tester',
        image_data_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      }),
    );
  });
});
