import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db';
import { getEnv } from '../config/env';
import { DENTAL_KNOWLEDGE_SEED } from '../constants/knowledgeSeed';
import { DentalKnowledge, User } from '../models';
import { logger } from '../utils/logger';

export interface SeedResult {
  knowledgeUpserted: number;
  adminSeeded: boolean;
}

export async function runSeed(options?: {
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
}): Promise<SeedResult> {
  const env = getEnv();
  let knowledgeUpserted = 0;

  for (const item of DENTAL_KNOWLEDGE_SEED) {
    await DentalKnowledge.findOneAndUpdate(
      { condition_key: item.condition_key },
      { $set: item },
      { upsert: true, new: true, runValidators: true },
    );
    knowledgeUpserted += 1;
  }

  const adminEmail = (options?.adminEmail ?? env.adminEmail).trim().toLowerCase();
  const adminPassword = options?.adminPassword ?? env.adminPassword;
  const adminName = (options?.adminName ?? env.adminName).trim() || 'Administrator DentHub';

  let adminSeeded = false;
  if (adminEmail && adminPassword) {
    const existingAdmin = await User.findOne({ email: adminEmail }).select('+password_hash');
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, env.bcryptSaltRounds);
      await User.create({
        full_name: adminName,
        email: adminEmail,
        password_hash: passwordHash,
        role: 'admin',
        is_active: true,
      });
    } else if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      await existingAdmin.save();
    }
    adminSeeded = true;
  }

  return { knowledgeUpserted, adminSeeded };
}

async function main(): Promise<void> {
  await connectDb();
  const result = await runSeed();
  logger.info('Seed completed', {
    knowledgeUpserted: result.knowledgeUpserted,
    adminSeeded: result.adminSeeded,
  });
  await disconnectDb();
}

if (require.main === module) {
  main().catch((err) => {
    logger.error('Seed failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
}
