import './globals.css';

export const metadata = {
  title: 'Rith Seyhak — Software Engineer',
  description: 'Portfolio of Rith Seyhak — aspiring software engineer based in Phnom Penh, Cambodia.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="paper" data-density="roomy">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
