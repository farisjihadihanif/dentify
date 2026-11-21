import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const ARTICLE_CATEGORIES = ['Berita', 'Promo', 'Artikel'] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const COVER_FIT_MODES = ['cover', 'contain'] as const;
export type CoverFitMode = (typeof COVER_FIT_MODES)[number];

export interface IArticle {
  title: string;
  slug: string;
  category: ArticleCategory;
  summary: string;
  content: string;
  coverImageUrl: string;
  coverFit: CoverFitMode;
  coverPosition: string;
  coverZoom: number;
  isPublished: boolean;
  authorName: string;
  publishedAt: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface IArticleDocument extends IArticle, Document {
  _id: mongoose.Types.ObjectId;
}

const articleSchema = new Schema<IArticleDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      required: true,
      enum: ARTICLE_CATEGORIES,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    coverImageUrl: {
      type: String,
      trim: true,
      default: '/images/covers/artikel-default.svg',
      maxlength: 5_000_000,
    },
    coverFit: {
      type: String,
      enum: COVER_FIT_MODES,
      default: 'cover',
    },
    coverPosition: {
      type: String,
      trim: true,
      default: '50% 50%',
    },
    coverZoom: {
      type: Number,
      default: 1,
      min: 1,
      max: 3,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    authorName: {
      type: String,
      trim: true,
      default: 'Tim Redaksi DentHub',
      maxlength: 120,
    },
    publishedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'articles',
  },
);

articleSchema.index({ isPublished: 1, publishedAt: -1 });
articleSchema.index({ category: 1, isPublished: 1, publishedAt: -1 });

export interface SerializedArticle {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  summary: string;
  content: string;
  coverImageUrl: string;
  coverFit: CoverFitMode;
  coverPosition: string;
  coverZoom: number;
  isPublished: boolean;
  authorName: string;
  publishedAt: string | null;
  created_at: string;
  updated_at: string;
}

export function serializeArticle(doc: IArticleDocument): SerializedArticle {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    category: doc.category,
    summary: doc.summary,
    content: doc.content,
    coverImageUrl: doc.coverImageUrl || '/images/covers/artikel-default.svg',
    coverFit: doc.coverFit === 'contain' ? 'contain' : 'cover',
    coverPosition: doc.coverPosition || '50% 50%',
    coverZoom: typeof doc.coverZoom === 'number' && Number.isFinite(doc.coverZoom) ? doc.coverZoom : 1,
    isPublished: Boolean(doc.isPublished),
    authorName: doc.authorName || 'Tim Redaksi DentHub',
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    created_at: doc.created_at ? doc.created_at.toISOString() : new Date().toISOString(),
    updated_at: doc.updated_at ? doc.updated_at.toISOString() : new Date().toISOString(),
  };
}

export const Article: Model<IArticleDocument> =
  (mongoose.models.Article as Model<IArticleDocument> | undefined) ||
  mongoose.model<IArticleDocument>('Article', articleSchema);
