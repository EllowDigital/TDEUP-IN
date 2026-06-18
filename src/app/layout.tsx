import type { Metadata, Viewport } from "next";
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

// 1. Viewport configuration (Separated from Metadata in Next.js 14+)
export const viewport: Viewport = {
  themeColor: "#0B1B2B", // Matches your dark blue branding
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevents unwanted zooming on mobile forms
};

// 2. Comprehensive SEO Metadata
export const metadata: Metadata = {
  metadataBase: new URL("https://tentdecorexpo.com"), // TODO: Replace with your actual live domain
  title: {
    default: "Tent Decor Expo UP 2026 | Kanpur",
    template: "%s | Tent Decor Expo UP 2026",
  },
  description:
    "Join industry leaders and innovators at the premier Tent Decor Expo UP 2026 (Aug 30 - Sep 1). The ultimate event for tents, decorators, caterers, and event management in Kanpur.",
  keywords: [
    "Tent Decor Expo",
    "UP Expo 2026",
    "Kanpur Event",
    "Wedding Decorators",
    "Catering Expo",
    "Event Management",
    "Sanskar Lawn Kanpur",
    "Tent Industry India",
    "Exhibition",
  ],
  authors: [{ name: "Tent Decor Expo Team" }],
  creator: "Tent Decor Expo",
  publisher: "Tent Decor Expo",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    title: "Tent Decor Expo UP 2026 | Premier Industry Event",
    description:
      "Join industry leaders at the premier expo for tents, decorators, caterers, and event management. Aug 30 - Sep 1, 2026 at Sanskar Lawn, Kanpur.",
    siteName: "Tent Decor Expo UP 2026",
    images: [
      {
        url: "/logo-banner.png", // TODO: Add a nice 1200x630px banner image to your /public folder
        width: 1200,
        height: 630,
        alt: "Tent Decor Expo UP 2026 Banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tent Decor Expo UP 2026",
    description:
      "The premier expo for tents, decorators, and caterers. Aug 30 - Sep 1, 2026 in Kanpur.",
    images: ["/logo-banner.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
