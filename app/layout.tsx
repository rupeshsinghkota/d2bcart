import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import FacebookPixel from "@/components/analytics/FacebookPixel";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://d2bcart.com'),
  title: {
    default: "D2BCart - Direct to Business Marketplace",
    template: "%s | D2BCart"
  },
  description: "Connect directly with manufacturers. Skip the middleman, get wholesale prices.",
  keywords: ["B2B marketplace", "wholesale", "manufacturers", "retailers", "direct trade", "bulk buying"],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'D2BCart',
  },
  twitter: {
    card: 'summary_large_image',
  },
  verification: {
    google: 'nB-QAln9yoEuJmfPNVefLi6dRfWfwE80V4TMjHpntRA',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={inter.className} suppressHydrationWarning={true}>
        <Suspense fallback={null}>
          <FacebookPixel />
        </Suspense>
        <Toaster position="top-right" />
        <Navbar />
        <main className="min-h-screen bg-gray-50 pb-16 md:pb-0">
          {children}
        </main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
