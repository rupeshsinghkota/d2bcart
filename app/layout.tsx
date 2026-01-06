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
    google: '6HjIbATaiZaEI1-Hkq0FGQTSVoilVlx8VYTmnS0w92A',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://d2bcart.com'

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'D2BCart',
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: 'B2B Marketplace connecting retailers with manufacturers for wholesale trade.',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-9117474683',
      contactType: 'customer service',
      availableLanguage: ['English', 'Hindi']
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Vaibhav Heritage Height, Sector 16',
      addressLocality: 'Greater Noida',
      addressRegion: 'Uttar Pradesh',
      postalCode: '201009',
      addressCountry: 'IN'
    },
    sameAs: [
      'https://wa.me/919117474683',
      'https://www.facebook.com/profile.php?id=61569202844764',
      'https://www.instagram.com/d2b_cart/'
    ]
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'D2BCart',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/products?search={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  }

  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
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
