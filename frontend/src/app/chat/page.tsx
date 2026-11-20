import React from 'react';
import { DeniChat } from '../../components/DeniChat';

export default function ChatPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-accent-deni">
          Asisten AI Interaktif • Deni
        </span>
        <h1 className="text-2xl font-bold text-text sm:text-3xl">
          Konsultasi Kesehatan Gigi Bersama Deni
        </h1>
        <p className="max-w-2xl text-sm text-text-muted sm:text-base">
          Tanyakan arti hasil scan Anda, langkah perawatan harian, atau solusi pertolongan pertama
          sebelum ke dokter gigi.
        </p>
      </div>

      <DeniChat />
    </main>
  );
}
