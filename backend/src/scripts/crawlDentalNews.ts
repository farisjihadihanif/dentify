import { connectDb, disconnectDb } from '../config/db';
import { Article, type ArticleCategory } from '../models/Article';
import { logger } from '../utils/logger';

export interface CrawledDentalArticle {
  title: string;
  slug: string;
  category: ArticleCategory;
  summary: string;
  content: string;
  coverImageUrl: string;
  isPublished: boolean;
  authorName: string;
  publishedAt: Date;
}

const CRAWLER_USER_AGENT = 'Dentify-DentalNewsCrawler/1.0 (+https://dentify.id)';
const REQUEST_TIMEOUT_MS = 8000;

interface PubMedTopic {
  query: string;
  category: ArticleCategory;
  coverImageUrl: string;
  topicLabelId: string;
}

const PUBMED_TOPICS: readonly PubMedTopic[] = [
  {
    query: 'dental caries prevention fluoride[Title/Abstract]',
    category: 'Berita',
    coverImageUrl: '/images/covers/berita-ai.svg',
    topicLabelId: 'Pencegahan Karies Gigi',
  },
  {
    query: 'gingivitis periodontal oral hygiene[Title/Abstract]',
    category: 'Berita',
    coverImageUrl: '/images/covers/berita-kemenkes.svg',
    topicLabelId: 'Kesehatan Gusi & Periodontal',
  },
  {
    query: 'dental scaling calculus oral health[Title/Abstract]',
    category: 'Artikel',
    coverImageUrl: '/images/covers/artikel-scaling.svg',
    topicLabelId: 'Pembersihan Karang Gigi & Scaling',
  },
  {
    query: 'oral health world health organization preventive dentistry[Title/Abstract]',
    category: 'Artikel',
    coverImageUrl: '/images/covers/artikel-persiapan.svg',
    topicLabelId: 'Kedokteran Gigi Preventif Global',
  },
];

export function stripHtmlAndEntities(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugifyCrawledTitle(prefix: string, title: string): string {
  const clean = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
  return `${prefix}-${clean || Date.now()}`.slice(0, 120);
}

async function fetchTextWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': CRAWLER_USER_AGENT,
        Accept: 'application/json, application/xml, text/xml, text/plain, */*',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractXmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? stripHtmlAndEntities(match[1]) : '';
}

function extractAllXmlTags(block: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let match = regex.exec(block);
  while (match) {
    const text = stripHtmlAndEntities(match[1]);
    if (text) results.push(text);
    match = regex.exec(block);
  }
  return results;
}

export function parsePubMedArticlesXml(
  xml: string,
  topic: PubMedTopic,
): CrawledDentalArticle[] {
  const articles: CrawledDentalArticle[] = [];
  const articleBlocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/gi) ?? [];

  for (const block of articleBlocks) {
    const pmid = extractXmlTag(block, 'PMID');
    const rawTitle = extractXmlTag(block, 'ArticleTitle');
    const journal = extractXmlTag(block, 'Title') || 'PubMed Dental Journal';
    const yearStr = extractXmlTag(block, 'Year');
    const abstractParts = extractAllXmlTags(block, 'AbstractText');

    if (!pmid || !rawTitle || abstractParts.length === 0) continue;

    const cleanTitle = rawTitle.replace(/\.$/, '').slice(0, 175);
    const fullAbstract = abstractParts.join('\n\n');
    const shortLead = fullAbstract.slice(0, 260).trim();
    const summary =
      `Ringkasan publikasi ilmiah ${topic.topicLabelId} (${journal}): ` +
      `${shortLead}${fullAbstract.length > 260 ? '...' : ''}`;

    const sourceUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
    const introParagraph =
      `Publikasi ilmiah dari ${journal} (${yearStr || 'Terbaru'}) mengulas temuan klinis terkini terkait ${topic.topicLabelId.toLowerCase()}. ` +
      `Informasi ini dirangkum secara otomatis oleh crawler edukasi Dentify dari basis data biomedis terbuka PubMed (NIH/NLM) sebagai referensi tambahan kesehatan gigi preventif.`;
    const attributionParagraph =
      `Sumber asli (PubMed PMID ${pmid}): ${sourceUrl}\n\n` +
      `Catatan Dentify: Ringkasan publikasi ilmiah ini bersifat edukatif. Untuk rencana perawatan sesuai kondisi gigi Anda, selalu konsultasikan langsung dengan dokter gigi.`;

    const content = [introParagraph, ...abstractParts, attributionParagraph]
      .join('\n\n')
      .slice(0, 14000);

    const parsedYear = Number(yearStr);
    const publishedAt =
      Number.isFinite(parsedYear) && parsedYear >= 2015 && parsedYear <= 2030
        ? new Date(Date.UTC(parsedYear, 9, 15, 8, 0, 0))
        : new Date();

    const rawAuthor = `${journal} (via PubMed)`;
    const safeAuthorName =
      rawAuthor.length <= 115 ? rawAuthor : `${journal.slice(0, 96).trim()}... (PubMed)`;

    articles.push({
      title: cleanTitle,
      slug: slugifyCrawledTitle(`pubmed-${pmid}`, cleanTitle),
      category: topic.category,
      summary: summary.slice(0, 480),
      content,
      coverImageUrl: topic.coverImageUrl,
      isPublished: true,
      authorName: safeAuthorName,
      publishedAt,
    });
  }

  return articles;
}

