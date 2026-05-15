import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Scholarian",
    template: "%s | Scholarian",
  },
  description:
    "Automate deep academic research with an AI agent that synthesizes, critiques, and connects complex ideas. Fetch from arXiv, Semantic Scholar, and Google Scholar in seconds.",
  keywords: ["academic research", "AI research assistant", "literature review", "paper synthesis", "Gemini AI"],
  authors: [{ name: "Scholarian" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://scholarian.vercel.app",
    siteName: "Scholarian",
    title: "Scholarian",
    description:
      "Automate deep academic research with an AI agent that synthesizes, critiques, and connects complex ideas.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scholarian — AI Research Intelligence",
    description: "Automate deep academic research with AI-powered synthesis.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} antialiased`}
    >
      <body suppressHydrationWarning className="font-sans bg-surface text-on-surface min-h-full flex flex-col">{children}</body>
    </html>
  );
}
