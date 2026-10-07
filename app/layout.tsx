import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Growth Analyser — Understand where you are. Discover where to grow.",
  description:
    "Growth Analyser analyzes publicly available GitHub activity to provide an estimated technical skill profile, a portfolio health check, skill gaps and AI-written recommendations.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A1B25" },
    { media: "(prefers-color-scheme: light)", color: "#E7EEF1" },
  ],
};

// Runs before first paint so the saved (or system) theme never flashes.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('ga-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,500..800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
