import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb';
import { Article, User } from '../src/models';
import { parsePubMedArticlesXml } from '../src/scripts/crawlDentalNews';
import { runSeed } from '../src/scripts/seed';

describe('T-208 Public Articles API & Admin CMS + User Management API', () => {
  const app = createApp();

  beforeAll(async () => {
    await setupTestDb();
    await Promise.all([User.syncIndexes(), Article.syncIndexes()]);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function seedAdminAndGetToken(): Promise<{ token: string; adminId: string }> {
    await runSeed({
      adminEmail: 'admin@denthub.local',
      adminPassword: 'AdminPassword123!',
      adminName: 'Admin DentHub',
    });
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@denthub.local',
      password: 'AdminPassword123!',
    });
    expect(loginRes.status).toBe(200);
    return {
      token: loginRes.body.data.token as string,
      adminId: loginRes.body.data.user.id as string,
    };
  }

  async function registerUserAndGetToken(email: string, name: string): Promise<{ token: string; userId: string }> {
    const res = await request(app).post('/api/v1/auth/register').send({
      full_name: name,
      email,
      password: 'UserPassword123!',
    });
    expect(res.status).toBe(201);
    return {
      token: res.body.data.token as string,
      userId: res.body.data.user.id as string,
    };
  }

  it('serves published articles sorted newest first and filters out drafts on public endpoints', async () => {
    await runSeed({
      adminEmail: 'admin@denthub.local',
      adminPassword: 'AdminPassword123!',
      adminName: 'Admin DentHub',
    });

    await Article.create({
      title: 'Draf Internal Promo',
      slug: 'draf-internal-promo',
      category: 'Promo',
      summary: 'Ringkasan draf internal yang tidak boleh tampil ke publik.',
      content: 'Konten draf yang belum dipublikasikan untuk pengujian endpoint publik.',
      coverImageUrl: '/images/covers/promo-scaling.svg',
      isPublished: false,
      authorName: 'Admin DentHub',
      publishedAt: null,
    });

    const listRes = await request(app).get('/api/v1/articles');
    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(10);
    expect(listRes.body.data.every((item: { isPublished: boolean }) => item.isPublished)).toBe(true);
    expect(
      listRes.body.data.some((item: { slug: string }) => item.slug === 'draf-internal-promo'),
    ).toBe(false);

    const firstSlug = listRes.body.data[0].slug as string;
    const detailRes = await request(app).get(`/api/v1/articles/${firstSlug}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.slug).toBe(firstSlug);

    const draftRes = await request(app).get('/api/v1/articles/draf-internal-promo');
    expect(draftRes.status).toBe(404);
  });

  it('blocks non-admin users with 403 FORBIDDEN on /api/v1/admin/* endpoints', async () => {
    const { token } = await registerUserAndGetToken('pasien@denthub.local', 'Pasien Biasa');

    const articlesRes = await request(app)
      .get('/api/v1/admin/articles')
      .set('Authorization', `Bearer ${token}`);
    expect(articlesRes.status).toBe(403);
    expect(articlesRes.body.code).toBe('FORBIDDEN');

    const usersRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(usersRes.status).toBe(403);
    expect(usersRes.body.code).toBe('FORBIDDEN');
  });

  it('allows admin to create, list, update, and delete articles', async () => {
    const { token } = await seedAdminAndGetToken();

    const createRes = await request(app)
      .post('/api/v1/admin/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Promo Scaling Akhir Pekan 2026',
        category: 'Promo',
        summary: 'Nikmati pemeriksaan gigi dan scaling lengkap dengan potongan harga khusus.',
        content:
          'Paragraf pertama menjelaskan manfaat scaling rutin setiap enam bulan sekali.\n\nParagraf kedua menjelaskan cara mendaftar di klinik gigi mitra terdekat.',
        coverImageUrl: '/images/covers/promo-scaling.svg',
        isPublished: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.slug).toBe('promo-scaling-akhir-pekan-2026');
    const createdId = createRes.body.data.id as string;

    const updateRes = await request(app)
      .patch(`/api/v1/admin/articles/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Promo Scaling Akhir Pekan Diperpanjang',
        isPublished: false,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.title).toBe('Promo Scaling Akhir Pekan Diperpanjang');
    expect(updateRes.body.data.isPublished).toBe(false);

    const publicAfterUnpublish = await request(app).get(
      '/api/v1/articles/promo-scaling-akhir-pekan-2026',
    );
    expect(publicAfterUnpublish.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/articles/${createdId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
  });

  it('allows admin to search users, update roles, delete another user, and blocks self-deletion', async () => {
    const { token, adminId } = await seedAdminAndGetToken();
    const { userId } = await registerUserAndGetToken('nadia@denthub.local', 'Nadia Putri');

    const listRes = await request(app)
      .get('/api/v1/admin/users?q=nadia')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].email).toBe('nadia@denthub.local');

    const roleRes = await request(app)
      .patch(`/api/v1/admin/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });
    expect(roleRes.status).toBe(200);
    expect(roleRes.body.data.role).toBe('admin');

    const selfDeleteRes = await request(app)
      .delete(`/api/v1/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(selfDeleteRes.status).toBe(400);
    expect(selfDeleteRes.body.code).toBe('BAD_REQUEST');

    const deleteOtherRes = await request(app)
      .delete(`/api/v1/admin/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteOtherRes.status).toBe(200);
  });

  it('parses PubMed XML abstracts cleanly into structured CrawledDentalArticle items with attribution', () => {
    const sampleXml = `
      <PubmedArticleSet>
        <PubmedArticle>
          <MedlineCitation>
            <PMID>39991234</PMID>
            <Article>
              <Journal><Title>Journal of Preventive Dentistry</Title></Journal>
              <ArticleTitle>Fluoride &amp; Early Caries Prevention in Adults.</ArticleTitle>
              <Abstract>
                <AbstractText>Twice-daily fluoride toothpaste reduces early enamel demineralization significantly.</AbstractText>
              </Abstract>
            </Article>
            <DateCompleted><Year>2026</Year></DateCompleted>
          </MedlineCitation>
        </PubmedArticle>
      </PubmedArticleSet>
    `;
    const parsed = parsePubMedArticlesXml(sampleXml, {
      query: 'dental caries',
      category: 'Berita',
      coverImageUrl: '/images/covers/berita-ai.svg',
      topicLabelId: 'Pencegahan Karies Gigi',
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Fluoride & Early Caries Prevention in Adults');
    expect(parsed[0].slug).toContain('pubmed-39991234');
    expect(parsed[0].content).toContain('https://pubmed.ncbi.nlm.nih.gov/39991234/');
    expect(parsed[0].coverImageUrl).toBe('/images/covers/berita-ai.svg');
  });

  it('preserves uploaded data:image cover URL, framing metadata (coverFit/coverPosition/coverZoom), and free-length summary/content without character caps', async () => {
    const { token } = await seedAdminAndGetToken();
    const uploadedDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==';
    const longSummary = 'Ringkasan promo panjang '.repeat(40).trim(); // > 600 chars
    const longContent = 'Paragraf edukasi kesehatan gigi lengkap. '.repeat(700).trim(); // > 25000 chars

    const createRes = await request(app)
      .post('/api/v1/admin/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Promo Scaling Mahasiswa Tanpa Batas Panjang',
        category: 'Promo',
        summary: longSummary,
        content: longContent,
        coverImageUrl: uploadedDataUrl,
        coverFit: 'contain',
        coverPosition: '50% 25%',
        coverZoom: 1.3,
        isPublished: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.coverImageUrl).toBe(uploadedDataUrl);
    expect(createRes.body.data.coverFit).toBe('contain');
    expect(createRes.body.data.coverPosition).toBe('50% 25%');
    expect(createRes.body.data.coverZoom).toBe(1.3);
    expect(createRes.body.data.summary.length).toBeGreaterThan(600);
    expect(createRes.body.data.content.length).toBeGreaterThan(25000);

    const id = createRes.body.data.id as string;
    const patchRes = await request(app)
      .patch(`/api/v1/admin/articles/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Promo Scaling Mahasiswa Diperbarui',
        coverFit: 'cover',
        coverPosition: '40% 60%',
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.coverImageUrl).toBe(uploadedDataUrl);
    expect(patchRes.body.data.coverFit).toBe('cover');
    expect(patchRes.body.data.coverPosition).toBe('40% 60%');
  });
});
