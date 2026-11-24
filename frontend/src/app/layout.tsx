import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import { AdminRolePill } from '../components/AdminRolePill';
import { AppFooter } from '../components/AppFooter';
import { DeniMascot } from '../components/DeniMascot';
import { FloatingNavbar } from '../components/FloatingNavbar';
import { NewsPromoAdPopup } from '../components/NewsPromoAdPopup';
import { ServerWarmup } from '../components/ServerWarmup';
import './globals.css';

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Dentify – Skrining Kesehatan Gigi & Konsultasi Deni',
  description:
    'Aplikasi web skrining dini kesehatan gigi berbasis Computer Vision, asisten interaktif Deni, dan pencari klinik gigi terdekat OpenStreetMap.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // The on-screen keyboard shrinks the page, so the chat composer stays visible above it
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${bricolageGrotesque.variable} ${plusJakartaSans.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-bg font-sans text-body text-text antialiased">
        <ServerWarmup />
        <AdminRolePill />
        <NewsPromoAdPopup />
        <FloatingNavbar />
        <div className="flex-1">{children}</div>
        <DeniMascot />
        <AppFooter />
      </body>
    </html>
  );
}
