import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db';
import { getEnv } from '../config/env';
import { INITIAL_ARTICLES_SEED } from '../constants/articleSeed';
import { CLINIC_DIRECTORY_SEED } from '../constants/clinicDirectorySeed';
import { DENTAL_KNOWLEDGE_SEED } from '../constants/knowledgeSeed';
import { Article, ClinicDirectory, DentalKnowledge, User } from '../models';
import { logger } from '../utils/logger';
import { crawlAndSaveDentalNews } from './crawlDentalNews';

export interface SeedResult {
  knowledgeUpserted: number;
  articlesUpserted: number;
  crawledArticlesUpserted: number;
  clinicsUpserted: number;
  adminSeeded: boolean;
}

export async function runSeed(options?: {
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
  crawlExternalNews?: boolean;
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

  let articlesUpserted = 0;
  for (const item of INITIAL_ARTICLES_SEED) {
    await Article.findOneAndUpdate(
      { slug: item.slug },
      { $setOnInsert: item },
      { upsert: true, new: true, runValidators: true },
    );
    articlesUpserted += 1;
  }

  let clinicsUpserted = 0;
  for (const clinic of CLINIC_DIRECTORY_SEED) {
    await ClinicDirectory.findOneAndUpdate(
      { osm_id: clinic.osm_id },
      { $set: clinic },
      { upsert: true, new: true, runValidators: true },
    );
    clinicsUpserted += 1;
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

  let crawledArticlesUpserted = 0;
  const shouldCrawl = options?.crawlExternalNews ?? process.env.NODE_ENV !== 'test';
  if (shouldCrawl) {
    try {
      crawledArticlesUpserted = await crawlAndSaveDentalNews();
    } catch (err) {
      logger.warn('External dental news crawl skipped', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    knowledgeUpserted,
    articlesUpserted,
    crawledArticlesUpserted,
    clinicsUpserted,
    adminSeeded,
  };
}

async function main(): Promise<void> {
  await connectDb();
  const result = await runSeed({ crawlExternalNews: true });
  logger.info('Seed completed', {
    knowledgeUpserted: result.knowledgeUpserted,
    articlesUpserted: result.articlesUpserted,
    crawledArticlesUpserted: result.crawledArticlesUpserted,
    clinicsUpserted: result.clinicsUpserted,
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
