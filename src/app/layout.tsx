import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// TODO: Set NEXT_PUBLIC_SITE_URL to your real production domain once you have one
// (for example in your hosting provider's environment settings). Until then this
// falls back to a local placeholder, so social previews will not resolve to a real site.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "FixKit — Fix Your Digital Problems";
const description =
  "Compress, resize and convert images, compress and merge PDFs, count words, and solve everyday digital file problems with FixKit.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "FixKit",
  keywords: [
    "FixKit",
    "image compressor",
    "compress image online",
    "resize image",
    "convert image",
    "JPG to PNG",
    "PNG to WebP",
    "PDF compressor",
    "compress PDF",
    "merge PDF",
    "word counter",
    "online file tools",
    "browser-based tools",
    "private file tools",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    siteName: "FixKit",
    title,
    description,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    // No image is configured yet, so use the plain "summary" card.
    card: "summary",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}