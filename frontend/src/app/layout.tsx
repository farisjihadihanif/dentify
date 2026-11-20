import type { Metadata } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import { AppFooter } from '../components/AppFooter';
import { DeniMascot } from '../components/DeniMascot';
import { FloatingNavbar } from '../components/FloatingNavbar';
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
  title: 'DentHub – Skrining Kesehatan Gigi & Konsultasi Deni',
  description:
    'Aplikasi web skrining dini kesehatan gigi berbasis Computer Vision, asisten interaktif Deni, dan pencari klinik gigi terdekat OpenStreetMap.',
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
        <FloatingNavbar />
        <div className="flex-1">{children}</div>
        <DeniMascot />
        <AppFooter />
      </body>
    </html>
  );
}
