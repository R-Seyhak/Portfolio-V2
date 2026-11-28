import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SiteLoader } from '../components/loader/SiteLoader';
import { FONT_STYLESHEET } from '../components/loader/loader.config';

export const metadata = {
  title: 'Rith Seyhak — Software Engineer',
  description: 'Portfolio of Rith Seyhak — aspiring software engineer based in Phnom Penh, Cambodia.',
  // Served straight from public/ so the dev server doesn't compile them as routes.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    // The loader's inline script marks <html> before React hydrates.
    <html lang="en" data-theme="paper" data-density="roomy" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The loader adds this stylesheet itself, so fonts can't delay its first paint. */}
        <noscript>
          <link href={FONT_STYLESHEET} rel="stylesheet" />
        </noscript>
      </head>
      <body>
        <SiteLoader />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