async function crawlPubMedTopic(topic: PubMedTopic, maxResults = 2): Promise<CrawledDentalArticle[]> {
  const searchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` +
    `?db=pubmed&retmode=json&sort=pub+date&retmax=${maxResults}` +
    `&term=${encodeURIComponent(`${topic.query} AND hasabstract[text]`)}`;

  const searchJsonText = await fetchTextWithTimeout(searchUrl);
  if (!searchJsonText) return [];

  let ids: string[] = [];
  try {
    const parsed = JSON.parse(searchJsonText) as { esearchresult?: { idlist?: string[] } };
    ids = parsed.esearchresult?.idlist ?? [];
  } catch {
    return [];
  }
  if (ids.length === 0) return [];

  const fetchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi` +
    `?db=pubmed&retmode=xml&id=${encodeURIComponent(ids.join(','))}`;
  const xml = await fetchTextWithTimeout(fetchUrl);
  if (!xml) return [];

  return parsePubMedArticlesXml(xml, topic);
}

async function crawlWhoOralHealthNews(): Promise<CrawledDentalArticle[]> {
  const whoUrl = 'https://www.who.int/news-room/fact-sheets/detail/oral-health';
  const html = await fetchTextWithTimeout(whoUrl);
  if (!html) return [];

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  );
  const heading = titleMatch
    ? stripHtmlAndEntities(titleMatch[1]).replace(/\s*\|\s*WHO.*$/i, '')
    : 'WHO Oral Health Global Fact Sheet';
  const desc = descMatch
    ? stripHtmlAndEntities(descMatch[1])
    : 'Pembaruan resmi World Health Organization (WHO) mengenai pencegahan karies gigi, penyakit periodontal, dan akses layanan kesehatan mulut.';

  return [
    {
      title: `Pembaruan WHO: ${heading} & Pencegahan Penyakit Rongga Mulut`,
      slug: 'who-oral-health-global-fact-sheet-update',
      category: 'Berita',
      summary: desc.slice(0, 460),
      content: [
        `World Health Organization (WHO) melalui lembar fakta resmi Kesehatan Mulut (${heading}) menekankan bahwa sebagian besar gangguan rongga mulut—termasuk karies gigi dan radang gusi—dapat dicegah melalui pengurangan asupan gula bebas, penggunaan pasta gigi berfluoride dua kali sehari, dan pemeriksaan rutin.`,
        desc,
        `WHO juga mendorong pemanfaatan layanan skrining dini serta akses fasilitas pelayanan kesehatan gigi primer agar keluhan terdeteksi sebelum berkembang menjadi infeksi berat.`,
        `Sumber resmi WHO: ${whoUrl}`,
      ].join('\n\n'),
      coverImageUrl: '/images/covers/berita-klinik.svg',
      isPublished: true,
      authorName: 'World Health Organization (WHO)',
      publishedAt: new Date(),
    },
  ];
}

export async function crawlExternalDentalArticles(): Promise<CrawledDentalArticle[]> {
  const collected: CrawledDentalArticle[] = [];

  for (const topic of PUBMED_TOPICS) {
    const items = await crawlPubMedTopic(topic, 2);
    collected.push(...items);
  }

  const whoItems = await crawlWhoOralHealthNews();
  collected.push(...whoItems);

  // Deduplicate by slug
  const bySlug = new Map<string, CrawledDentalArticle>();
  for (const item of collected) {
    if (!bySlug.has(item.slug)) {
      bySlug.set(item.slug, item);
    }
  }
  return Array.from(bySlug.values());
}

export async function crawlAndSaveDentalNews(): Promise<number> {
  const crawled = await crawlExternalDentalArticles();
  let upserted = 0;

  for (const article of crawled) {
    try {
      await Article.findOneAndUpdate(
        { slug: article.slug },
        { $set: article },
        { upsert: true, new: true, runValidators: true },
      );
      upserted += 1;
    } catch (err) {
      logger.warn('Skipped invalid crawled article', {
        slug: article.slug,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return upserted;
}

async function main(): Promise<void> {
  await connectDb();
  const count = await crawlAndSaveDentalNews();
  logger.info('Dental news crawl completed', { crawledArticlesUpserted: count });
  await disconnectDb();
}

if (require.main === module) {
  main().catch((err) => {
    logger.error('Dental news crawl failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
}
