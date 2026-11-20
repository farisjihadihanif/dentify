import React from 'react';
import { DeniChat } from '../../components/DeniChat';

/**
 * Full-Viewport AI Chat Page (`src/app/chat/page.tsx`, docs/DESIGN.md §3.3):
 * Clean Claude/Gemini/ChatGPT-style full-screen workspace without bulky top hero headers.
 */
export default function ChatPage() {
  return (
    <main className="h-[calc(100vh-5.5rem)] w-full overflow-hidden bg-bg">
      <DeniChat />
    </main>
  );
}
