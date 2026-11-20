import React from 'react';
import { DeniChat } from '../../components/DeniChat';

/**
 * Full-Viewport Consultation Page (`src/app/chat/page.tsx`):
 * Clean full-screen consultation workspace without bulky top hero headers.
 */
export default function ChatPage() {
  return (
    <main className="h-[calc(100vh-5.5rem)] w-full overflow-hidden bg-bg">
      <DeniChat />
    </main>
  );
}
