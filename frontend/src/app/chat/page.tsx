import React from 'react';
import { DeniChat } from '../../components/DeniChat';

/**
 * Full-Viewport Consultation Page (`src/app/chat/page.tsx`):
 * Fills 100dvh cleanly with internal scrolling only (footer hidden on /chat).
 */
export default function ChatPage() {
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-bg">
      <DeniChat />
    </main>
  );
}
