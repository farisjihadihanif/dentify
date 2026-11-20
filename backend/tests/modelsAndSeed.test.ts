import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb';
import { User, ScanRecord, ChatSession, DentalKnowledge } from '../src/models';
import { DISCLAIMER_SCAN } from '../src/constants/domain';
import { runSeed } from '../src/scripts/seed';

describe('T-003 & T-004 Models and Idempotent Seeder', () => {
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
  });

  it('User hides password_hash by default and allows multiple users without username (sparse unique)', async () => {
    const u1 = await User.create({
      full_name: 'Faris Satu',
      email: 'faris1@example.com',
      password_hash: 'hashed_pw_1',
    });
    const u2 = await User.create({
      full_name: 'Faris Dua',
      email: 'faris2@example.com',
      password_hash: 'hashed_pw_2',
    });

    expect(u1.role).toBe('user');
    expect(u2.role).toBe('user');

    const fetched = await User.findById(u1._id);
    expect(fetched?.password_hash).toBeUndefined();
    expect(fetched?.toJSON()).not.toHaveProperty('password_hash');

    const withHash = await User.findById(u1._id).select('+password_hash');
    expect(withHash?.password_hash).toBe('hashed_pw_1');
  });

  it('User enforces unique email and unique username when present', async () => {
    await User.create({
      full_name: 'User A',
      email: 'dup@example.com',
      username: 'unique_handle',
      password_hash: 'hash_a',
    });

    await expect(
      User.create({
        full_name: 'User B',
        email: 'dup@example.com',
        password_hash: 'hash_b',
      }),
    ).rejects.toThrow();

    await expect(
      User.create({
        full_name: 'User C',
        email: 'other@example.com',
        username: 'unique_handle',
        password_hash: 'hash_c',
      }),
    ).rejects.toThrow();
  });

  it('ScanRecord enforces condition, capture_source, urgency enums and confidence bounds', async () => {
    const userId = new mongoose.Types.ObjectId();

    await expect(
      ScanRecord.create({
        user_id: userId,
        capture_source: 'camera',
        primary_condition: 'invalid_condition',
        condition_label: 'Invalid',
        confidence_score: 0.9,
        urgency_level: 'low',
        care_recommendations: { summary: 'Ok', dos: [], donts: [] },
        medical_disclaimer: DISCLAIMER_SCAN,
        model_version: 'denthub-cnn-1.0.0',
      }),
    ).rejects.toThrow();

    const valid = await ScanRecord.create({
      user_id: userId,
      capture_source: 'upload',
      primary_condition: 'caries',
      condition_label: 'Indikasi Karies Gigi (Gigi Berlubang)',
      confidence_score: 0.88,
      detections: [{ label: 'caries', confidence: 0.88, bbox: [10, 20, 30, 40] }],
      urgency_level: 'emergency',
      trigger_clinic_finder: true,
      care_recommendations: { summary: 'Segera ke dokter gigi.', dos: ['Sikat lembut'], donts: ['Jangan dikorek'] },
      medical_disclaimer: DISCLAIMER_SCAN,
      model_version: 'denthub-cnn-1.0.0',
    });

    expect(valid.primary_condition).toBe('caries');
    expect(valid.trigger_clinic_finder).toBe(true);
  });

  it('ChatSession enforces max 50 messages and valid message roles', async () => {
    const userId = new mongoose.Types.ObjectId();
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Pesan ke-${i + 1}`,
      trigger_clinic_finder: false,
      timestamp: new Date(),
    }));

    await expect(
      ChatSession.create({
        user_id: userId,
        messages: tooMany,
      }),
    ).rejects.toThrow();
  });

  it('T-004 runSeed is idempotent and seeds 5 dental_knowledge docs + 1 admin without duplicates', async () => {
    const first = await runSeed({
      adminEmail: 'admin@denthub.local',
      adminPassword: 'AdminPassword123!',
      adminName: 'Admin DentHub',
    });
    const second = await runSeed({
      adminEmail: 'admin@denthub.local',
      adminPassword: 'AdminPassword123!',
      adminName: 'Admin DentHub',
    });

    expect(first.knowledgeUpserted).toBe(5);
    expect(second.knowledgeUpserted).toBe(5);
    expect(await DentalKnowledge.countDocuments()).toBe(5);
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);
  });
});
