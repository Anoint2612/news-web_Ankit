import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ClientLayout from "@/components/ClientLayout";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { CookieConsentProvider } from "@/components/CookieConsentContext";
import CookieConsent from "@/components/CookieConsent";
import TrackingProvider from "@/components/TrackingProvider";
import { Suspense } from "react";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: "True Line News",
  description: "Your daily source for the latest news",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${ibmPlexMono.variable} ${ibmPlexSans.variable}`}>
        <Providers>
          <CookieConsentProvider>
            <ClientLayout>
              <AnalyticsTracker />
              {children}
            </ClientLayout>
            <Suspense fallback={null}>
              <TrackingProvider />
            </Suspense>
            <CookieConsent />
          </CookieConsentProvider>
        </Providers>
      </body>
    </html>
  );
}
