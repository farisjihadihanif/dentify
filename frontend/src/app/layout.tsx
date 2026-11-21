import type { Metadata } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import { AdminRolePill } from '../components/AdminRolePill';
import { AppFooter } from '../components/AppFooter';
import { DeniMascot } from '../components/DeniMascot';
import { FloatingNavbar } from '../components/FloatingNavbar';
import { NewsPromoAdPopup } from '../components/NewsPromoAdPopup';
import { ThemeProvider } from '../components/ThemeProvider';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
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

const THEME_INIT_SCRIPT = `(function(){try{var s=window.localStorage.getItem('denthub_theme');var d=s==='dark'||(s!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${bricolageGrotesque.variable} ${plusJakartaSans.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-bg font-sans text-body text-text antialiased">
        <ThemeProvider>
          <ThemeToggleButton variant="floating" />
          <AdminRolePill />
          <NewsPromoAdPopup />
          <FloatingNavbar />
          <div className="flex-1">{children}</div>
          <DeniMascot />
          <AppFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
