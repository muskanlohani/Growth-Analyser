import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Growth Analyser — Understand where you are. Discover where to grow.",
  description:
    "Growth Analyser analyzes publicly available GitHub activity to provide an estimated technical skill profile, identify skill gaps, and suggest personalized learning priorities.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
