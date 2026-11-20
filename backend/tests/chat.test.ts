import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ChatSession, DentalKnowledge, ScanRecord, User } from '../src/models';
import { DISCLAIMER_CHAT } from '../src/constants/domain';
import { runSeed } from '../src/scripts/seed';
import * as aiClient from '../src/services/aiServiceClient';
import { ApiError } from '../src/utils/ApiError';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb';

describe('T-202 Chat endpoints: Deni sessions, ownership, rollover at 50, guest & fallback', () => {
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

  it('supports guest mode without persistence and appends canonical DISCLAIMER_CHAT', async () => {
    vi.spyOn(aiClient, 'requestAgentChat').mockResolvedValueOnce({
      reply: 'Sikat gigi dua kali sehari dengan pasta gigi berfluoride.',
      urgency_level: 'low',
      trigger_clinic_finder: false,
      suggested_questions: ['Apakah perlu flossing setiap hari?'],
    });

    const app = createApp();
    const res = await request(app).post('/api/v1/chat').send({
      message: 'Bagaimana cara merawat gigi sehari-hari?',
      history: [{ role: 'user', content: 'Halo Deni' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session_id).toBeNull();
    expect(res.body.data.medical_disclaimer).toBe(DISCLAIMER_CHAT);
    expect(await ChatSession.countDocuments()).toBe(0);
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

    // Severe keyword forces emergency + trigger_clinic_finder even when LLM returns low/false
    const severeRes = await request(app).post('/api/v1/chat').send({
      message: 'Gigi saya berdenyut dan pipi bengkak sejak semalam.',
    });
    expect(severeRes.status).toBe(200);
    expect(severeRes.body.data.urgency_level).toBe('emergency');
    expect(severeRes.body.data.trigger_clinic_finder).toBe(true);
    expect(severeRes.body.data.medical_disclaimer).toBe(DISCLAIMER_CHAT);

    // AI failure still returns 200 with static Indonesian fallback + disclaimer
    const fallbackRes = await request(app).post('/api/v1/chat').send({
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
});
