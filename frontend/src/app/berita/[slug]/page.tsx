import React from 'react';
import { BeritaArticleDetailView } from '../../../components/BeritaArticleDetailView';

export default async function BeritaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BeritaArticleDetailView slug={slug} />;
}
